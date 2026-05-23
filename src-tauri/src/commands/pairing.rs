//! Tauri commands that wire the pairing flow to the frontend.
//!
//! The "A side" (initiator) talks HTTP to the peer's /pair/* endpoints; the
//! "B side" (responder) flips its local PendingPairings state via direct
//! struct calls. Both live in this file so the frontend has a single import
//! surface.

use serde::{Deserialize, Serialize};
use tauri::State;
use ts_rs::TS;

use crate::error::{AppError, AppResult};
use crate::mcp::{discovery, PairingSession, PairingStatus};
use crate::state::AppState;

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../src/types/generated/")]
#[serde(rename_all = "camelCase")]
pub struct PairingInit {
    pub session_id: String,
    pub code: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../src/types/generated/")]
#[serde(rename_all = "camelCase")]
pub struct PairingPoll {
    pub status: PairingStatus,
    /// Populated only when `status == Accepted`. The bearer token the user
    /// can now plug into the Sync section.
    pub token: Option<String>,
}

// ---- A side (initiator) ---------------------------------------------------

/// Kick off pairing with the peer at `url`. The peer's server creates a
/// pending session, displays a 4-digit code on its UI, and returns the
/// session id + the same code so we can show it here. Network errors (peer
/// not reachable, MCP not exposed) surface as AppError::Sync.
#[tauri::command]
pub async fn start_pairing(url: String) -> AppResult<PairingInit> {
    let url = url.trim().trim_end_matches('/').to_string();
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(10))
        .build()
        .map_err(|e| AppError::Sync(format!("init http client: {e}")))?;
    let body = serde_json::json!({ "requester": discovery::device_hostname() });
    let resp = client
        .post(format!("{url}/pair/initiate"))
        .json(&body)
        .send()
        .await
        .map_err(|e| AppError::Sync(format!("could not reach {url}: {e}")))?
        .error_for_status()
        .map_err(|e| AppError::Sync(format!("peer returned http error: {e}")))?
        .json::<PairingInit>()
        .await
        .map_err(|e| AppError::Sync(format!("peer returned invalid JSON: {e}")))?;
    Ok(resp)
}

/// Poll the peer for the pairing's current state. The frontend calls this
/// every second or so; once `status == Accepted` the `token` field is
/// populated and the flow is done.
#[tauri::command]
pub async fn poll_pairing(url: String, session_id: String) -> AppResult<PairingPoll> {
    let url = url.trim().trim_end_matches('/').to_string();
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(10))
        .build()
        .map_err(|e| AppError::Sync(format!("init http client: {e}")))?;
    let body = serde_json::json!({ "sessionId": session_id });
    let resp = client
        .post(format!("{url}/pair/status"))
        .json(&body)
        .send()
        .await
        .map_err(|e| AppError::Sync(format!("could not reach {url}: {e}")))?;
    // 404 = peer dropped the session (expired). Treat as Expired so the UI
    // can show a clean message instead of a generic HTTP error.
    if resp.status() == reqwest::StatusCode::NOT_FOUND {
        return Ok(PairingPoll {
            status: PairingStatus::Expired,
            token: None,
        });
    }
    let poll = resp
        .error_for_status()
        .map_err(|e| AppError::Sync(format!("peer returned http error: {e}")))?
        .json::<PairingPoll>()
        .await
        .map_err(|e| AppError::Sync(format!("peer returned invalid JSON: {e}")))?;
    Ok(poll)
}

// ---- B side (responder) ---------------------------------------------------

#[tauri::command]
pub async fn list_pending_pairings(state: State<'_, AppState>) -> AppResult<Vec<PairingSession>> {
    Ok(state.pairings.list_pending())
}

#[tauri::command]
pub async fn accept_pairing(
    state: State<'_, AppState>,
    session_id: String,
) -> AppResult<bool> {
    Ok(state.pairings.accept(&session_id))
}

#[tauri::command]
pub async fn reject_pairing(
    state: State<'_, AppState>,
    session_id: String,
) -> AppResult<bool> {
    Ok(state.pairings.reject(&session_id))
}

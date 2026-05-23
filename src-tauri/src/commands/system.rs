use serde::{Deserialize, Serialize};
use tauri::State;
use ts_rs::TS;

use crate::domain::{Capability, SystemInfo};
use crate::error::{AppError, AppResult};
use crate::mcp;
use crate::state::{AppState, McpMode};

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../src/types/generated/")]
#[serde(rename_all = "camelCase")]
pub struct McpStatus {
    pub mode: McpMode,
    pub running: bool,
    #[ts(type = "number")]
    pub port: u16,
    /// URL clients on this machine should use (always loopback).
    pub url: String,
    /// Whether the server is currently bound to 0.0.0.0 (LAN-reachable).
    pub expose_lan: bool,
    /// URL another machine on the LAN should use. None if the LAN IP can't
    /// be determined (e.g. offline) or `expose_lan` is off.
    pub lan_url: Option<String>,
    /// Bearer token required when `expose_lan` is on. Empty if no token has
    /// been generated yet (the first LAN toggle creates one).
    pub token: String,
}

const PROBES: &[&str] = &[
    "pdflatex",
    "xelatex",
    "pandoc",
    "git",
    "dot",
    "mmdc",
    "node",
    "plantuml",
];

#[tauri::command]
pub async fn get_system_info() -> AppResult<SystemInfo> {
    let capabilities = PROBES
        .iter()
        .map(|name| Capability {
            name: (*name).into(),
            detected_path: which::which(name)
                .ok()
                .map(|p| p.to_string_lossy().into_owned()),
        })
        .collect();

    Ok(SystemInfo {
        os: std::env::consts::OS.into(),
        capabilities,
    })
}

#[tauri::command]
pub async fn get_mcp_status(state: State<'_, AppState>) -> AppResult<McpStatus> {
    let guard = state.mcp.lock().await;
    Ok(build_status(&guard))
}

#[tauri::command]
pub async fn set_mcp_mode(
    app: tauri::AppHandle,
    state: State<'_, AppState>,
    mode: McpMode,
) -> AppResult<McpStatus> {
    let data_dir = crate::config::app_data_dir(&app)
        .map_err(|e| AppError::Config(e.to_string()))?;
    let mut config = mcp::load_config(&data_dir);
    config.mode = mode;
    mcp::save_config(&data_dir, &config).map_err(AppError::Io)?;
    restart_with(&state, &app, &config).await?;
    let guard = state.mcp.lock().await;
    Ok(build_status(&guard))
}

#[tauri::command]
pub async fn set_mcp_expose_lan(
    app: tauri::AppHandle,
    state: State<'_, AppState>,
    expose: bool,
) -> AppResult<McpStatus> {
    let data_dir = crate::config::app_data_dir(&app)
        .map_err(|e| AppError::Config(e.to_string()))?;
    let mut config = mcp::load_config(&data_dir);
    config.expose_lan = expose;
    // Lazy token: first time LAN goes on, generate one so the user has
    // something to copy. Stays around afterwards even if LAN is toggled off,
    // so re-enabling doesn't churn the token.
    if expose && config.token.is_empty() {
        config.token = mcp::generate_token();
    }
    mcp::save_config(&data_dir, &config).map_err(AppError::Io)?;
    restart_with(&state, &app, &config).await?;
    let guard = state.mcp.lock().await;
    Ok(build_status(&guard))
}

#[tauri::command]
pub async fn regenerate_mcp_token(
    app: tauri::AppHandle,
    state: State<'_, AppState>,
) -> AppResult<McpStatus> {
    let data_dir = crate::config::app_data_dir(&app)
        .map_err(|e| AppError::Config(e.to_string()))?;
    let mut config = mcp::load_config(&data_dir);
    config.token = mcp::generate_token();
    mcp::save_config(&data_dir, &config).map_err(AppError::Io)?;
    restart_with(&state, &app, &config).await?;
    let guard = state.mcp.lock().await;
    Ok(build_status(&guard))
}

#[tauri::command]
pub fn quit_app(app: tauri::AppHandle) {
    crate::request_quit(&app);
}

#[tauri::command]
pub async fn reset_database(state: State<'_, AppState>) -> AppResult<()> {
    let mut tx = state.db.begin().await?;
    for table in [
        "search_index",
        "comments",
        "notes",
        "tasks",
        "stories",
        "projects",
        "sync_log",
        "paired_peers",
        "device_identity",
    ] {
        sqlx::query(&format!("DELETE FROM {table}"))
            .execute(&mut *tx)
            .await?;
    }
    tx.commit().await?;
    Ok(())
}

async fn restart_with(
    state: &State<'_, AppState>,
    app: &tauri::AppHandle,
    config: &mcp::McpConfig,
) -> AppResult<()> {
    mcp::start(
        state.mcp.clone(),
        state.db.clone(),
        config.mode,
        config.port,
        config.expose_lan,
        config.token.clone(),
        state.discovery.clone(),
        state.pairings.clone(),
        app.clone(),
    )
    .await
    .map_err(AppError::Config)
}

fn build_status(guard: &crate::state::McpState) -> McpStatus {
    let port = if guard.port == 0 {
        mcp::DEFAULT_PORT
    } else {
        guard.port
    };
    let lan_url = if guard.expose_lan {
        local_lan_ip().map(|ip| format!("http://{ip}:{port}/mcp"))
    } else {
        None
    };
    McpStatus {
        mode: guard.mode,
        running: guard.handle.is_some(),
        port,
        url: format!("http://127.0.0.1:{port}/mcp"),
        expose_lan: guard.expose_lan,
        lan_url,
        token: guard.token.clone(),
    }
}

/// Best-effort LAN IP discovery. Opens a UDP socket "connected" to a public
/// address (no packets actually leave) and reads the local interface chosen
/// by the OS routing table. Returns None on machines that can't route to the
/// outside (e.g. fully offline).
fn local_lan_ip() -> Option<std::net::IpAddr> {
    let socket = std::net::UdpSocket::bind("0.0.0.0:0").ok()?;
    socket.connect("8.8.8.8:80").ok()?;
    socket.local_addr().ok().map(|a| a.ip())
}

use tauri::State;

use crate::error::AppResult;
use crate::mcp::{sync_from_peer as run_sync, SyncSummary};
use crate::state::AppState;

#[tauri::command]
pub async fn sync_from_peer(
    state: State<'_, AppState>,
    url: String,
    token: Option<String>,
) -> AppResult<SyncSummary> {
    let url = url.trim().to_string();
    run_sync(&state.db, &url, token).await
}

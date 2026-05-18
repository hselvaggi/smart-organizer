use tauri::State;

use crate::error::AppResult;
use crate::search::{self as search_mod, SearchHit};
use crate::state::AppState;

const DEFAULT_LIMIT: i64 = 30;
const MAX_LIMIT: i64 = 200;

#[tauri::command]
pub async fn search(
    state: State<'_, AppState>,
    query: String,
    limit: Option<i64>,
) -> AppResult<Vec<SearchHit>> {
    let bound = limit.unwrap_or(DEFAULT_LIMIT).clamp(1, MAX_LIMIT);
    search_mod::search(&state.db, &query, bound).await
}

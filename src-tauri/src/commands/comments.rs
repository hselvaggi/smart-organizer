use tauri::State;

use crate::db;
use crate::domain::{Comment, NewComment};
use crate::error::AppResult;
use crate::state::AppState;

#[tauri::command]
pub async fn list_comments(
    state: State<'_, AppState>,
    task_id: String,
) -> AppResult<Vec<Comment>> {
    db::comments::list_for_task(&state.db, &task_id).await
}

#[tauri::command]
pub async fn create_comment(
    state: State<'_, AppState>,
    input: NewComment,
) -> AppResult<Comment> {
    db::comments::create(&state.db, input).await
}

#[tauri::command]
pub async fn delete_comment(state: State<'_, AppState>, id: String) -> AppResult<()> {
    db::comments::soft_delete(&state.db, &id).await
}

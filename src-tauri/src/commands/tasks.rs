use tauri::State;

use crate::db;
use crate::domain::{NewTask, Task, UpdateTask};
use crate::error::AppResult;
use crate::state::AppState;

#[tauri::command]
pub async fn list_tasks(
    state: State<'_, AppState>,
    story_id: String,
) -> AppResult<Vec<Task>> {
    db::tasks::list_for_story(&state.db, &story_id).await
}

#[tauri::command]
pub async fn get_task(state: State<'_, AppState>, id: String) -> AppResult<Option<Task>> {
    db::tasks::get(&state.db, &id).await
}

#[tauri::command]
pub async fn create_task(state: State<'_, AppState>, input: NewTask) -> AppResult<Task> {
    db::tasks::create(&state.db, input).await
}

#[tauri::command]
pub async fn update_task(state: State<'_, AppState>, input: UpdateTask) -> AppResult<Task> {
    db::tasks::update(&state.db, input).await
}

#[tauri::command]
pub async fn delete_task(state: State<'_, AppState>, id: String) -> AppResult<()> {
    db::tasks::soft_delete(&state.db, &id).await
}

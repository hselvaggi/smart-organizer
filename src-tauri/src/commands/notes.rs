use tauri::State;

use crate::db;
use crate::domain::{NewNote, Note, UpdateNote};
use crate::error::AppResult;
use crate::state::AppState;

#[tauri::command]
pub async fn list_notes(state: State<'_, AppState>) -> AppResult<Vec<Note>> {
    db::notes::list_standalone(&state.db).await
}

#[tauri::command]
pub async fn list_notes_for_project(
    state: State<'_, AppState>,
    project_id: String,
) -> AppResult<Vec<Note>> {
    db::notes::list_for_project(&state.db, &project_id).await
}

#[tauri::command]
pub async fn get_note(state: State<'_, AppState>, id: String) -> AppResult<Option<Note>> {
    db::notes::get(&state.db, &id).await
}

#[tauri::command]
pub async fn create_note(state: State<'_, AppState>, input: NewNote) -> AppResult<Note> {
    db::notes::create(&state.db, input).await
}

#[tauri::command]
pub async fn update_note(state: State<'_, AppState>, input: UpdateNote) -> AppResult<Note> {
    db::notes::update(&state.db, input).await
}

#[tauri::command]
pub async fn delete_note(state: State<'_, AppState>, id: String) -> AppResult<()> {
    db::notes::soft_delete(&state.db, &id).await
}

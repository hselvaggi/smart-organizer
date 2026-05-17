use tauri::State;

use crate::db;
use crate::domain::{NewStory, Story, UpdateStory};
use crate::error::AppResult;
use crate::state::AppState;

#[tauri::command]
pub async fn list_stories(
    state: State<'_, AppState>,
    project_id: String,
) -> AppResult<Vec<Story>> {
    db::stories::list_for_project(&state.db, &project_id).await
}

#[tauri::command]
pub async fn get_story(state: State<'_, AppState>, id: String) -> AppResult<Option<Story>> {
    db::stories::get(&state.db, &id).await
}

#[tauri::command]
pub async fn create_story(state: State<'_, AppState>, input: NewStory) -> AppResult<Story> {
    db::stories::create(&state.db, input).await
}

#[tauri::command]
pub async fn update_story(
    state: State<'_, AppState>,
    input: UpdateStory,
) -> AppResult<Story> {
    db::stories::update(&state.db, input).await
}

#[tauri::command]
pub async fn delete_story(state: State<'_, AppState>, id: String) -> AppResult<()> {
    db::stories::soft_delete(&state.db, &id).await
}

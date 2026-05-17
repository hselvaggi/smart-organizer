use tauri::State;

use crate::db;
use crate::domain::{NewProject, Project, ProjectBoard, UpdateProject};
use crate::error::AppResult;
use crate::state::AppState;

#[tauri::command]
pub async fn list_projects(state: State<'_, AppState>) -> AppResult<Vec<Project>> {
    db::projects::list_all(&state.db).await
}

#[tauri::command]
pub async fn get_project(
    state: State<'_, AppState>,
    id: String,
) -> AppResult<Option<Project>> {
    db::projects::get(&state.db, &id).await
}

#[tauri::command]
pub async fn create_project(
    state: State<'_, AppState>,
    input: NewProject,
) -> AppResult<Project> {
    db::projects::create(&state.db, input).await
}

#[tauri::command]
pub async fn update_project(
    state: State<'_, AppState>,
    input: UpdateProject,
) -> AppResult<Project> {
    db::projects::update(&state.db, input).await
}

#[tauri::command]
pub async fn delete_project(
    state: State<'_, AppState>,
    id: String,
) -> AppResult<()> {
    db::projects::soft_delete(&state.db, &id).await
}

#[tauri::command]
pub async fn get_project_board(
    state: State<'_, AppState>,
    project_id: String,
) -> AppResult<ProjectBoard> {
    let stories = db::stories::list_for_project(&state.db, &project_id).await?;
    let tasks = db::tasks::list_for_project(&state.db, &project_id).await?;
    Ok(ProjectBoard { stories, tasks })
}

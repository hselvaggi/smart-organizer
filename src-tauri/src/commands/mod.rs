pub mod comments;
pub mod projects;
pub mod stories;
pub mod system;
pub mod tasks;

use crate::error::AppResult;

#[tauri::command]
pub async fn ping() -> AppResult<&'static str> {
    Ok("pong")
}

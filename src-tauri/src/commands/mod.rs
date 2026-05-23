pub mod comments;
pub mod notes;
pub mod pairing;
pub mod projects;
pub mod search;
pub mod stories;
pub mod sync;
pub mod system;
pub mod tasks;

use crate::error::AppResult;

#[tauri::command]
pub async fn ping() -> AppResult<&'static str> {
    Ok("pong")
}

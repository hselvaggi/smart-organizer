use std::path::PathBuf;

use tauri::{AppHandle, Manager};

use crate::error::AppError;

pub fn app_data_dir(app: &AppHandle) -> Result<PathBuf, AppError> {
    app.path()
        .app_data_dir()
        .map_err(|e| AppError::Config(format!("could not resolve app data dir: {e}")))
}

#[allow(dead_code)]
pub fn db_path(app: &AppHandle) -> Result<PathBuf, AppError> {
    Ok(app_data_dir(app)?.join("tasks.db"))
}

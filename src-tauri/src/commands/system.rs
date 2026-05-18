use serde::{Deserialize, Serialize};
use tauri::State;
use ts_rs::TS;

use crate::domain::{Capability, SystemInfo};
use crate::error::{AppError, AppResult};
use crate::mcp;
use crate::state::{AppState, McpMode};

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../src/types/generated/")]
#[serde(rename_all = "camelCase")]
pub struct McpStatus {
    pub mode: McpMode,
    pub running: bool,
    pub port: u16,
    pub url: String,
}

const PROBES: &[&str] = &[
    "pdflatex",
    "xelatex",
    "pandoc",
    "git",
    "dot",
    "mmdc",
    "node",
    "plantuml",
];

#[tauri::command]
pub async fn get_system_info() -> AppResult<SystemInfo> {
    let capabilities = PROBES
        .iter()
        .map(|name| Capability {
            name: (*name).into(),
            detected_path: which::which(name)
                .ok()
                .map(|p| p.to_string_lossy().into_owned()),
        })
        .collect();

    Ok(SystemInfo {
        os: std::env::consts::OS.into(),
        capabilities,
    })
}

#[tauri::command]
pub async fn get_mcp_status(state: State<'_, AppState>) -> AppResult<McpStatus> {
    let guard = state.mcp.lock().await;
    Ok(McpStatus {
        mode: guard.mode,
        running: guard.handle.is_some(),
        port: if guard.port == 0 {
            mcp::DEFAULT_PORT
        } else {
            guard.port
        },
        url: format!(
            "http://127.0.0.1:{}/mcp",
            if guard.port == 0 {
                mcp::DEFAULT_PORT
            } else {
                guard.port
            }
        ),
    })
}

#[tauri::command]
pub async fn set_mcp_mode(
    app: tauri::AppHandle,
    state: State<'_, AppState>,
    mode: McpMode,
) -> AppResult<McpStatus> {
    let data_dir = crate::config::app_data_dir(&app)
        .map_err(|e| AppError::Config(e.to_string()))?;
    mcp::save_mode(&data_dir, mode).map_err(AppError::Io)?;

    mcp::start(state.mcp.clone(), state.db.clone(), mode, mcp::DEFAULT_PORT)
        .await
        .map_err(AppError::Config)?;

    let guard = state.mcp.lock().await;
    Ok(McpStatus {
        mode: guard.mode,
        running: guard.handle.is_some(),
        port: if guard.port == 0 {
            mcp::DEFAULT_PORT
        } else {
            guard.port
        },
        url: format!(
            "http://127.0.0.1:{}/mcp",
            if guard.port == 0 {
                mcp::DEFAULT_PORT
            } else {
                guard.port
            }
        ),
    })
}

#[tauri::command]
pub fn quit_app(app: tauri::AppHandle) {
    app.exit(0);
}

#[tauri::command]
pub async fn reset_database(state: State<'_, AppState>) -> AppResult<()> {
    let mut tx = state.db.begin().await?;
    for table in [
        "comments",
        "tasks",
        "stories",
        "projects",
        "sync_log",
        "paired_peers",
        "device_identity",
    ] {
        sqlx::query(&format!("DELETE FROM {table}"))
            .execute(&mut *tx)
            .await?;
    }
    tx.commit().await?;
    Ok(())
}

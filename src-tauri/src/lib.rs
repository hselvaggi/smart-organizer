mod commands;
mod config;
mod db;
mod domain;
mod error;
mod mcp;
mod state;

use std::sync::Arc;

use state::{AppState, McpState};
use tauri::Manager;
use tokio::sync::Mutex;

pub fn run() {
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "info,tasks_lib=debug".into()),
        )
        .init();

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .setup(|app| {
            let handle = app.handle().clone();
            tauri::async_runtime::block_on(async move {
                let data_dir = config::app_data_dir(&handle)?;
                std::fs::create_dir_all(&data_dir)?;
                let db_path = config::db_path(&handle)?;
                tracing::info!(?db_path, "opening database");
                let pool = db::open_pool(&db_path).await?;

                let mcp_state = Arc::new(Mutex::new(McpState::default()));
                let saved_mode = mcp::load_mode(&data_dir);
                if saved_mode.is_running() {
                    if let Err(e) = mcp::start(
                        mcp_state.clone(),
                        pool.clone(),
                        saved_mode,
                        mcp::DEFAULT_PORT,
                    )
                    .await
                    {
                        tracing::warn!(error = %e, "could not auto-start mcp");
                    }
                }

                handle.manage(AppState {
                    db: pool,
                    mcp: mcp_state,
                });
                Ok::<_, error::AppError>(())
            })?;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::ping,
            commands::projects::list_projects,
            commands::projects::get_project,
            commands::projects::create_project,
            commands::projects::update_project,
            commands::projects::delete_project,
            commands::projects::get_project_board,
            commands::stories::list_stories,
            commands::stories::get_story,
            commands::stories::create_story,
            commands::stories::update_story,
            commands::stories::delete_story,
            commands::tasks::list_tasks,
            commands::tasks::get_task,
            commands::tasks::create_task,
            commands::tasks::update_task,
            commands::tasks::delete_task,
            commands::comments::list_comments,
            commands::comments::create_comment,
            commands::comments::delete_comment,
            commands::system::get_system_info,
            commands::system::reset_database,
            commands::system::get_mcp_status,
            commands::system::set_mcp_mode,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

mod commands;
mod config;
mod db;
mod domain;
mod error;
mod state;

use state::AppState;
use tauri::Manager;

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
                handle.manage(AppState { db: pool });
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
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

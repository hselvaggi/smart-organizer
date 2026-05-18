mod commands;
mod config;
mod db;
mod domain;
mod error;
mod mcp;
mod state;

use std::sync::Arc;

use state::{AppState, McpState};
use tauri::menu::{Menu, MenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{Manager, WindowEvent};
use tokio::sync::Mutex;

pub fn run() {
    // Force a known dark GTK theme on Linux so the libayatana-appindicator
    // tray menu doesn't end up with invisible text on themes where it can't
    // resolve foreground colours. Only set if the user hasn't picked one.
    #[cfg(target_os = "linux")]
    {
        if std::env::var_os("GTK_THEME").is_none() {
            std::env::set_var("GTK_THEME", "Adwaita:dark");
        }
    }

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

            let show_item =
                MenuItem::with_id(app, "show", "Show window", true, None::<&str>)?;
            let quit_item = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show_item, &quit_item])?;

            let icon = app
                .default_window_icon()
                .ok_or("missing default window icon")?
                .clone();

            let tray = TrayIconBuilder::with_id("main-tray")
                .icon(icon)
                .tooltip("Organizer")
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "show" => reveal_main_window(app),
                    "quit" => app.exit(0),
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        reveal_main_window(tray.app_handle());
                    }
                })
                .build(app)?;
            // Keep the tray alive for the lifetime of the app so libappindicator
            // doesn't intermittently lose track of the menu items.
            app.manage(tray);

            if let Some(window) = app.get_webview_window("main") {
                let window_clone = window.clone();
                window.on_window_event(move |event| {
                    if let WindowEvent::CloseRequested { api, .. } = event {
                        api.prevent_close();
                        let _ = window_clone.hide();
                    }
                });
            }

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
            commands::notes::list_notes,
            commands::notes::list_notes_for_project,
            commands::notes::get_note,
            commands::notes::create_note,
            commands::notes::update_note,
            commands::notes::delete_note,
            commands::system::get_system_info,
            commands::system::reset_database,
            commands::system::quit_app,
            commands::system::get_mcp_status,
            commands::system::set_mcp_mode,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

fn reveal_main_window(app: &tauri::AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_focus();
    }
}

pub mod client;
pub mod server;
pub mod tools;

use std::path::Path;

pub use client::{sync_from_peer, SyncSummary};
pub use server::{start, DEFAULT_PORT};

use crate::state::McpMode;

pub fn config_path(data_dir: &Path) -> std::path::PathBuf {
    data_dir.join("mcp.json")
}

pub fn load_mode(data_dir: &Path) -> McpMode {
    let path = config_path(data_dir);
    let Ok(text) = std::fs::read_to_string(&path) else {
        return McpMode::Off;
    };
    serde_json::from_str::<McpConfig>(&text)
        .map(|c| c.mode)
        .unwrap_or(McpMode::Off)
}

pub fn save_mode(data_dir: &Path, mode: McpMode) -> std::io::Result<()> {
    let path = config_path(data_dir);
    let config = McpConfig { mode };
    let text = serde_json::to_string_pretty(&config).unwrap_or_default();
    std::fs::write(path, text)
}

#[derive(serde::Serialize, serde::Deserialize)]
struct McpConfig {
    mode: McpMode,
}

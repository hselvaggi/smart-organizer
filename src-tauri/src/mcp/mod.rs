pub mod client;
pub mod server;
pub mod tools;

use std::path::Path;

pub use client::{sync_from_peer, SyncSummary};
pub use server::{start, DEFAULT_PORT};

use crate::state::McpMode;

/// Persisted MCP configuration. Adds three fields beyond the historical
/// `mode`: a LAN-expose toggle, a configurable port (so two instances on the
/// same machine can coexist), and a bearer token used to authenticate
/// incoming requests when LAN exposure is on. The token is generated lazily
/// the first time LAN exposure is enabled and persists from then on.
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct McpConfig {
    #[serde(default)]
    pub mode: McpMode,
    #[serde(default)]
    pub expose_lan: bool,
    #[serde(default = "default_port")]
    pub port: u16,
    #[serde(default)]
    pub token: String,
}

impl Default for McpConfig {
    fn default() -> Self {
        Self {
            mode: McpMode::default(),
            expose_lan: false,
            port: DEFAULT_PORT,
            token: String::new(),
        }
    }
}

fn default_port() -> u16 {
    DEFAULT_PORT
}

pub fn config_path(data_dir: &Path) -> std::path::PathBuf {
    data_dir.join("mcp.json")
}

pub fn load_config(data_dir: &Path) -> McpConfig {
    let path = config_path(data_dir);
    let Ok(text) = std::fs::read_to_string(&path) else {
        return McpConfig::default();
    };
    serde_json::from_str(&text).unwrap_or_default()
}

pub fn save_config(data_dir: &Path, config: &McpConfig) -> std::io::Result<()> {
    let path = config_path(data_dir);
    let text = serde_json::to_string_pretty(config).unwrap_or_default();
    std::fs::write(path, text)
}

/// Generate a fresh bearer token. Uses the same UUIDv7 generator the rest of
/// the codebase uses for entity ids — plenty of entropy for a per-install
/// shared secret on a LAN, no extra deps.
pub fn generate_token() -> String {
    crate::domain::ids::new_id()
}


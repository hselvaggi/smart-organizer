use std::sync::Arc;

use sqlx::SqlitePool;
use tokio::sync::Mutex;
use tokio::task::JoinHandle;
use ts_rs::TS;

pub struct AppState {
    pub db: SqlitePool,
    pub mcp: Arc<Mutex<McpState>>,
}

#[derive(Default)]
pub struct McpState {
    pub mode: McpMode,
    pub handle: Option<JoinHandle<()>>,
    pub port: u16,
    pub expose_lan: bool,
    /// Bearer token enforced on /mcp when `expose_lan` is true. Empty means
    /// no auth (only valid when bound to 127.0.0.1).
    pub token: String,
}

#[derive(
    Debug, Clone, Copy, Default, PartialEq, Eq, serde::Serialize, serde::Deserialize, TS,
)]
#[ts(export, export_to = "../../src/types/generated/")]
#[serde(rename_all = "lowercase")]
pub enum McpMode {
    #[default]
    Off,
    Readonly,
    Full,
}

impl McpMode {
    pub fn is_running(&self) -> bool {
        !matches!(self, McpMode::Off)
    }
    pub fn allows_writes(&self) -> bool {
        matches!(self, McpMode::Full)
    }
}

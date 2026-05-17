use crate::domain::{Capability, SystemInfo};
use crate::error::AppResult;

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

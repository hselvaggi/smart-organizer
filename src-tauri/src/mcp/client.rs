//! HTTP/JSON-RPC client for talking to another instance's MCP server. Used to
//! pull missing entities from a peer running `mcp::start`.
//!
//! The walker is intentionally read-only and additive: it never updates or
//! deletes anything locally. Entities whose `id` is already present in the
//! local DB are skipped (whether or not the local copy is soft-deleted) so
//! local edits and deletions are preserved.

use std::collections::{HashMap, HashSet};
use std::sync::atomic::{AtomicU64, Ordering};

use reqwest::Client;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sqlx::SqlitePool;
use ts_rs::TS;

use crate::db;
use crate::domain::{Comment, Note, Project, Story, Task};
use crate::error::{AppError, AppResult};

/// Counts returned to the UI after a pull. `skipped` covers every kind of
/// entity that already existed locally.
#[derive(Debug, Default, Clone, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../src/types/generated/")]
#[serde(rename_all = "camelCase")]
pub struct SyncSummary {
    #[ts(type = "number")]
    pub projects_added: u32,
    #[ts(type = "number")]
    pub stories_added: u32,
    #[ts(type = "number")]
    pub tasks_added: u32,
    #[ts(type = "number")]
    pub comments_added: u32,
    #[ts(type = "number")]
    pub notes_added: u32,
    #[ts(type = "number")]
    pub skipped: u32,
}

/// Thin JSON-RPC client over the peer's `/mcp` endpoint.
struct PeerClient {
    base_url: String,
    http: Client,
    next_id: AtomicU64,
}

impl PeerClient {
    fn new(base_url: &str) -> AppResult<Self> {
        let http = Client::builder()
            .timeout(std::time::Duration::from_secs(15))
            .build()
            .map_err(|e| AppError::Sync(format!("init http client: {e}")))?;
        let base_url = base_url.trim_end_matches('/').to_string();
        Ok(Self {
            base_url,
            http,
            next_id: AtomicU64::new(1),
        })
    }

    /// Call an MCP tool and deserialize its content payload into `T`. The MCP
    /// protocol wraps tool output as `{ content: [{type:"text", text:"<json>"}] }`
    /// — that nested JSON string is what we actually want.
    async fn call_tool<T: serde::de::DeserializeOwned>(
        &self,
        name: &str,
        args: Value,
    ) -> AppResult<T> {
        let id = self.next_id.fetch_add(1, Ordering::Relaxed);
        let body = json!({
            "jsonrpc": "2.0",
            "id": id,
            "method": "tools/call",
            "params": { "name": name, "arguments": args }
        });
        let url = format!("{}/mcp", self.base_url);

        let resp: Value = self
            .http
            .post(&url)
            .json(&body)
            .send()
            .await
            .map_err(|e| AppError::Sync(format!("connect to {url}: {e}")))?
            .error_for_status()
            .map_err(|e| AppError::Sync(format!("peer returned http error: {e}")))?
            .json()
            .await
            .map_err(|e| AppError::Sync(format!("peer returned invalid JSON: {e}")))?;

        if let Some(err) = resp.get("error") {
            return Err(AppError::Sync(format!("peer rpc error: {err}")));
        }
        let result = resp
            .get("result")
            .ok_or_else(|| AppError::Sync("peer response missing result".into()))?;
        let is_error = result
            .get("isError")
            .and_then(Value::as_bool)
            .unwrap_or(false);
        let text = result
            .get("content")
            .and_then(|c| c.get(0))
            .and_then(|c| c.get("text"))
            .and_then(Value::as_str)
            .ok_or_else(|| AppError::Sync("peer tool response missing content[0].text".into()))?;
        if is_error {
            return Err(AppError::Sync(format!("peer tool {name} failed: {text}")));
        }
        serde_json::from_str(text)
            .map_err(|e| AppError::Sync(format!("could not decode {name} payload: {e}")))
    }

    /// Probe the endpoint with `initialize` so we fail fast on the wrong URL
    /// or version mismatch instead of partway through a sync.
    async fn handshake(&self) -> AppResult<()> {
        let id = self.next_id.fetch_add(1, Ordering::Relaxed);
        let body = json!({
            "jsonrpc": "2.0",
            "id": id,
            "method": "initialize",
            "params": {
                "protocolVersion": "2024-11-05",
                "capabilities": {},
                "clientInfo": { "name": "smart-organizer-sync", "version": env!("CARGO_PKG_VERSION") }
            }
        });
        let url = format!("{}/mcp", self.base_url);
        let resp: Value = self
            .http
            .post(&url)
            .json(&body)
            .send()
            .await
            .map_err(|e| AppError::Sync(format!("could not reach {url}: {e}")))?
            .error_for_status()
            .map_err(|e| AppError::Sync(format!("peer rejected handshake: {e}")))?
            .json()
            .await
            .map_err(|e| AppError::Sync(format!("peer handshake returned invalid JSON: {e}")))?;
        if let Some(err) = resp.get("error") {
            return Err(AppError::Sync(format!("peer rpc error on handshake: {err}")));
        }
        Ok(())
    }
}

/// Pull all entities reachable from the peer that aren't present locally.
/// Walks projects → stories → tasks → comments, then notes (project-attached
/// and standalone). Stops on the first transport error; partial progress is
/// kept (each insert is its own statement, not wrapped in a global tx, so a
/// network failure halfway through doesn't lose the already-imported rows).
pub async fn sync_from_peer(pool: &SqlitePool, base_url: &str) -> AppResult<SyncSummary> {
    let client = PeerClient::new(base_url)?;
    client.handshake().await?;

    let mut summary = SyncSummary::default();

    // 1. Projects.
    let projects: Vec<Project> = client.call_tool("list_projects", json!({})).await?;
    for p in &projects {
        if db::projects::insert_raw(pool, p).await? {
            summary.projects_added += 1;
        } else {
            summary.skipped += 1;
        }
    }

    // 2. Per project: stories → tasks → comments, plus attached notes.
    for p in &projects {
        let stories: Vec<Story> = client
            .call_tool("list_stories", json!({ "projectId": p.id }))
            .await?;
        for s in &stories {
            if db::stories::insert_raw(pool, s).await? {
                summary.stories_added += 1;
            } else {
                summary.skipped += 1;
            }

            let tasks: Vec<Task> = client
                .call_tool("list_tasks", json!({ "storyId": s.id }))
                .await?;
            // Topological order so a subtask never lands before its parent
            // (parent_task_id is a FK; out-of-order inserts would FK-violate).
            for t in topo_sort_tasks(&tasks) {
                if db::tasks::insert_raw(pool, t).await? {
                    summary.tasks_added += 1;
                } else {
                    summary.skipped += 1;
                }

                let comments: Vec<Comment> = client
                    .call_tool("list_comments", json!({ "taskId": t.id }))
                    .await?;
                for c in &comments {
                    if db::comments::insert_raw(pool, c).await? {
                        summary.comments_added += 1;
                    } else {
                        summary.skipped += 1;
                    }
                }
            }
        }

        let attached_notes: Vec<Note> = client
            .call_tool("list_notes_for_project", json!({ "projectId": p.id }))
            .await?;
        for n in &attached_notes {
            if db::notes::insert_raw(pool, n).await? {
                summary.notes_added += 1;
            } else {
                summary.skipped += 1;
            }
        }
    }

    // 3. Standalone notes.
    let standalone: Vec<Note> = client.call_tool("list_notes", json!({})).await?;
    for n in &standalone {
        if db::notes::insert_raw(pool, n).await? {
            summary.notes_added += 1;
        } else {
            summary.skipped += 1;
        }
    }

    Ok(summary)
}

/// Return references to `tasks` ordered so every task appears after its
/// parent. Tasks with a `parent_task_id` that isn't in the input set are
/// treated as roots (they'd FK-violate if their parent doesn't exist locally
/// either, but that's a peer-side data integrity issue we let surface).
fn topo_sort_tasks(tasks: &[Task]) -> Vec<&Task> {
    let by_id: HashMap<&str, &Task> =
        tasks.iter().map(|t| (t.id.as_str(), t)).collect();
    let mut out: Vec<&Task> = Vec::with_capacity(tasks.len());
    let mut visited: HashSet<&str> = HashSet::with_capacity(tasks.len());

    fn visit<'a>(
        t: &'a Task,
        by_id: &HashMap<&'a str, &'a Task>,
        visited: &mut HashSet<&'a str>,
        out: &mut Vec<&'a Task>,
    ) {
        if !visited.insert(t.id.as_str()) {
            return;
        }
        if let Some(parent_id) = t.parent_task_id.as_deref() {
            if let Some(parent) = by_id.get(parent_id) {
                visit(parent, by_id, visited, out);
            }
        }
        out.push(t);
    }

    for t in tasks {
        visit(t, &by_id, &mut visited, &mut out);
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    fn task(id: &str, parent: Option<&str>) -> Task {
        Task {
            id: id.into(),
            story_id: "s".into(),
            parent_task_id: parent.map(String::from),
            title: id.into(),
            description: String::new(),
            description_format: crate::domain::TextFormat::default(),
            result: String::new(),
            result_format: crate::domain::TextFormat::default(),
            status: crate::domain::TaskStatus::default(),
            sort_order: 0,
            created_at: String::new(),
            updated_at: String::new(),
            deleted_at: None,
            started_at: None,
            completed_at: None,
            due_date: None,
        }
    }

    #[test]
    fn topo_sort_puts_parents_before_children() {
        // Input order is intentionally wrong: deepest first.
        let ts = vec![
            task("c", Some("b")),
            task("b", Some("a")),
            task("a", None),
            task("d", None),
        ];
        let sorted = topo_sort_tasks(&ts);
        let order: Vec<&str> = sorted.iter().map(|t| t.id.as_str()).collect();
        // a must come before b, which must come before c; d can land anywhere.
        let a = order.iter().position(|s| *s == "a").unwrap();
        let b = order.iter().position(|s| *s == "b").unwrap();
        let c = order.iter().position(|s| *s == "c").unwrap();
        assert!(a < b);
        assert!(b < c);
        assert_eq!(sorted.len(), 4);
    }

    #[test]
    fn topo_sort_handles_orphans_as_roots() {
        // parent "ghost" isn't in the set — task "x" still appears (once),
        // ordered before its own children if it had any.
        let ts = vec![task("x", Some("ghost"))];
        let sorted = topo_sort_tasks(&ts);
        assert_eq!(sorted.len(), 1);
        assert_eq!(sorted[0].id, "x");
    }
}

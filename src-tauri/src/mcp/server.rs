use std::net::SocketAddr;
use std::sync::Arc;

use axum::extract::State;
use axum::http::StatusCode;
use axum::response::{IntoResponse, Response};
use axum::routing::{get, post};
use axum::{Json, Router};
use serde_json::{json, Value};
use sqlx::SqlitePool;
use tokio::net::TcpListener;
use tokio::sync::Mutex;
use tower_http::cors::CorsLayer;

use crate::mcp::tools;
use crate::state::{McpMode, McpState};

pub const DEFAULT_PORT: u16 = 3737;
const PROTOCOL_VERSION: &str = "2024-11-05";
const SERVER_NAME: &str = "tasks";
const SERVER_VERSION: &str = env!("CARGO_PKG_VERSION");

#[derive(Clone)]
struct AppCtx {
    pool: SqlitePool,
    mode: McpMode,
}

pub async fn start(
    state: Arc<Mutex<McpState>>,
    pool: SqlitePool,
    mode: McpMode,
    port: u16,
) -> Result<(), String> {
    stop(state.clone()).await;
    if !mode.is_running() {
        return Ok(());
    }

    let ctx = AppCtx {
        pool,
        mode,
    };

    let app = Router::new()
        .route("/mcp", post(handle_mcp).get(handle_get))
        .route("/", get(root))
        .layer(CorsLayer::permissive())
        .with_state(ctx);

    let addr: SocketAddr = format!("127.0.0.1:{port}")
        .parse()
        .map_err(|e: std::net::AddrParseError| e.to_string())?;
    let listener = TcpListener::bind(addr)
        .await
        .map_err(|e| format!("bind {addr}: {e}"))?;

    let handle = tokio::spawn(async move {
        if let Err(e) = axum::serve(listener, app).await {
            tracing::error!(error = %e, "mcp server stopped with error");
        }
    });

    let mut guard = state.lock().await;
    guard.mode = mode;
    guard.handle = Some(handle);
    guard.port = port;
    tracing::info!(?addr, ?mode, "mcp server started");
    Ok(())
}

pub async fn stop(state: Arc<Mutex<McpState>>) {
    let mut guard = state.lock().await;
    if let Some(handle) = guard.handle.take() {
        handle.abort();
        tracing::info!("mcp server stopped");
    }
    guard.mode = McpMode::Off;
}

async fn root() -> impl IntoResponse {
    Json(json!({
        "name": SERVER_NAME,
        "version": SERVER_VERSION,
        "protocol": PROTOCOL_VERSION,
        "endpoint": "/mcp"
    }))
}

async fn handle_get() -> impl IntoResponse {
    // We don't implement server-initiated SSE notifications.
    (
        StatusCode::METHOD_NOT_ALLOWED,
        "GET not supported; POST JSON-RPC to /mcp",
    )
}

async fn handle_mcp(State(ctx): State<AppCtx>, Json(req): Json<Value>) -> Response {
    let id = req.get("id").cloned();
    let method = req.get("method").and_then(|v| v.as_str()).unwrap_or("");
    let params = req.get("params").cloned().unwrap_or(Value::Null);

    if id.is_none() {
        // Notification — no response body.
        return StatusCode::ACCEPTED.into_response();
    }
    let id = id.unwrap();

    let result = match method {
        "initialize" => Ok(json!({
            "protocolVersion": PROTOCOL_VERSION,
            "capabilities": { "tools": { "listChanged": false } },
            "serverInfo": { "name": SERVER_NAME, "version": SERVER_VERSION }
        })),
        "ping" => Ok(json!({})),
        "tools/list" => Ok(json!({
            "tools": tools::list_tools(ctx.mode)
                .iter()
                .map(|t| json!({
                    "name": t.name,
                    "description": t.description,
                    "inputSchema": (t.input_schema)(),
                }))
                .collect::<Vec<_>>()
        })),
        "tools/call" => {
            let name = params.get("name").and_then(|v| v.as_str()).unwrap_or("");
            let args = params.get("arguments").cloned().unwrap_or(json!({}));
            match tools::call_tool(&ctx.pool, ctx.mode, name, &args).await {
                Ok(value) => Ok(json!({
                    "content": [
                        { "type": "text", "text": serde_json::to_string_pretty(&value).unwrap_or_default() }
                    ],
                    "isError": false
                })),
                Err(message) => Ok(json!({
                    "content": [ { "type": "text", "text": message } ],
                    "isError": true
                })),
            }
        }
        other => Err(format!("method not found: {other}")),
    };

    let body = match result {
        Ok(value) => json!({ "jsonrpc": "2.0", "id": id, "result": value }),
        Err(message) => json!({
            "jsonrpc": "2.0",
            "id": id,
            "error": { "code": -32601, "message": message }
        }),
    };
    Json(body).into_response()
}

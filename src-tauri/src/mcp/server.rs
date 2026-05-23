use std::net::SocketAddr;
use std::sync::Arc;

use axum::extract::{Request, State};
use axum::http::{header, StatusCode};
use axum::middleware::Next;
use axum::response::{IntoResponse, Response};
use axum::routing::{get, post};
use axum::{Json, Router};
use serde_json::{json, Value};
use sqlx::SqlitePool;
use tokio::net::TcpListener;
use tokio::sync::Mutex;
use tower_http::cors::CorsLayer;

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter};

use crate::mcp::discovery::{self, PeerDiscovery};
use crate::mcp::pairing::{PairingStatus, PendingPairings};
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

#[derive(Clone)]
struct PairCtx {
    pairings: Arc<PendingPairings>,
    app: AppHandle,
    /// Server token — returned to the requester once the user accepts so
    /// they can authenticate future /mcp calls without ever seeing the
    /// secret on screen.
    token: String,
}

pub async fn start(
    state: Arc<Mutex<McpState>>,
    pool: SqlitePool,
    mode: McpMode,
    port: u16,
    expose_lan: bool,
    token: String,
    discovery: Arc<PeerDiscovery>,
    pairings: Arc<PendingPairings>,
    app_handle: AppHandle,
) -> Result<(), String> {
    stop(state.clone(), discovery.clone()).await;
    if !mode.is_running() {
        let mut guard = state.lock().await;
        guard.mode = mode;
        guard.port = port;
        guard.expose_lan = expose_lan;
        guard.token = token;
        return Ok(());
    }

    let ctx = AppCtx { pool, mode };
    let pair_ctx = PairCtx {
        pairings,
        app: app_handle,
        token: token.clone(),
    };

    // /mcp gets optional auth; /, /pair/* stay public so peers can probe
    // identity and initiate pairing (pairing is exactly how you get the
    // bearer token, so it can't require one itself).
    let mcp_route = Router::new()
        .route("/mcp", post(handle_mcp).get(handle_get))
        .with_state(ctx);

    let mcp_route = if expose_lan && !token.is_empty() {
        mcp_route.layer(axum::middleware::from_fn_with_state(
            Arc::new(token.clone()),
            require_bearer,
        ))
    } else {
        mcp_route
    };

    let pair_router = Router::new()
        .route("/pair/initiate", post(pair_initiate))
        .route("/pair/status", post(pair_status))
        .with_state(pair_ctx);

    let app = Router::new()
        .route("/", get(root))
        .merge(mcp_route)
        .merge(pair_router)
        .layer(CorsLayer::permissive());

    let bind_host = if expose_lan { "0.0.0.0" } else { "127.0.0.1" };
    let addr: SocketAddr = format!("{bind_host}:{port}")
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

    // mDNS announce — only when we're actually reachable from the LAN.
    let announce_fullname = if expose_lan {
        let hostname = discovery::device_hostname();
        // Append the port so two instances on the same machine on different
        // ports get distinct instance names instead of collide-renaming.
        let instance = format!("{hostname}-{port}");
        match discovery::announce(discovery.daemon(), &instance, &hostname, port) {
            Ok(fullname) => {
                discovery.hide_self(&fullname);
                Some(fullname)
            }
            Err(e) => {
                tracing::warn!(error = %e, "mdns announce failed");
                None
            }
        }
    } else {
        None
    };

    let mut guard = state.lock().await;
    guard.mode = mode;
    guard.handle = Some(handle);
    guard.port = port;
    guard.expose_lan = expose_lan;
    guard.token = token;
    guard.announce_fullname = announce_fullname;
    tracing::info!(
        ?addr,
        ?mode,
        expose_lan,
        auth = !guard.token.is_empty(),
        announcing = guard.announce_fullname.is_some(),
        "mcp server started"
    );
    Ok(())
}

pub async fn stop(state: Arc<Mutex<McpState>>, discovery: Arc<PeerDiscovery>) {
    let mut guard = state.lock().await;
    if let Some(fullname) = guard.announce_fullname.take() {
        discovery::stop_announce(discovery.daemon(), &fullname);
    }
    if let Some(handle) = guard.handle.take() {
        handle.abort();
        tracing::info!("mcp server stopped");
    }
    guard.mode = McpMode::Off;
}

/// Bearer-token gate. The token Arc is the expected secret; the middleware
/// rejects requests that don't present an `Authorization: Bearer <token>`
/// header matching it.
async fn require_bearer(
    State(expected): State<Arc<String>>,
    req: Request,
    next: Next,
) -> Response {
    let header_value = req
        .headers()
        .get(header::AUTHORIZATION)
        .and_then(|v| v.to_str().ok());
    let presented = header_value.and_then(|s| s.strip_prefix("Bearer "));
    if presented != Some(expected.as_str()) {
        return (
            StatusCode::UNAUTHORIZED,
            Json(json!({
                "jsonrpc": "2.0",
                "error": { "code": -32001, "message": "unauthorized" }
            })),
        )
            .into_response();
    }
    next.run(req).await
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

#[derive(Deserialize)]
struct InitiateBody {
    /// Free-form label (hostname etc.) so the user on this side knows who's
    /// asking when the accept modal pops up.
    #[serde(default)]
    requester: String,
}

#[derive(Serialize)]
struct InitiateResponse {
    session_id: String,
    code: String,
}

async fn pair_initiate(
    State(ctx): State<PairCtx>,
    Json(body): Json<InitiateBody>,
) -> Response {
    let label = if body.requester.trim().is_empty() {
        "Unknown device".to_string()
    } else {
        body.requester.trim().to_string()
    };
    let session = ctx.pairings.initiate(&label);
    // Tell the local UI a pairing modal should pop up. Failure to emit is
    // logged but not fatal — the session still exists, so even if the event
    // is lost the user can find it via list_pending_pairings.
    if let Err(e) = ctx.app.emit("pairing-requested", &session) {
        tracing::warn!(error = %e, "could not emit pairing-requested event");
    }
    Json(InitiateResponse {
        session_id: session.session_id,
        code: session.code,
    })
    .into_response()
}

#[derive(Deserialize)]
struct StatusBody {
    session_id: String,
}

#[derive(Serialize)]
struct StatusResponse {
    status: PairingStatus,
    /// Only populated when status is Accepted — this is the bearer token
    /// the requester now uses for /mcp calls.
    token: Option<String>,
}

async fn pair_status(
    State(ctx): State<PairCtx>,
    Json(body): Json<StatusBody>,
) -> Response {
    let Some(status) = ctx.pairings.status(&body.session_id) else {
        return (
            StatusCode::NOT_FOUND,
            Json(StatusResponse {
                status: PairingStatus::Expired,
                token: None,
            }),
        )
            .into_response();
    };
    let token = matches!(status, PairingStatus::Accepted).then(|| ctx.token.clone());
    Json(StatusResponse { status, token }).into_response()
}

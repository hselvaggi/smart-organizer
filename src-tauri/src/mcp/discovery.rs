//! LAN peer discovery via mDNS-SD.
//!
//! When MCP is exposed to LAN, the server registers a service of type
//! `_smart-organizer._tcp.local.` so other instances see it. This module owns
//! a single `ServiceDaemon` shared by both sides: the discovery browser
//! (always running) populates `peers` as `ServiceResolved` events arrive,
//! and the server-side `announce` / `stop_announce` helpers reuse the same
//! daemon to register / unregister our own advertisement.

use std::collections::HashMap;
use std::net::IpAddr;
use std::sync::{Arc, Mutex};

use mdns_sd::{ServiceDaemon, ServiceEvent, ServiceInfo};
use serde::{Deserialize, Serialize};
use ts_rs::TS;

const SERVICE_TYPE: &str = "_smart-organizer._tcp.local.";

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../src/types/generated/")]
#[serde(rename_all = "camelCase")]
pub struct Peer {
    /// mDNS instance fullname (e.g. `my-mac-3737._smart-organizer._tcp.local.`).
    /// Used as a stable key for React lists.
    pub name: String,
    /// Display label — the instance part without the service suffix.
    pub label: String,
    /// `<host>.local` advertised by the peer.
    pub host: String,
    /// Numeric IPv4/IPv6 strings the daemon resolved.
    pub addresses: Vec<String>,
    #[ts(type = "number")]
    pub port: u16,
    /// Best-guess URL to plug into the Sync section. Prefers IPv4 over IPv6
    /// over hostname — hostname is rarely useful since `<host>.local` only
    /// resolves with mDNS-aware clients.
    pub url: String,
}

pub struct PeerDiscovery {
    daemon: ServiceDaemon,
    peers: Arc<Mutex<HashMap<String, Peer>>>,
}

impl PeerDiscovery {
    /// Spin up the daemon and start the browse loop. Returns `Err` only if
    /// the OS refuses to create the underlying sockets (e.g. no network
    /// interfaces at all). On every other class of error we just log and
    /// keep going with an empty list — discovery is best-effort.
    pub fn new() -> Result<Arc<Self>, String> {
        let daemon = ServiceDaemon::new().map_err(|e| e.to_string())?;
        let peers: Arc<Mutex<HashMap<String, Peer>>> = Arc::default();

        let rx = daemon
            .browse(SERVICE_TYPE)
            .map_err(|e| format!("mdns browse: {e}"))?;
        let peers_for_thread = peers.clone();
        std::thread::spawn(move || {
            // rx.recv() blocks; the channel closes only when the daemon is
            // dropped, which happens at app shutdown. Logging at debug so the
            // happy path stays quiet.
            while let Ok(event) = rx.recv() {
                match event {
                    ServiceEvent::ServiceResolved(info) => {
                        let key = info.get_fullname().to_string();
                        let peer = service_info_to_peer(&info);
                        let mut map = peers_for_thread.lock().unwrap();
                        map.insert(key, peer);
                    }
                    ServiceEvent::ServiceRemoved(_, fullname) => {
                        let mut map = peers_for_thread.lock().unwrap();
                        map.remove(&fullname);
                    }
                    _ => {}
                }
            }
        });

        Ok(Arc::new(Self { daemon, peers }))
    }

    /// Snapshot the currently-resolved peers, sorted by label for stable UI.
    pub fn current(&self) -> Vec<Peer> {
        let map = self.peers.lock().unwrap();
        let mut out: Vec<Peer> = map.values().cloned().collect();
        out.sort_by(|a, b| a.label.cmp(&b.label));
        out
    }

    pub fn daemon(&self) -> &ServiceDaemon {
        &self.daemon
    }

    /// Drop our own announcement from the peers list so we don't see
    /// ourselves while LAN is on. Called by the server when it registers.
    pub fn hide_self(&self, fullname: &str) {
        self.peers.lock().unwrap().remove(fullname);
    }
}

fn service_info_to_peer(info: &ServiceInfo) -> Peer {
    let addresses: Vec<String> = info
        .get_addresses()
        .iter()
        .map(IpAddr::to_string)
        .collect();
    let host = info.get_hostname().trim_end_matches('.').to_string();
    let port = info.get_port();
    let preferred = info
        .get_addresses()
        .iter()
        .find(|a| matches!(a, IpAddr::V4(_)))
        .or_else(|| info.get_addresses().iter().next())
        .map(IpAddr::to_string)
        .unwrap_or_else(|| host.clone());
    let url = format!("http://{preferred}:{port}");
    let fullname = info.get_fullname().to_string();
    let label = fullname
        .strip_suffix(SERVICE_TYPE)
        .map(|s| s.trim_end_matches('.').to_string())
        .unwrap_or_else(|| fullname.clone());
    Peer {
        name: fullname,
        label,
        host,
        addresses,
        port,
        url,
    }
}

/// Announce this instance under `SERVICE_TYPE`. Returns the mDNS fullname,
/// which the caller stores so it can later `stop_announce` cleanly.
pub fn announce(
    daemon: &ServiceDaemon,
    instance: &str,
    hostname: &str,
    port: u16,
) -> Result<String, String> {
    let service_hostname = format!("{hostname}.local.");
    let info = ServiceInfo::new(
        SERVICE_TYPE,
        instance,
        &service_hostname,
        "", // addrs — let `enable_addr_auto` discover interfaces
        port,
        &[("version", env!("CARGO_PKG_VERSION"))][..],
    )
    .map_err(|e| format!("build service info: {e}"))?
    .enable_addr_auto();
    let fullname = info.get_fullname().to_string();
    daemon
        .register(info)
        .map_err(|e| format!("register mdns service: {e}"))?;
    Ok(fullname)
}

pub fn stop_announce(daemon: &ServiceDaemon, fullname: &str) {
    if let Ok(rx) = daemon.unregister(fullname) {
        // Drain so the daemon actually sends the goodbye packet before
        // returning, but cap the wait so a hung daemon doesn't block restart.
        let _ = rx.recv_timeout(std::time::Duration::from_millis(500));
    }
}

/// Best-effort device hostname. Shells out to `hostname` which exists on
/// macOS, Linux, and Windows. Falls back to "smart-organizer".
pub fn device_hostname() -> String {
    std::process::Command::new("hostname")
        .output()
        .ok()
        .and_then(|o| String::from_utf8(o.stdout).ok())
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
        // mDNS instance names should be DNS-safe-ish. Replace common offenders.
        .map(|s| s.replace(' ', "-").replace(['/', '\\', ':'], "-"))
        .unwrap_or_else(|| "smart-organizer".into())
}

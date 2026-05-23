//! Out-of-band pairing flow for trading the LAN bearer token without manual
//! copy/paste.
//!
//! Threat model: a 4-digit code shown on both screens lets the user spot
//! casual man-in-the-middle attacks — if A's screen and B's screen show
//! different numbers, someone is intercepting. Active MITM with a relay
//! that can mirror the screen state is out of scope; that would require a
//! proper authenticated key exchange (Signal-style SAS). For a friendly
//! LAN-sync app this trade-off is acceptable.
//!
//! Sessions live in memory and expire after `SESSION_TTL`. Anyone on the
//! same network can hit `/pair/initiate` and trigger a modal on the target
//! — the popup *is* the security gate; the user has to actively accept.

use std::collections::HashMap;
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};

use serde::{Deserialize, Serialize};
use ts_rs::TS;

use crate::domain::ids::new_id;

const SESSION_TTL_MS: u64 = 120_000; // 2 minutes

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../src/types/generated/")]
#[serde(rename_all = "lowercase")]
pub enum PairingStatus {
    Pending,
    Accepted,
    Rejected,
    Expired,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../src/types/generated/")]
#[serde(rename_all = "camelCase")]
pub struct PairingSession {
    pub session_id: String,
    pub code: String,
    pub status: PairingStatus,
    /// Free-form label sent by the requester (hostname etc.). Shown on B's
    /// accept-modal so the user knows who's asking.
    pub requester: String,
    #[ts(type = "number")]
    pub created_at: u64,
}

#[derive(Default)]
pub struct PendingPairings {
    sessions: Mutex<HashMap<String, PairingSession>>,
}

impl PendingPairings {
    /// Create a new session in `Pending` state and return its handle. Old
    /// expired sessions are pruned opportunistically so the map doesn't
    /// grow unbounded.
    pub fn initiate(&self, requester: &str) -> PairingSession {
        self.prune();
        let session = PairingSession {
            session_id: new_id(),
            code: random_code(),
            status: PairingStatus::Pending,
            requester: requester.to_string(),
            created_at: now_ms(),
        };
        self.sessions
            .lock()
            .unwrap()
            .insert(session.session_id.clone(), session.clone());
        session
    }

    /// Flip a Pending session to Accepted. No-op (returns false) if the
    /// session is gone, already resolved, or expired.
    pub fn accept(&self, session_id: &str) -> bool {
        self.flip(session_id, PairingStatus::Accepted)
    }

    pub fn reject(&self, session_id: &str) -> bool {
        self.flip(session_id, PairingStatus::Rejected)
    }

    fn flip(&self, session_id: &str, to: PairingStatus) -> bool {
        let mut map = self.sessions.lock().unwrap();
        let Some(session) = map.get_mut(session_id) else {
            return false;
        };
        if is_expired(session.created_at) {
            session.status = PairingStatus::Expired;
            return false;
        }
        if session.status != PairingStatus::Pending {
            return false;
        }
        session.status = to;
        true
    }

    /// Look up a session's current status. Marks it Expired in place if its
    /// TTL has elapsed so the poller sees a final state.
    pub fn status(&self, session_id: &str) -> Option<PairingStatus> {
        let mut map = self.sessions.lock().unwrap();
        let session = map.get_mut(session_id)?;
        if session.status == PairingStatus::Pending && is_expired(session.created_at) {
            session.status = PairingStatus::Expired;
        }
        Some(session.status)
    }

    /// Snapshot of all sessions that B's UI might want to show — Pending
    /// only, since accepted/rejected/expired are terminal and uninteresting
    /// for the responder UI.
    pub fn list_pending(&self) -> Vec<PairingSession> {
        self.prune();
        let map = self.sessions.lock().unwrap();
        let mut out: Vec<PairingSession> = map
            .values()
            .filter(|s| s.status == PairingStatus::Pending)
            .cloned()
            .collect();
        out.sort_by(|a, b| b.created_at.cmp(&a.created_at));
        out
    }

    /// Drop any sessions whose TTL has elapsed. Called on every mutating
    /// operation so we don't need a background timer.
    fn prune(&self) {
        let mut map = self.sessions.lock().unwrap();
        map.retain(|_, s| !is_expired(s.created_at));
    }
}

fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

fn is_expired(created_at: u64) -> bool {
    now_ms().saturating_sub(created_at) > SESSION_TTL_MS
}

/// 4 digits with leading zeros allowed. Uses the system RNG via getrandom
/// for a tiny bit of entropy — not security-critical (the code is shown
/// to the user, not used as a secret) but we still want unpredictable
/// numbers so an attacker can't guess.
fn random_code() -> String {
    use ring::rand::{SecureRandom, SystemRandom};
    let mut bytes = [0u8; 2];
    SystemRandom::new()
        .fill(&mut bytes)
        // Fall back to a millisecond-derived code if the RNG genuinely fails
        // — never observed in practice; keeps the API infallible.
        .unwrap_or_else(|_| bytes.copy_from_slice(&(now_ms() as u16).to_le_bytes()));
    let n = u16::from_le_bytes(bytes) % 10_000;
    format!("{n:04}")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn random_code_is_always_four_digits() {
        for _ in 0..200 {
            let c = random_code();
            assert_eq!(c.len(), 4);
            assert!(c.chars().all(|ch| ch.is_ascii_digit()));
        }
    }

    #[test]
    fn accept_flips_status() {
        let p = PendingPairings::default();
        let s = p.initiate("alice");
        assert_eq!(p.status(&s.session_id), Some(PairingStatus::Pending));
        assert!(p.accept(&s.session_id));
        assert_eq!(p.status(&s.session_id), Some(PairingStatus::Accepted));
    }

    #[test]
    fn cannot_accept_after_reject() {
        let p = PendingPairings::default();
        let s = p.initiate("alice");
        assert!(p.reject(&s.session_id));
        assert!(!p.accept(&s.session_id), "accept must be a no-op on rejected");
        assert_eq!(p.status(&s.session_id), Some(PairingStatus::Rejected));
    }

    #[test]
    fn unknown_session_returns_none() {
        let p = PendingPairings::default();
        assert_eq!(p.status("nope"), None);
        assert!(!p.accept("nope"));
    }

    #[test]
    fn list_pending_skips_resolved() {
        let p = PendingPairings::default();
        let a = p.initiate("alice");
        let _b = p.initiate("bob");
        p.accept(&a.session_id);
        let pending = p.list_pending();
        assert_eq!(pending.len(), 1);
        assert_eq!(pending[0].requester, "bob");
    }
}

CREATE TABLE device_identity (
    id              INTEGER PRIMARY KEY CHECK (id = 1),
    device_id       TEXT NOT NULL,
    device_name     TEXT NOT NULL,
    cert_pem        TEXT NOT NULL,
    key_pem         TEXT NOT NULL,
    created_at      TEXT NOT NULL
);

CREATE TABLE paired_peers (
    device_id           TEXT PRIMARY KEY,
    device_name         TEXT NOT NULL,
    cert_fingerprint    TEXT NOT NULL,
    psk                 BLOB NOT NULL,
    last_seen_at        TEXT,
    last_synced_at      TEXT
);

CREATE TABLE sync_log (
    seq             INTEGER PRIMARY KEY AUTOINCREMENT,
    table_name      TEXT NOT NULL,
    row_id          TEXT NOT NULL,
    updated_at      TEXT NOT NULL,
    origin_device   TEXT NOT NULL
);

CREATE INDEX idx_sync_log_updated ON sync_log(updated_at);
CREATE INDEX idx_sync_log_table_row ON sync_log(table_name, row_id);

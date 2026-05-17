CREATE TABLE notes (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    body TEXT NOT NULL DEFAULT '',
    body_format TEXT NOT NULL DEFAULT 'plaintext'
        CHECK (body_format IN ('markdown', 'plaintext', 'html', 'latex')),
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    deleted_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_notes_updated_at ON notes(updated_at);

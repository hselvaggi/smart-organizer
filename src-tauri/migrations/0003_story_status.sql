ALTER TABLE stories ADD COLUMN status TEXT NOT NULL DEFAULT 'todo'
    CHECK (status IN ('todo', 'in_progress', 'done', 'blocked', 'cancelled'));

CREATE INDEX IF NOT EXISTS idx_stories_status ON stories(status);

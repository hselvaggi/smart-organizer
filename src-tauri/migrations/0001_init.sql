PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;

CREATE TABLE projects (
    id                  TEXT PRIMARY KEY,
    parent_id           TEXT REFERENCES projects(id) ON DELETE CASCADE,
    title               TEXT NOT NULL,
    description         TEXT NOT NULL DEFAULT '',
    description_format  TEXT NOT NULL DEFAULT 'markdown'
                        CHECK (description_format IN ('markdown','plaintext','html','latex')),
    sort_order          INTEGER NOT NULL DEFAULT 0,
    created_at          TEXT NOT NULL,
    updated_at          TEXT NOT NULL,
    deleted_at          TEXT
);

CREATE INDEX idx_projects_parent ON projects(parent_id);
CREATE INDEX idx_projects_updated ON projects(updated_at);

CREATE TABLE stories (
    id                  TEXT PRIMARY KEY,
    project_id          TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    title               TEXT NOT NULL,
    description         TEXT NOT NULL DEFAULT '',
    description_format  TEXT NOT NULL DEFAULT 'markdown'
                        CHECK (description_format IN ('markdown','plaintext','html','latex')),
    sort_order          INTEGER NOT NULL DEFAULT 0,
    created_at          TEXT NOT NULL,
    updated_at          TEXT NOT NULL,
    deleted_at          TEXT
);

CREATE INDEX idx_stories_project ON stories(project_id);
CREATE INDEX idx_stories_updated ON stories(updated_at);

CREATE TABLE tasks (
    id                  TEXT PRIMARY KEY,
    story_id            TEXT NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
    parent_task_id      TEXT REFERENCES tasks(id) ON DELETE CASCADE,
    title               TEXT NOT NULL,
    description         TEXT NOT NULL DEFAULT '',
    description_format  TEXT NOT NULL DEFAULT 'markdown'
                        CHECK (description_format IN ('markdown','plaintext','html','latex')),
    result              TEXT NOT NULL DEFAULT '',
    result_format       TEXT NOT NULL DEFAULT 'markdown'
                        CHECK (result_format IN ('markdown','plaintext','html','latex')),
    status              TEXT NOT NULL DEFAULT 'todo'
                        CHECK (status IN ('todo','in_progress','done','blocked','cancelled')),
    sort_order          INTEGER NOT NULL DEFAULT 0,
    created_at          TEXT NOT NULL,
    updated_at          TEXT NOT NULL,
    deleted_at          TEXT
);

CREATE INDEX idx_tasks_story ON tasks(story_id);
CREATE INDEX idx_tasks_parent ON tasks(parent_task_id);
CREATE INDEX idx_tasks_updated ON tasks(updated_at);
CREATE INDEX idx_tasks_status ON tasks(status);

CREATE TABLE comments (
    id                  TEXT PRIMARY KEY,
    task_id             TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    body                TEXT NOT NULL,
    body_format         TEXT NOT NULL DEFAULT 'markdown'
                        CHECK (body_format IN ('markdown','plaintext','html','latex')),
    created_at          TEXT NOT NULL,
    updated_at          TEXT NOT NULL,
    deleted_at          TEXT
);

CREATE INDEX idx_comments_task ON comments(task_id);
CREATE INDEX idx_comments_updated ON comments(updated_at);

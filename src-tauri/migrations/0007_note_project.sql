ALTER TABLE notes ADD COLUMN project_id TEXT REFERENCES projects(id);
CREATE INDEX IF NOT EXISTS idx_notes_project_id ON notes(project_id);

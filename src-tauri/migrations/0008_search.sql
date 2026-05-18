-- Full-text search index across projects, stories, tasks, notes and comments.
-- The body column holds plain-text extracted from markdown/HTML/LaTeX (extraction
-- happens in Rust, so this table is regular rather than external-content).

CREATE VIRTUAL TABLE search_index USING fts5(
    kind         UNINDEXED,
    entity_id    UNINDEXED,
    project_id   UNINDEXED,
    story_id     UNINDEXED,
    task_id      UNINDEXED,
    title,
    body,
    tokenize = 'unicode61 remove_diacritics 2'
);

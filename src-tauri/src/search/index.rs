use std::collections::HashMap;

use sqlx::SqlitePool;

use crate::db;
use crate::domain::{Comment, Note, Project, Story, Task};
use crate::error::AppResult;
use crate::search::extract;

#[derive(Debug, Clone, Copy)]
pub enum EntityKind {
    Project,
    Story,
    Task,
    Note,
    Comment,
}

impl EntityKind {
    pub fn as_str(&self) -> &'static str {
        match self {
            EntityKind::Project => "project",
            EntityKind::Story => "story",
            EntityKind::Task => "task",
            EntityKind::Note => "note",
            EntityKind::Comment => "comment",
        }
    }
}

struct IndexEntry {
    kind: EntityKind,
    entity_id: String,
    project_id: Option<String>,
    story_id: Option<String>,
    task_id: Option<String>,
    title: String,
    body: String,
}

async fn upsert(pool: &SqlitePool, entry: IndexEntry) -> AppResult<()> {
    sqlx::query("DELETE FROM search_index WHERE kind = ?1 AND entity_id = ?2")
        .bind(entry.kind.as_str())
        .bind(&entry.entity_id)
        .execute(pool)
        .await?;
    sqlx::query(
        "INSERT INTO search_index
            (kind, entity_id, project_id, story_id, task_id, title, body)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
    )
    .bind(entry.kind.as_str())
    .bind(&entry.entity_id)
    .bind(&entry.project_id)
    .bind(&entry.story_id)
    .bind(&entry.task_id)
    .bind(&entry.title)
    .bind(&entry.body)
    .execute(pool)
    .await?;
    Ok(())
}

pub async fn remove(pool: &SqlitePool, kind: EntityKind, entity_id: &str) -> AppResult<()> {
    sqlx::query("DELETE FROM search_index WHERE kind = ?1 AND entity_id = ?2")
        .bind(kind.as_str())
        .bind(entity_id)
        .execute(pool)
        .await?;
    Ok(())
}

pub async fn index_project(pool: &SqlitePool, project: &Project) -> AppResult<()> {
    upsert(
        pool,
        IndexEntry {
            kind: EntityKind::Project,
            entity_id: project.id.clone(),
            project_id: Some(project.id.clone()),
            story_id: None,
            task_id: None,
            title: project.title.clone(),
            body: extract::extract(&project.description, project.description_format),
        },
    )
    .await
}

pub async fn index_story(pool: &SqlitePool, story: &Story) -> AppResult<()> {
    upsert(
        pool,
        IndexEntry {
            kind: EntityKind::Story,
            entity_id: story.id.clone(),
            project_id: Some(story.project_id.clone()),
            story_id: Some(story.id.clone()),
            task_id: None,
            title: story.title.clone(),
            body: extract::extract(&story.description, story.description_format),
        },
    )
    .await
}

pub async fn index_task(pool: &SqlitePool, task: &Task) -> AppResult<()> {
    let project_id: Option<String> =
        sqlx::query_scalar("SELECT project_id FROM stories WHERE id = ?1")
            .bind(&task.story_id)
            .fetch_optional(pool)
            .await?;
    upsert(pool, task_entry(task, project_id)).await
}

fn task_entry(task: &Task, project_id: Option<String>) -> IndexEntry {
    let mut body = extract::extract(&task.description, task.description_format);
    let res = extract::extract(&task.result, task.result_format);
    if !res.is_empty() {
        if !body.is_empty() {
            body.push('\n');
        }
        body.push_str(&res);
    }
    IndexEntry {
        kind: EntityKind::Task,
        entity_id: task.id.clone(),
        project_id,
        story_id: Some(task.story_id.clone()),
        task_id: Some(task.id.clone()),
        title: task.title.clone(),
        body,
    }
}

pub async fn index_note(pool: &SqlitePool, note: &Note) -> AppResult<()> {
    upsert(
        pool,
        IndexEntry {
            kind: EntityKind::Note,
            entity_id: note.id.clone(),
            project_id: note.project_id.clone(),
            story_id: None,
            task_id: None,
            title: note.title.clone(),
            body: extract::extract(&note.body, note.body_format),
        },
    )
    .await
}

pub async fn index_comment(pool: &SqlitePool, comment: &Comment) -> AppResult<()> {
    let row: Option<(String, String)> = sqlx::query_as(
        "SELECT s.project_id, t.story_id
           FROM tasks t
           JOIN stories s ON t.story_id = s.id
          WHERE t.id = ?1",
    )
    .bind(&comment.task_id)
    .fetch_optional(pool)
    .await?;
    let (project_id, story_id) = match row {
        Some((p, s)) => (Some(p), Some(s)),
        None => (None, None),
    };
    upsert(pool, comment_entry(comment, project_id, story_id)).await
}

fn comment_entry(
    comment: &Comment,
    project_id: Option<String>,
    story_id: Option<String>,
) -> IndexEntry {
    IndexEntry {
        kind: EntityKind::Comment,
        entity_id: comment.id.clone(),
        project_id,
        story_id,
        task_id: Some(comment.task_id.clone()),
        title: String::new(),
        body: extract::extract(&comment.body, comment.body_format),
    }
}

/// Wipe and repopulate the entire FTS table from the live source rows. Called
/// from `db::open_pool` on startup when the index is empty (first run after the
/// migration that introduces it).
///
/// Parent IDs are resolved through prefetched maps so the backfill stays O(N).
pub async fn reindex_all(pool: &SqlitePool) -> AppResult<()> {
    sqlx::query("DELETE FROM search_index")
        .execute(pool)
        .await?;

    let projects = sqlx::query_as::<_, Project>(&format!(
        "SELECT {} FROM projects WHERE deleted_at IS NULL",
        db::projects::COLS
    ))
    .fetch_all(pool)
    .await?;
    for project in &projects {
        index_project(pool, project).await?;
    }

    let stories = sqlx::query_as::<_, Story>(&format!(
        "SELECT {} FROM stories WHERE deleted_at IS NULL",
        db::stories::COLS
    ))
    .fetch_all(pool)
    .await?;
    let story_to_project: HashMap<String, String> = stories
        .iter()
        .map(|s| (s.id.clone(), s.project_id.clone()))
        .collect();
    for story in &stories {
        index_story(pool, story).await?;
    }

    let tasks = sqlx::query_as::<_, Task>(&format!(
        "SELECT {} FROM tasks WHERE deleted_at IS NULL",
        db::tasks::COLS
    ))
    .fetch_all(pool)
    .await?;
    let task_to_path: HashMap<String, (Option<String>, String)> = tasks
        .iter()
        .map(|t| {
            (
                t.id.clone(),
                (story_to_project.get(&t.story_id).cloned(), t.story_id.clone()),
            )
        })
        .collect();
    for task in &tasks {
        let project_id = story_to_project.get(&task.story_id).cloned();
        upsert(pool, task_entry(task, project_id)).await?;
    }

    let notes = sqlx::query_as::<_, Note>(&format!(
        "SELECT {} FROM notes WHERE deleted_at IS NULL",
        db::notes::COLS
    ))
    .fetch_all(pool)
    .await?;
    for note in &notes {
        index_note(pool, note).await?;
    }

    let comments = sqlx::query_as::<_, Comment>(&format!(
        "SELECT {} FROM comments WHERE deleted_at IS NULL",
        db::comments::COLS
    ))
    .fetch_all(pool)
    .await?;
    for comment in &comments {
        let (project_id, story_id) = task_to_path
            .get(&comment.task_id)
            .cloned()
            .map(|(p, s)| (p, Some(s)))
            .unwrap_or((None, None));
        upsert(pool, comment_entry(comment, project_id, story_id)).await?;
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::domain::TextFormat;
    use crate::search::query;
    use sqlx::sqlite::SqlitePoolOptions;
    use sqlx::SqlitePool;

    async fn setup() -> SqlitePool {
        let pool = SqlitePoolOptions::new()
            .max_connections(1)
            .connect("sqlite::memory:")
            .await
            .unwrap();
        sqlx::migrate!("./migrations").run(&pool).await.unwrap();
        pool
    }

    fn proj(id: &str, title: &str, desc: &str) -> Project {
        Project {
            id: id.into(),
            title: title.into(),
            description: desc.into(),
            description_format: TextFormat::Plaintext,
            sort_order: 0,
            created_at: "2026-01-01T00:00:00Z".into(),
            updated_at: "2026-01-01T00:00:00Z".into(),
            deleted_at: None,
        }
    }

    #[tokio::test]
    async fn search_returns_indexed_project() {
        let pool = setup().await;
        index_project(&pool, &proj("p1", "Migration plan", "Database rollout"))
            .await
            .unwrap();
        let hits = query::search(&pool, "migration", 10).await.unwrap();
        assert_eq!(hits.len(), 1);
        assert_eq!(hits[0].kind, "project");
        assert_eq!(hits[0].entity_id, "p1");
    }

    #[tokio::test]
    async fn title_outranks_body() {
        let pool = setup().await;
        // p1 only mentions "rust" in the body; p2 has it in the title.
        index_project(&pool, &proj("p1", "Onboarding", "Some rust details here"))
            .await
            .unwrap();
        index_project(&pool, &proj("p2", "Rust compiler upgrade", "Notes"))
            .await
            .unwrap();
        let hits = query::search(&pool, "rust", 10).await.unwrap();
        assert!(hits.len() >= 2);
        assert_eq!(hits[0].entity_id, "p2", "title match should rank first");
    }

    #[tokio::test]
    async fn diacritics_insensitive() {
        let pool = setup().await;
        index_project(&pool, &proj("p1", "Fórmula química", "Notas"))
            .await
            .unwrap();
        let hits = query::search(&pool, "formula", 10).await.unwrap();
        assert_eq!(hits.len(), 1);
        let hits = query::search(&pool, "química", 10).await.unwrap();
        assert_eq!(hits.len(), 1);
    }

    #[tokio::test]
    async fn remove_drops_hit() {
        let pool = setup().await;
        index_project(&pool, &proj("p1", "Removable", "Body"))
            .await
            .unwrap();
        assert_eq!(query::search(&pool, "removable", 10).await.unwrap().len(), 1);
        remove(&pool, EntityKind::Project, "p1").await.unwrap();
        assert_eq!(query::search(&pool, "removable", 10).await.unwrap().len(), 0);
    }

    #[tokio::test]
    async fn reindex_all_repopulates_after_wipe() {
        let pool = setup().await;
        // Seed three projects through the normal write path.
        for (i, t) in ["alpha plan", "beta plan", "gamma plan"].iter().enumerate() {
            index_project(&pool, &proj(&format!("p{i}"), t, ""))
                .await
                .unwrap();
        }
        // We have to mirror them in the actual `projects` table so reindex_all sees them.
        for (i, t) in ["alpha plan", "beta plan", "gamma plan"].iter().enumerate() {
            sqlx::query(
                "INSERT INTO projects (id, title, description, description_format,
                                       sort_order, created_at, updated_at)
                 VALUES (?1, ?2, '', 'plaintext', 0, '2026-01-01', '2026-01-01')",
            )
            .bind(format!("p{i}"))
            .bind(t)
            .execute(&pool)
            .await
            .unwrap();
        }
        // Wipe the FTS table and re-run the backfill.
        sqlx::query("DELETE FROM search_index").execute(&pool).await.unwrap();
        assert_eq!(query::search(&pool, "plan", 10).await.unwrap().len(), 0);

        reindex_all(&pool).await.unwrap();
        assert_eq!(query::search(&pool, "plan", 10).await.unwrap().len(), 3);
    }

    #[tokio::test]
    async fn prefix_matches() {
        let pool = setup().await;
        index_project(&pool, &proj("p1", "Authentication rewrite", "scope"))
            .await
            .unwrap();
        let hits = query::search(&pool, "auth", 10).await.unwrap();
        assert_eq!(hits.len(), 1);
    }
}


use sqlx::{QueryBuilder, Sqlite, SqlitePool};

use crate::domain::ids::{new_id, now_iso};
use crate::domain::{NewProject, Project, UpdateProject};
use crate::error::{AppError, AppResult};
use crate::search;

pub(crate) const COLS: &str = "id, title, description, description_format,
                               sort_order, created_at, updated_at, deleted_at";

pub async fn list_all(pool: &SqlitePool) -> AppResult<Vec<Project>> {
    let rows = sqlx::query_as::<_, Project>(&format!(
        "SELECT {COLS}
         FROM projects
         WHERE deleted_at IS NULL
         ORDER BY sort_order, created_at"
    ))
    .fetch_all(pool)
    .await?;
    Ok(rows)
}

pub async fn get(pool: &SqlitePool, id: &str) -> AppResult<Option<Project>> {
    let row = sqlx::query_as::<_, Project>(&format!(
        "SELECT {COLS}
         FROM projects
         WHERE id = ?1 AND deleted_at IS NULL"
    ))
    .bind(id)
    .fetch_optional(pool)
    .await?;
    Ok(row)
}

pub async fn create(pool: &SqlitePool, input: NewProject) -> AppResult<Project> {
    let id = new_id();
    let now = now_iso();
    let next_order: i64 =
        sqlx::query_scalar("SELECT COALESCE(MAX(sort_order), -1) + 1 FROM projects")
            .fetch_one(pool)
            .await?;

    sqlx::query(
        "INSERT INTO projects
            (id, title, description, description_format,
             sort_order, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?6)",
    )
    .bind(&id)
    .bind(&input.title)
    .bind(&input.description)
    .bind(input.description_format)
    .bind(next_order)
    .bind(&now)
    .execute(pool)
    .await?;

    let project = get(pool, &id)
        .await?
        .ok_or_else(|| AppError::Missing("project missing after insert"))?;
    search::index_project(pool, &project).await?;
    Ok(project)
}

pub async fn update(pool: &SqlitePool, input: UpdateProject) -> AppResult<Project> {
    let now = now_iso();
    let mut qb: QueryBuilder<Sqlite> = QueryBuilder::new("UPDATE projects SET ");
    let mut has_any = false;
    {
        let mut sep = qb.separated(", ");
        if let Some(ref title) = input.title {
            sep.push("title = ").push_bind_unseparated(title);
            has_any = true;
        }
        if let Some(ref description) = input.description {
            sep.push("description = ").push_bind_unseparated(description);
            has_any = true;
        }
        if let Some(fmt) = input.description_format {
            sep.push("description_format = ").push_bind_unseparated(fmt);
            has_any = true;
        }
        if has_any {
            sep.push("updated_at = ").push_bind_unseparated(&now);
        }
    }

    if has_any {
        qb.push(" WHERE id = ").push_bind(&input.id);
        qb.build().execute(pool).await?;
    }

    let project = get(pool, &input.id)
        .await?
        .ok_or_else(|| AppError::Missing("project missing after update"))?;
    search::index_project(pool, &project).await?;
    Ok(project)
}

/// Insert a project verbatim (preserving id + timestamps) coming from a peer.
/// Returns `true` if a new row was inserted, `false` if the id already exists
/// locally (in which case the local copy — including any local edits or
/// soft-delete — is preserved).
pub async fn insert_raw(pool: &SqlitePool, p: &Project) -> AppResult<bool> {
    let res = sqlx::query(
        "INSERT INTO projects
            (id, title, description, description_format, sort_order,
             created_at, updated_at, deleted_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
         ON CONFLICT(id) DO NOTHING",
    )
    .bind(&p.id)
    .bind(&p.title)
    .bind(&p.description)
    .bind(p.description_format)
    .bind(p.sort_order)
    .bind(&p.created_at)
    .bind(&p.updated_at)
    .bind(&p.deleted_at)
    .execute(pool)
    .await?;
    let inserted = res.rows_affected() > 0;
    if inserted && p.deleted_at.is_none() {
        search::index_project(pool, p).await?;
    }
    Ok(inserted)
}

pub async fn soft_delete(pool: &SqlitePool, id: &str) -> AppResult<()> {
    // Soft-delete cascades by hand because the FK ON DELETE CASCADE only fires
    // for hard deletes. Without this, deleting a project would leave its
    // stories/tasks/notes/comments alive (and findable in search).
    let now = now_iso();
    let mut tx = pool.begin().await?;

    // Comments under tasks under stories of this project.
    sqlx::query(
        "UPDATE comments SET deleted_at = ?2, updated_at = ?2
         WHERE deleted_at IS NULL AND task_id IN (
             SELECT id FROM tasks WHERE story_id IN (
                 SELECT id FROM stories WHERE project_id = ?1
             )
         )",
    )
    .bind(id)
    .bind(&now)
    .execute(&mut *tx)
    .await?;

    // Tasks (top-level and all subtask levels, since every task carries
    // story_id pointing at its root story).
    sqlx::query(
        "UPDATE tasks SET deleted_at = ?2, updated_at = ?2
         WHERE deleted_at IS NULL AND story_id IN (
             SELECT id FROM stories WHERE project_id = ?1
         )",
    )
    .bind(id)
    .bind(&now)
    .execute(&mut *tx)
    .await?;

    // Stories.
    sqlx::query(
        "UPDATE stories SET deleted_at = ?2, updated_at = ?2
         WHERE deleted_at IS NULL AND project_id = ?1",
    )
    .bind(id)
    .bind(&now)
    .execute(&mut *tx)
    .await?;

    // Notes attached to this project.
    sqlx::query(
        "UPDATE notes SET deleted_at = ?2, updated_at = ?2
         WHERE deleted_at IS NULL AND project_id = ?1",
    )
    .bind(id)
    .bind(&now)
    .execute(&mut *tx)
    .await?;

    // The project itself.
    sqlx::query(
        "UPDATE projects SET deleted_at = ?2, updated_at = ?2
         WHERE deleted_at IS NULL AND id = ?1",
    )
    .bind(id)
    .bind(&now)
    .execute(&mut *tx)
    .await?;

    // Drop every search index entry for the subtree. Bypasses search::remove
    // (which is per-entity) for one bulk DELETE — the IN subqueries grab all
    // affected rows whether or not they were just soft-deleted.
    sqlx::query(
        "DELETE FROM search_index WHERE
            (kind = 'project' AND entity_id = ?1)
            OR (kind = 'note' AND entity_id IN (
                SELECT id FROM notes WHERE project_id = ?1
            ))
            OR (kind = 'story' AND entity_id IN (
                SELECT id FROM stories WHERE project_id = ?1
            ))
            OR (kind = 'task' AND entity_id IN (
                SELECT id FROM tasks WHERE story_id IN (
                    SELECT id FROM stories WHERE project_id = ?1
                )
            ))
            OR (kind = 'comment' AND entity_id IN (
                SELECT id FROM comments WHERE task_id IN (
                    SELECT id FROM tasks WHERE story_id IN (
                        SELECT id FROM stories WHERE project_id = ?1
                    )
                )
            ))",
    )
    .bind(id)
    .execute(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::test_support::pool;
    use crate::domain::TextFormat;

    fn new_input(title: &str) -> NewProject {
        NewProject {
            title: title.into(),
            description: String::new(),
            description_format: TextFormat::default(),
        }
    }

    fn blank_update(id: String) -> UpdateProject {
        UpdateProject {
            id,
            title: None,
            description: None,
            description_format: None,
        }
    }

    #[tokio::test]
    async fn create_then_get_round_trip() {
        let p = pool().await;
        let created = create(&p, new_input("hello")).await.unwrap();
        assert_eq!(created.title, "hello");
        let fetched = get(&p, &created.id).await.unwrap().unwrap();
        assert_eq!(fetched.id, created.id);
    }

    #[tokio::test]
    async fn update_single_field_leaves_others_alone() {
        let p = pool().await;
        let created = create(
            &p,
            NewProject {
                title: "orig".into(),
                description: "untouched".into(),
                description_format: TextFormat::Plaintext,
            },
        )
        .await
        .unwrap();
        let updated = update(
            &p,
            UpdateProject {
                title: Some("renamed".into()),
                ..blank_update(created.id.clone())
            },
        )
        .await
        .unwrap();
        assert_eq!(updated.title, "renamed");
        assert_eq!(updated.description, "untouched");
        assert_eq!(updated.description_format, TextFormat::Plaintext);
    }

    #[tokio::test]
    async fn update_multiple_fields_in_one_statement() {
        let p = pool().await;
        let created = create(&p, new_input("orig")).await.unwrap();
        let updated = update(
            &p,
            UpdateProject {
                id: created.id.clone(),
                title: Some("new".into()),
                description: Some("desc".into()),
                description_format: Some(TextFormat::Markdown),
            },
        )
        .await
        .unwrap();
        assert_eq!(updated.title, "new");
        assert_eq!(updated.description, "desc");
        assert_eq!(updated.description_format, TextFormat::Markdown);
    }

    #[tokio::test]
    async fn empty_update_is_noop_and_keeps_updated_at() {
        let p = pool().await;
        let created = create(&p, new_input("x")).await.unwrap();
        let updated = update(&p, blank_update(created.id.clone())).await.unwrap();
        assert_eq!(updated.title, "x");
        assert_eq!(updated.updated_at, created.updated_at);
    }

    #[tokio::test]
    async fn soft_delete_hides_from_list() {
        let p = pool().await;
        let a = create(&p, new_input("a")).await.unwrap();
        let _b = create(&p, new_input("b")).await.unwrap();
        soft_delete(&p, &a.id).await.unwrap();
        let list = list_all(&p).await.unwrap();
        assert_eq!(list.len(), 1);
        assert_eq!(list[0].title, "b");
        assert!(get(&p, &a.id).await.unwrap().is_none());
    }

    #[tokio::test]
    async fn soft_delete_cascades_to_full_subtree() {
        use crate::db::{comments, notes, stories, tasks};
        use crate::domain::{NewComment, NewNote, NewStory, NewTask};

        let p = pool().await;
        let project = create(&p, new_input("proj")).await.unwrap();

        let story = stories::create(
            &p,
            NewStory {
                project_id: project.id.clone(),
                title: "story".into(),
                description: String::new(),
                description_format: TextFormat::default(),
            },
        )
        .await
        .unwrap();

        let task = tasks::create(
            &p,
            NewTask {
                story_id: story.id.clone(),
                title: "task".into(),
                parent_task_id: None,
                description: String::new(),
                description_format: TextFormat::default(),
            },
        )
        .await
        .unwrap();

        let subtask = tasks::create(
            &p,
            NewTask {
                story_id: story.id.clone(),
                title: "subtask".into(),
                parent_task_id: Some(task.id.clone()),
                description: String::new(),
                description_format: TextFormat::default(),
            },
        )
        .await
        .unwrap();

        let comment = comments::create(
            &p,
            NewComment {
                task_id: subtask.id.clone(),
                body: "hi".into(),
                body_format: TextFormat::default(),
            },
        )
        .await
        .unwrap();

        let note = notes::create(
            &p,
            NewNote {
                title: "n".into(),
                project_id: Some(project.id.clone()),
                body: String::new(),
                body_format: TextFormat::default(),
            },
        )
        .await
        .unwrap();

        soft_delete(&p, &project.id).await.unwrap();

        // Every descendant is now invisible via its normal accessor.
        assert!(get(&p, &project.id).await.unwrap().is_none());
        assert!(stories::get(&p, &story.id).await.unwrap().is_none());
        assert!(tasks::get(&p, &task.id).await.unwrap().is_none());
        assert!(tasks::get(&p, &subtask.id).await.unwrap().is_none());
        assert!(notes::get(&p, &note.id).await.unwrap().is_none());
        // Comments don't have a public `get`; verify via list_for_task on the
        // (now-deleted) subtask — should be empty since the soft-delete cascade
        // also reached comments.
        let task_comments = comments::list_for_task(&p, &subtask.id).await.unwrap();
        assert!(task_comments.is_empty(), "expected comment {} to be cascaded", comment.id);

        // Search index has no rows for anything in the subtree.
        let remaining: i64 =
            sqlx::query_scalar("SELECT COUNT(*) FROM search_index")
                .fetch_one(&p)
                .await
                .unwrap();
        assert_eq!(remaining, 0, "search_index should be empty after cascade");
    }
}

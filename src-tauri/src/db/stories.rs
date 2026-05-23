use sqlx::{QueryBuilder, Sqlite, SqlitePool};

use crate::domain::ids::{new_id, now_iso};
use crate::domain::{NewStory, Story, UpdateStory};
use crate::error::{AppError, AppResult};
use crate::search;

pub(crate) const COLS: &str = "id, project_id, title, description, description_format, status,
                               sort_order, created_at, updated_at, deleted_at,
                               started_at, completed_at, due_date";

pub async fn list_for_project(pool: &SqlitePool, project_id: &str) -> AppResult<Vec<Story>> {
    let rows = sqlx::query_as::<_, Story>(&format!(
        "SELECT {COLS}
         FROM stories
         WHERE project_id = ?1 AND deleted_at IS NULL
         ORDER BY sort_order, created_at"
    ))
    .bind(project_id)
    .fetch_all(pool)
    .await?;
    Ok(rows)
}

pub async fn get(pool: &SqlitePool, id: &str) -> AppResult<Option<Story>> {
    let row = sqlx::query_as::<_, Story>(&format!(
        "SELECT {COLS}
         FROM stories
         WHERE id = ?1 AND deleted_at IS NULL"
    ))
    .bind(id)
    .fetch_optional(pool)
    .await?;
    Ok(row)
}

pub async fn create(pool: &SqlitePool, input: NewStory) -> AppResult<Story> {
    let id = new_id();
    let now = now_iso();
    let next_order: i64 = sqlx::query_scalar(
        "SELECT COALESCE(MAX(sort_order), -1) + 1 FROM stories WHERE project_id = ?1",
    )
    .bind(&input.project_id)
    .fetch_one(pool)
    .await?;

    sqlx::query(
        "INSERT INTO stories
            (id, project_id, title, description, description_format,
             sort_order, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?7)",
    )
    .bind(&id)
    .bind(&input.project_id)
    .bind(&input.title)
    .bind(&input.description)
    .bind(input.description_format)
    .bind(next_order)
    .bind(&now)
    .execute(pool)
    .await?;

    let story = get(pool, &id)
        .await?
        .ok_or_else(|| AppError::Missing("story missing after insert"))?;
    search::index_story(pool, &story).await?;
    Ok(story)
}

pub async fn update(pool: &SqlitePool, input: UpdateStory) -> AppResult<Story> {
    let now = now_iso();
    let mut qb: QueryBuilder<Sqlite> = QueryBuilder::new("UPDATE stories SET ");
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
        if let Some(status) = input.status {
            sep.push("status = ").push_bind_unseparated(status);
            sep.push("started_at = CASE WHEN ")
                .push_bind_unseparated(status)
                .push_unseparated(" = 'in_progress' AND started_at IS NULL THEN ")
                .push_bind_unseparated(&now)
                .push_unseparated(" ELSE started_at END");
            sep.push("completed_at = CASE WHEN ")
                .push_bind_unseparated(status)
                .push_unseparated(" = 'done' AND completed_at IS NULL THEN ")
                .push_bind_unseparated(&now)
                .push_unseparated(" ELSE completed_at END");
            has_any = true;
        }
        if let Some(due) = input.due_date {
            sep.push("due_date = ").push_bind_unseparated(due);
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

    let story = get(pool, &input.id)
        .await?
        .ok_or_else(|| AppError::Missing("story missing after update"))?;
    search::index_story(pool, &story).await?;
    Ok(story)
}

/// Insert a story verbatim from a peer. See `projects::insert_raw` for
/// semantics.
pub async fn insert_raw(pool: &SqlitePool, s: &Story) -> AppResult<bool> {
    let res = sqlx::query(
        "INSERT INTO stories
            (id, project_id, title, description, description_format, status,
             sort_order, created_at, updated_at, deleted_at,
             started_at, completed_at, due_date)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)
         ON CONFLICT(id) DO NOTHING",
    )
    .bind(&s.id)
    .bind(&s.project_id)
    .bind(&s.title)
    .bind(&s.description)
    .bind(s.description_format)
    .bind(s.status)
    .bind(s.sort_order)
    .bind(&s.created_at)
    .bind(&s.updated_at)
    .bind(&s.deleted_at)
    .bind(&s.started_at)
    .bind(&s.completed_at)
    .bind(&s.due_date)
    .execute(pool)
    .await?;
    let inserted = res.rows_affected() > 0;
    if inserted && s.deleted_at.is_none() {
        search::index_story(pool, s).await?;
    }
    Ok(inserted)
}

pub async fn soft_delete(pool: &SqlitePool, id: &str) -> AppResult<()> {
    // Soft-delete cascades by hand because FK ON DELETE CASCADE only fires for
    // hard deletes. See db::projects::soft_delete for the same pattern.
    let now = now_iso();
    let mut tx = pool.begin().await?;

    // Comments under tasks of this story.
    sqlx::query(
        "UPDATE comments SET deleted_at = ?2, updated_at = ?2
         WHERE deleted_at IS NULL AND task_id IN (
             SELECT id FROM tasks WHERE story_id = ?1
         )",
    )
    .bind(id)
    .bind(&now)
    .execute(&mut *tx)
    .await?;

    // Tasks at any nesting level (story_id is set on every task, even subtasks).
    sqlx::query(
        "UPDATE tasks SET deleted_at = ?2, updated_at = ?2
         WHERE deleted_at IS NULL AND story_id = ?1",
    )
    .bind(id)
    .bind(&now)
    .execute(&mut *tx)
    .await?;

    // The story itself.
    sqlx::query(
        "UPDATE stories SET deleted_at = ?2, updated_at = ?2
         WHERE deleted_at IS NULL AND id = ?1",
    )
    .bind(id)
    .bind(&now)
    .execute(&mut *tx)
    .await?;

    // Search index cleanup.
    sqlx::query(
        "DELETE FROM search_index WHERE
            (kind = 'story' AND entity_id = ?1)
            OR (kind = 'task' AND entity_id IN (
                SELECT id FROM tasks WHERE story_id = ?1
            ))
            OR (kind = 'comment' AND entity_id IN (
                SELECT id FROM comments WHERE task_id IN (
                    SELECT id FROM tasks WHERE story_id = ?1
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
    use crate::db::projects;
    use crate::db::test_support::pool;
    use crate::domain::{NewProject, TaskStatus, TextFormat};

    async fn project(p: &SqlitePool) -> String {
        projects::create(
            p,
            NewProject {
                title: "P".into(),
                description: String::new(),
                description_format: TextFormat::default(),
            },
        )
        .await
        .unwrap()
        .id
    }

    fn new_story(project_id: String, title: &str) -> NewStory {
        NewStory {
            project_id,
            title: title.into(),
            description: String::new(),
            description_format: TextFormat::default(),
        }
    }

    fn blank_update(id: String) -> UpdateStory {
        UpdateStory {
            id,
            title: None,
            description: None,
            description_format: None,
            status: None,
            due_date: None,
        }
    }

    #[tokio::test]
    async fn defaults_to_todo_with_no_timestamps() {
        let p = pool().await;
        let pid = project(&p).await;
        let s = create(&p, new_story(pid, "x")).await.unwrap();
        assert_eq!(s.status, TaskStatus::Todo);
        assert!(s.started_at.is_none());
        assert!(s.completed_at.is_none());
    }

    #[tokio::test]
    async fn status_in_progress_sets_started_at() {
        let p = pool().await;
        let pid = project(&p).await;
        let s = create(&p, new_story(pid, "x")).await.unwrap();
        let updated = update(
            &p,
            UpdateStory {
                status: Some(TaskStatus::InProgress),
                ..blank_update(s.id.clone())
            },
        )
        .await
        .unwrap();
        assert_eq!(updated.status, TaskStatus::InProgress);
        assert!(updated.started_at.is_some());
        assert!(updated.completed_at.is_none());
    }

    #[tokio::test]
    async fn status_done_sets_completed_at_and_preserves_started_at() {
        let p = pool().await;
        let pid = project(&p).await;
        let s = create(&p, new_story(pid, "x")).await.unwrap();
        let started = update(
            &p,
            UpdateStory {
                status: Some(TaskStatus::InProgress),
                ..blank_update(s.id.clone())
            },
        )
        .await
        .unwrap();
        let started_ts = started.started_at.clone().unwrap();

        let done = update(
            &p,
            UpdateStory {
                status: Some(TaskStatus::Done),
                ..blank_update(s.id.clone())
            },
        )
        .await
        .unwrap();
        assert_eq!(done.status, TaskStatus::Done);
        assert!(done.completed_at.is_some());
        assert_eq!(done.started_at, Some(started_ts));
    }

    #[tokio::test]
    async fn update_title_and_status_in_one_statement() {
        let p = pool().await;
        let pid = project(&p).await;
        let s = create(&p, new_story(pid, "orig")).await.unwrap();
        let updated = update(
            &p,
            UpdateStory {
                title: Some("renamed".into()),
                status: Some(TaskStatus::InProgress),
                ..blank_update(s.id.clone())
            },
        )
        .await
        .unwrap();
        assert_eq!(updated.title, "renamed");
        assert_eq!(updated.status, TaskStatus::InProgress);
        assert!(updated.started_at.is_some());
    }

    #[tokio::test]
    async fn due_date_set_then_cleared() {
        let p = pool().await;
        let pid = project(&p).await;
        let s = create(&p, new_story(pid, "x")).await.unwrap();
        let with_date = update(
            &p,
            UpdateStory {
                due_date: Some(Some("2026-06-01".into())),
                ..blank_update(s.id.clone())
            },
        )
        .await
        .unwrap();
        assert_eq!(with_date.due_date.as_deref(), Some("2026-06-01"));

        let cleared = update(
            &p,
            UpdateStory {
                due_date: Some(None),
                ..blank_update(s.id.clone())
            },
        )
        .await
        .unwrap();
        assert!(cleared.due_date.is_none());
    }

    #[tokio::test]
    async fn empty_update_is_noop_and_keeps_updated_at() {
        let p = pool().await;
        let pid = project(&p).await;
        let s = create(&p, new_story(pid, "x")).await.unwrap();
        let updated = update(&p, blank_update(s.id.clone())).await.unwrap();
        assert_eq!(updated.updated_at, s.updated_at);
    }

    #[tokio::test]
    async fn soft_delete_cascades_to_tasks_subtasks_and_comments() {
        use crate::db::{comments, tasks};
        use crate::domain::{NewComment, NewTask};

        let p = pool().await;
        let pid = project(&p).await;
        let s = create(&p, new_story(pid, "story")).await.unwrap();

        let task = tasks::create(
            &p,
            NewTask {
                story_id: s.id.clone(),
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
                story_id: s.id.clone(),
                title: "sub".into(),
                parent_task_id: Some(task.id.clone()),
                description: String::new(),
                description_format: TextFormat::default(),
            },
        )
        .await
        .unwrap();

        let _comment = comments::create(
            &p,
            NewComment {
                task_id: subtask.id.clone(),
                body: "c".into(),
                body_format: TextFormat::default(),
            },
        )
        .await
        .unwrap();

        soft_delete(&p, &s.id).await.unwrap();

        assert!(get(&p, &s.id).await.unwrap().is_none());
        assert!(tasks::get(&p, &task.id).await.unwrap().is_none());
        assert!(tasks::get(&p, &subtask.id).await.unwrap().is_none());
        assert!(comments::list_for_task(&p, &subtask.id)
            .await
            .unwrap()
            .is_empty());

        let remaining: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM search_index WHERE kind IN ('story','task','comment')",
        )
        .fetch_one(&p)
        .await
        .unwrap();
        assert_eq!(remaining, 0);
    }
}

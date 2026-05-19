use sqlx::{QueryBuilder, Sqlite, SqlitePool};

use crate::domain::ids::{new_id, now_iso};
use crate::domain::{NewTask, Task, UpdateTask};
use crate::error::{AppError, AppResult};
use crate::search;

pub(crate) const COLS: &str = "id, story_id, parent_task_id, title, description, description_format,
                               result, result_format, status, sort_order, created_at, updated_at, deleted_at,
                               started_at, completed_at, due_date";

const COLS_T: &str = "t.id, t.story_id, t.parent_task_id, t.title, t.description, t.description_format,
                      t.result, t.result_format, t.status, t.sort_order, t.created_at, t.updated_at, t.deleted_at,
                      t.started_at, t.completed_at, t.due_date";

pub async fn list_for_story(pool: &SqlitePool, story_id: &str) -> AppResult<Vec<Task>> {
    let rows = sqlx::query_as::<_, Task>(&format!(
        "SELECT {COLS}
         FROM tasks
         WHERE story_id = ?1 AND deleted_at IS NULL
         ORDER BY sort_order, created_at"
    ))
    .bind(story_id)
    .fetch_all(pool)
    .await?;
    Ok(rows)
}

pub async fn list_for_project(pool: &SqlitePool, project_id: &str) -> AppResult<Vec<Task>> {
    let rows = sqlx::query_as::<_, Task>(&format!(
        "SELECT {COLS_T}
         FROM tasks t
         JOIN stories s ON t.story_id = s.id
         WHERE s.project_id = ?1 AND t.deleted_at IS NULL AND s.deleted_at IS NULL
         ORDER BY t.sort_order, t.created_at"
    ))
    .bind(project_id)
    .fetch_all(pool)
    .await?;
    Ok(rows)
}

pub async fn get(pool: &SqlitePool, id: &str) -> AppResult<Option<Task>> {
    let row = sqlx::query_as::<_, Task>(&format!(
        "SELECT {COLS}
         FROM tasks
         WHERE id = ?1 AND deleted_at IS NULL"
    ))
    .bind(id)
    .fetch_optional(pool)
    .await?;
    Ok(row)
}

pub async fn create(pool: &SqlitePool, input: NewTask) -> AppResult<Task> {
    let id = new_id();
    let now = now_iso();
    let next_order: i64 = sqlx::query_scalar(
        "SELECT COALESCE(MAX(sort_order), -1) + 1 FROM tasks
         WHERE story_id = ?1 AND parent_task_id IS ?2",
    )
    .bind(&input.story_id)
    .bind(&input.parent_task_id)
    .fetch_one(pool)
    .await?;

    sqlx::query(
        "INSERT INTO tasks
            (id, story_id, parent_task_id, title, description, description_format,
             sort_order, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?8)",
    )
    .bind(&id)
    .bind(&input.story_id)
    .bind(&input.parent_task_id)
    .bind(&input.title)
    .bind(&input.description)
    .bind(input.description_format)
    .bind(next_order)
    .bind(&now)
    .execute(pool)
    .await?;

    let task = get(pool, &id)
        .await?
        .ok_or_else(|| AppError::Missing("task missing after insert"))?;
    search::index_task(pool, &task).await?;
    Ok(task)
}

pub async fn update(pool: &SqlitePool, input: UpdateTask) -> AppResult<Task> {
    let now = now_iso();
    let mut qb: QueryBuilder<Sqlite> = QueryBuilder::new("UPDATE tasks SET ");
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
        if let Some(ref result) = input.result {
            sep.push("result = ").push_bind_unseparated(result);
            has_any = true;
        }
        if let Some(fmt) = input.result_format {
            sep.push("result_format = ").push_bind_unseparated(fmt);
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
        if let Some(parent) = input.parent_task_id {
            sep.push("parent_task_id = ").push_bind_unseparated(parent);
            has_any = true;
        }
        if let Some(order) = input.sort_order {
            sep.push("sort_order = ").push_bind_unseparated(order);
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

    let task = get(pool, &input.id)
        .await?
        .ok_or_else(|| AppError::Missing("task missing after update"))?;
    search::index_task(pool, &task).await?;
    Ok(task)
}

pub async fn soft_delete(pool: &SqlitePool, id: &str) -> AppResult<()> {
    // Soft-delete cascades by hand. Tasks need WITH RECURSIVE because a subtask
    // tree is linked via parent_task_id (not story_id) for nesting deeper than
    // one level.
    let now = now_iso();
    let mut tx = pool.begin().await?;

    // Comments under the task and all its descendants.
    sqlx::query(
        "WITH RECURSIVE descendants(id) AS (
             SELECT id FROM tasks WHERE id = ?1
             UNION
             SELECT t.id FROM tasks t JOIN descendants d ON t.parent_task_id = d.id
         )
         UPDATE comments SET deleted_at = ?2, updated_at = ?2
         WHERE deleted_at IS NULL AND task_id IN (SELECT id FROM descendants)",
    )
    .bind(id)
    .bind(&now)
    .execute(&mut *tx)
    .await?;

    // The task and all its descendant subtasks.
    sqlx::query(
        "WITH RECURSIVE descendants(id) AS (
             SELECT id FROM tasks WHERE id = ?1
             UNION
             SELECT t.id FROM tasks t JOIN descendants d ON t.parent_task_id = d.id
         )
         UPDATE tasks SET deleted_at = ?2, updated_at = ?2
         WHERE deleted_at IS NULL AND id IN (SELECT id FROM descendants)",
    )
    .bind(id)
    .bind(&now)
    .execute(&mut *tx)
    .await?;

    // Search index cleanup for the whole subtree.
    sqlx::query(
        "WITH RECURSIVE descendants(id) AS (
             SELECT id FROM tasks WHERE id = ?1
             UNION
             SELECT t.id FROM tasks t JOIN descendants d ON t.parent_task_id = d.id
         )
         DELETE FROM search_index WHERE
             (kind = 'task' AND entity_id IN (SELECT id FROM descendants))
             OR (kind = 'comment' AND entity_id IN (
                 SELECT id FROM comments WHERE task_id IN (SELECT id FROM descendants)
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
    use crate::db::{projects, stories};
    use crate::db::test_support::pool;
    use crate::domain::{NewProject, NewStory, TaskStatus, TextFormat};

    async fn story(p: &SqlitePool) -> String {
        let project = projects::create(
            p,
            NewProject {
                title: "P".into(),
                description: String::new(),
                description_format: TextFormat::default(),
            },
        )
        .await
        .unwrap();
        stories::create(
            p,
            NewStory {
                project_id: project.id,
                title: "S".into(),
                description: String::new(),
                description_format: TextFormat::default(),
            },
        )
        .await
        .unwrap()
        .id
    }

    fn new_task(story_id: String, title: &str) -> NewTask {
        NewTask {
            story_id,
            title: title.into(),
            parent_task_id: None,
            description: String::new(),
            description_format: TextFormat::default(),
        }
    }

    fn blank_update(id: String) -> UpdateTask {
        UpdateTask {
            id,
            title: None,
            description: None,
            description_format: None,
            result: None,
            result_format: None,
            status: None,
            parent_task_id: None,
            sort_order: None,
            due_date: None,
        }
    }

    #[tokio::test]
    async fn create_assigns_increasing_sort_order_per_parent() {
        let p = pool().await;
        let sid = story(&p).await;
        let a = create(&p, new_task(sid.clone(), "a")).await.unwrap();
        let b = create(&p, new_task(sid.clone(), "b")).await.unwrap();
        let c = create(&p, new_task(sid.clone(), "c")).await.unwrap();
        assert!(a.sort_order < b.sort_order);
        assert!(b.sort_order < c.sort_order);
    }

    #[tokio::test]
    async fn status_in_progress_then_done_sets_both_timestamps() {
        let p = pool().await;
        let sid = story(&p).await;
        let t = create(&p, new_task(sid, "x")).await.unwrap();
        let started = update(
            &p,
            UpdateTask {
                status: Some(TaskStatus::InProgress),
                ..blank_update(t.id.clone())
            },
        )
        .await
        .unwrap();
        assert!(started.started_at.is_some());
        let started_ts = started.started_at.clone().unwrap();

        let done = update(
            &p,
            UpdateTask {
                status: Some(TaskStatus::Done),
                ..blank_update(t.id.clone())
            },
        )
        .await
        .unwrap();
        assert!(done.completed_at.is_some());
        assert_eq!(done.started_at, Some(started_ts));
    }

    #[tokio::test]
    async fn parent_task_id_set_then_cleared() {
        let p = pool().await;
        let sid = story(&p).await;
        let parent = create(&p, new_task(sid.clone(), "parent")).await.unwrap();
        let child = create(&p, new_task(sid.clone(), "child")).await.unwrap();

        let attached = update(
            &p,
            UpdateTask {
                parent_task_id: Some(Some(parent.id.clone())),
                ..blank_update(child.id.clone())
            },
        )
        .await
        .unwrap();
        assert_eq!(attached.parent_task_id.as_deref(), Some(parent.id.as_str()));

        let detached = update(
            &p,
            UpdateTask {
                parent_task_id: Some(None),
                ..blank_update(child.id.clone())
            },
        )
        .await
        .unwrap();
        assert!(detached.parent_task_id.is_none());
    }

    #[tokio::test]
    async fn update_many_fields_at_once_preserves_all() {
        let p = pool().await;
        let sid = story(&p).await;
        let t = create(&p, new_task(sid, "orig")).await.unwrap();
        let updated = update(
            &p,
            UpdateTask {
                id: t.id.clone(),
                title: Some("renamed".into()),
                description: Some("d".into()),
                description_format: Some(TextFormat::Markdown),
                result: Some("done!".into()),
                result_format: Some(TextFormat::Plaintext),
                status: Some(TaskStatus::InProgress),
                parent_task_id: None,
                sort_order: Some(42),
                due_date: Some(Some("2026-07-01".into())),
            },
        )
        .await
        .unwrap();
        assert_eq!(updated.title, "renamed");
        assert_eq!(updated.description, "d");
        assert_eq!(updated.description_format, TextFormat::Markdown);
        assert_eq!(updated.result, "done!");
        assert_eq!(updated.result_format, TextFormat::Plaintext);
        assert_eq!(updated.status, TaskStatus::InProgress);
        assert_eq!(updated.sort_order, 42);
        assert_eq!(updated.due_date.as_deref(), Some("2026-07-01"));
        assert!(updated.started_at.is_some());
    }

    #[tokio::test]
    async fn list_for_story_excludes_soft_deleted() {
        let p = pool().await;
        let sid = story(&p).await;
        let a = create(&p, new_task(sid.clone(), "a")).await.unwrap();
        let _b = create(&p, new_task(sid.clone(), "b")).await.unwrap();
        soft_delete(&p, &a.id).await.unwrap();
        let list = list_for_story(&p, &sid).await.unwrap();
        assert_eq!(list.len(), 1);
        assert_eq!(list[0].title, "b");
    }

    #[tokio::test]
    async fn empty_update_is_noop_and_keeps_updated_at() {
        let p = pool().await;
        let sid = story(&p).await;
        let t = create(&p, new_task(sid, "x")).await.unwrap();
        let updated = update(&p, blank_update(t.id.clone())).await.unwrap();
        assert_eq!(updated.updated_at, t.updated_at);
    }

    #[tokio::test]
    async fn soft_delete_cascades_to_descendant_subtasks_and_comments() {
        use crate::db::comments;
        use crate::domain::NewComment;

        let p = pool().await;
        let sid = story(&p).await;

        // Tree: root → sub → subsub. Sibling task "other" should survive.
        let root = create(&p, new_task(sid.clone(), "root")).await.unwrap();
        let other = create(&p, new_task(sid.clone(), "other")).await.unwrap();
        let sub = create(
            &p,
            NewTask {
                parent_task_id: Some(root.id.clone()),
                ..new_task(sid.clone(), "sub")
            },
        )
        .await
        .unwrap();
        let subsub = create(
            &p,
            NewTask {
                parent_task_id: Some(sub.id.clone()),
                ..new_task(sid.clone(), "subsub")
            },
        )
        .await
        .unwrap();

        // Comment on the deepest subtask + one on the sibling that must survive.
        let _doomed = comments::create(
            &p,
            NewComment {
                task_id: subsub.id.clone(),
                body: "doomed".into(),
                body_format: TextFormat::default(),
            },
        )
        .await
        .unwrap();
        let survivor = comments::create(
            &p,
            NewComment {
                task_id: other.id.clone(),
                body: "survivor".into(),
                body_format: TextFormat::default(),
            },
        )
        .await
        .unwrap();

        soft_delete(&p, &root.id).await.unwrap();

        // Whole subtree gone.
        assert!(get(&p, &root.id).await.unwrap().is_none());
        assert!(get(&p, &sub.id).await.unwrap().is_none());
        assert!(get(&p, &subsub.id).await.unwrap().is_none());
        assert!(comments::list_for_task(&p, &subsub.id)
            .await
            .unwrap()
            .is_empty());

        // Sibling task and its comment survive.
        assert!(get(&p, &other.id).await.unwrap().is_some());
        let other_comments = comments::list_for_task(&p, &other.id).await.unwrap();
        assert_eq!(other_comments.len(), 1);
        assert_eq!(other_comments[0].id, survivor.id);

        // Search index: doomed comment + 3 subtree tasks gone; sibling task +
        // its comment + story + project remain.
        let task_rows: i64 =
            sqlx::query_scalar("SELECT COUNT(*) FROM search_index WHERE kind = 'task'")
                .fetch_one(&p)
                .await
                .unwrap();
        assert_eq!(task_rows, 1, "only the sibling task should remain in search");
        let comment_rows: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM search_index WHERE kind = 'comment'",
        )
        .fetch_one(&p)
        .await
        .unwrap();
        assert_eq!(comment_rows, 1, "only the surviving comment should remain");
    }
}

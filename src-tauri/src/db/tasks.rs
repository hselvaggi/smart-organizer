use sqlx::SqlitePool;

use crate::domain::ids::{new_id, now_iso};
use crate::domain::{NewTask, Task, UpdateTask};
use crate::error::{AppError, AppResult};

pub async fn list_for_story(pool: &SqlitePool, story_id: &str) -> AppResult<Vec<Task>> {
    let rows = sqlx::query_as::<_, Task>(
        "SELECT id, story_id, parent_task_id, title, description, description_format,
                result, result_format, status, sort_order, created_at, updated_at, deleted_at
         FROM tasks
         WHERE story_id = ?1 AND deleted_at IS NULL
         ORDER BY sort_order, created_at",
    )
    .bind(story_id)
    .fetch_all(pool)
    .await?;
    Ok(rows)
}

pub async fn get(pool: &SqlitePool, id: &str) -> AppResult<Option<Task>> {
    let row = sqlx::query_as::<_, Task>(
        "SELECT id, story_id, parent_task_id, title, description, description_format,
                result, result_format, status, sort_order, created_at, updated_at, deleted_at
         FROM tasks
         WHERE id = ?1 AND deleted_at IS NULL",
    )
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

    get(pool, &id)
        .await?
        .ok_or_else(|| AppError::Other("task missing after insert".into()))
}

pub async fn update(pool: &SqlitePool, input: UpdateTask) -> AppResult<Task> {
    let now = now_iso();
    let mut tx = pool.begin().await?;

    if let Some(title) = &input.title {
        sqlx::query("UPDATE tasks SET title = ?2, updated_at = ?3 WHERE id = ?1")
            .bind(&input.id)
            .bind(title)
            .bind(&now)
            .execute(&mut *tx)
            .await?;
    }
    if let Some(desc) = &input.description {
        sqlx::query("UPDATE tasks SET description = ?2, updated_at = ?3 WHERE id = ?1")
            .bind(&input.id)
            .bind(desc)
            .bind(&now)
            .execute(&mut *tx)
            .await?;
    }
    if let Some(fmt) = input.description_format {
        sqlx::query("UPDATE tasks SET description_format = ?2, updated_at = ?3 WHERE id = ?1")
            .bind(&input.id)
            .bind(fmt)
            .bind(&now)
            .execute(&mut *tx)
            .await?;
    }
    if let Some(result) = &input.result {
        sqlx::query("UPDATE tasks SET result = ?2, updated_at = ?3 WHERE id = ?1")
            .bind(&input.id)
            .bind(result)
            .bind(&now)
            .execute(&mut *tx)
            .await?;
    }
    if let Some(fmt) = input.result_format {
        sqlx::query("UPDATE tasks SET result_format = ?2, updated_at = ?3 WHERE id = ?1")
            .bind(&input.id)
            .bind(fmt)
            .bind(&now)
            .execute(&mut *tx)
            .await?;
    }
    if let Some(status) = input.status {
        sqlx::query("UPDATE tasks SET status = ?2, updated_at = ?3 WHERE id = ?1")
            .bind(&input.id)
            .bind(status)
            .bind(&now)
            .execute(&mut *tx)
            .await?;
    }
    if let Some(parent) = input.parent_task_id {
        sqlx::query("UPDATE tasks SET parent_task_id = ?2, updated_at = ?3 WHERE id = ?1")
            .bind(&input.id)
            .bind(parent)
            .bind(&now)
            .execute(&mut *tx)
            .await?;
    }
    if let Some(order) = input.sort_order {
        sqlx::query("UPDATE tasks SET sort_order = ?2, updated_at = ?3 WHERE id = ?1")
            .bind(&input.id)
            .bind(order)
            .bind(&now)
            .execute(&mut *tx)
            .await?;
    }

    tx.commit().await?;

    get(pool, &input.id)
        .await?
        .ok_or_else(|| AppError::Other("task missing after update".into()))
}

pub async fn soft_delete(pool: &SqlitePool, id: &str) -> AppResult<()> {
    let now = now_iso();
    sqlx::query("UPDATE tasks SET deleted_at = ?2, updated_at = ?2 WHERE id = ?1")
        .bind(id)
        .bind(now)
        .execute(pool)
        .await?;
    Ok(())
}

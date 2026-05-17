use sqlx::SqlitePool;

use crate::domain::ids::{new_id, now_iso};
use crate::domain::{NewStory, Story, UpdateStory};
use crate::error::{AppError, AppResult};

pub async fn list_for_project(pool: &SqlitePool, project_id: &str) -> AppResult<Vec<Story>> {
    let rows = sqlx::query_as::<_, Story>(
        "SELECT id, project_id, title, description, description_format, status,
                sort_order, created_at, updated_at, deleted_at,
                started_at, completed_at, due_date
         FROM stories
         WHERE project_id = ?1 AND deleted_at IS NULL
         ORDER BY sort_order, created_at",
    )
    .bind(project_id)
    .fetch_all(pool)
    .await?;
    Ok(rows)
}

pub async fn get(pool: &SqlitePool, id: &str) -> AppResult<Option<Story>> {
    let row = sqlx::query_as::<_, Story>(
        "SELECT id, project_id, title, description, description_format, status,
                sort_order, created_at, updated_at, deleted_at,
                started_at, completed_at, due_date
         FROM stories
         WHERE id = ?1 AND deleted_at IS NULL",
    )
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

    get(pool, &id)
        .await?
        .ok_or_else(|| AppError::Other("story missing after insert".into()))
}

pub async fn update(pool: &SqlitePool, input: UpdateStory) -> AppResult<Story> {
    let now = now_iso();
    let mut tx = pool.begin().await?;

    if let Some(title) = &input.title {
        sqlx::query("UPDATE stories SET title = ?2, updated_at = ?3 WHERE id = ?1")
            .bind(&input.id)
            .bind(title)
            .bind(&now)
            .execute(&mut *tx)
            .await?;
    }
    if let Some(desc) = &input.description {
        sqlx::query("UPDATE stories SET description = ?2, updated_at = ?3 WHERE id = ?1")
            .bind(&input.id)
            .bind(desc)
            .bind(&now)
            .execute(&mut *tx)
            .await?;
    }
    if let Some(fmt) = input.description_format {
        sqlx::query("UPDATE stories SET description_format = ?2, updated_at = ?3 WHERE id = ?1")
            .bind(&input.id)
            .bind(fmt)
            .bind(&now)
            .execute(&mut *tx)
            .await?;
    }
    if let Some(status) = input.status {
        sqlx::query(
            "UPDATE stories SET
                status = ?2,
                started_at = CASE WHEN ?2 = 'in_progress' AND started_at IS NULL THEN ?3 ELSE started_at END,
                completed_at = CASE WHEN ?2 = 'done' AND completed_at IS NULL THEN ?3 ELSE completed_at END,
                updated_at = ?3
             WHERE id = ?1",
        )
        .bind(&input.id)
        .bind(status)
        .bind(&now)
        .execute(&mut *tx)
        .await?;
    }
    if let Some(due) = input.due_date {
        sqlx::query("UPDATE stories SET due_date = ?2, updated_at = ?3 WHERE id = ?1")
            .bind(&input.id)
            .bind(due)
            .bind(&now)
            .execute(&mut *tx)
            .await?;
    }

    tx.commit().await?;

    get(pool, &input.id)
        .await?
        .ok_or_else(|| AppError::Other("story missing after update".into()))
}

pub async fn soft_delete(pool: &SqlitePool, id: &str) -> AppResult<()> {
    let now = now_iso();
    sqlx::query("UPDATE stories SET deleted_at = ?2, updated_at = ?2 WHERE id = ?1")
        .bind(id)
        .bind(now)
        .execute(pool)
        .await?;
    Ok(())
}

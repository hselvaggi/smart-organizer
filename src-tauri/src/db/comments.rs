use sqlx::SqlitePool;

use crate::domain::ids::{new_id, now_iso};
use crate::domain::{Comment, NewComment};
use crate::error::{AppError, AppResult};
use crate::search;

pub(crate) const COLS: &str = "id, task_id, body, body_format, created_at, updated_at, deleted_at";

pub async fn list_for_task(pool: &SqlitePool, task_id: &str) -> AppResult<Vec<Comment>> {
    let rows = sqlx::query_as::<_, Comment>(&format!(
        "SELECT {COLS}
         FROM comments
         WHERE task_id = ?1 AND deleted_at IS NULL
         ORDER BY created_at"
    ))
    .bind(task_id)
    .fetch_all(pool)
    .await?;
    Ok(rows)
}

pub async fn create(pool: &SqlitePool, input: NewComment) -> AppResult<Comment> {
    let id = new_id();
    let now = now_iso();
    sqlx::query(
        "INSERT INTO comments (id, task_id, body, body_format, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?5)",
    )
    .bind(&id)
    .bind(&input.task_id)
    .bind(&input.body)
    .bind(input.body_format)
    .bind(&now)
    .execute(pool)
    .await?;

    let row = sqlx::query_as::<_, Comment>(&format!(
        "SELECT {COLS} FROM comments WHERE id = ?1"
    ))
    .bind(&id)
    .fetch_optional(pool)
    .await?;

    let comment = row.ok_or_else(|| AppError::Missing("comment missing after insert"))?;
    search::index_comment(pool, &comment).await?;
    Ok(comment)
}

pub async fn soft_delete(pool: &SqlitePool, id: &str) -> AppResult<()> {
    let now = now_iso();
    sqlx::query("UPDATE comments SET deleted_at = ?2, updated_at = ?2 WHERE id = ?1")
        .bind(id)
        .bind(now)
        .execute(pool)
        .await?;
    search::remove(pool, search::EntityKind::Comment, id).await?;
    Ok(())
}

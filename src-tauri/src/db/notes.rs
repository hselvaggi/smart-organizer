use sqlx::SqlitePool;

use crate::domain::ids::{new_id, now_iso};
use crate::domain::{NewNote, Note, UpdateNote};
use crate::error::{AppError, AppResult};
use crate::search;

pub(crate) const COLS: &str = "id, project_id, title, body, body_format,
                               sort_order, created_at, updated_at, deleted_at";

pub async fn list_standalone(pool: &SqlitePool) -> AppResult<Vec<Note>> {
    let rows = sqlx::query_as::<_, Note>(&format!(
        "SELECT {COLS}
         FROM notes
         WHERE deleted_at IS NULL AND project_id IS NULL
         ORDER BY updated_at DESC"
    ))
    .fetch_all(pool)
    .await?;
    Ok(rows)
}

pub async fn list_for_project(pool: &SqlitePool, project_id: &str) -> AppResult<Vec<Note>> {
    let rows = sqlx::query_as::<_, Note>(&format!(
        "SELECT {COLS}
         FROM notes
         WHERE deleted_at IS NULL AND project_id = ?1
         ORDER BY updated_at DESC"
    ))
    .bind(project_id)
    .fetch_all(pool)
    .await?;
    Ok(rows)
}

pub async fn get(pool: &SqlitePool, id: &str) -> AppResult<Option<Note>> {
    let row = sqlx::query_as::<_, Note>(&format!(
        "SELECT {COLS}
         FROM notes
         WHERE id = ?1 AND deleted_at IS NULL"
    ))
    .bind(id)
    .fetch_optional(pool)
    .await?;
    Ok(row)
}

pub async fn create(pool: &SqlitePool, input: NewNote) -> AppResult<Note> {
    let id = new_id();
    let now = now_iso();
    let next_order: i64 =
        sqlx::query_scalar("SELECT COALESCE(MAX(sort_order), -1) + 1 FROM notes")
            .fetch_one(pool)
            .await?;

    sqlx::query(
        "INSERT INTO notes (id, project_id, title, body, body_format, sort_order, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?7)",
    )
    .bind(&id)
    .bind(&input.project_id)
    .bind(&input.title)
    .bind(&input.body)
    .bind(input.body_format)
    .bind(next_order)
    .bind(&now)
    .execute(pool)
    .await?;

    let note = get(pool, &id)
        .await?
        .ok_or_else(|| AppError::Missing("note missing after insert"))?;
    search::index_note(pool, &note).await?;
    Ok(note)
}

pub async fn update(pool: &SqlitePool, input: UpdateNote) -> AppResult<Note> {
    let now = now_iso();
    let mut tx = pool.begin().await?;

    if let Some(title) = &input.title {
        sqlx::query("UPDATE notes SET title = ?2, updated_at = ?3 WHERE id = ?1")
            .bind(&input.id)
            .bind(title)
            .bind(&now)
            .execute(&mut *tx)
            .await?;
    }
    if let Some(body) = &input.body {
        sqlx::query("UPDATE notes SET body = ?2, updated_at = ?3 WHERE id = ?1")
            .bind(&input.id)
            .bind(body)
            .bind(&now)
            .execute(&mut *tx)
            .await?;
    }
    if let Some(fmt) = input.body_format {
        sqlx::query("UPDATE notes SET body_format = ?2, updated_at = ?3 WHERE id = ?1")
            .bind(&input.id)
            .bind(fmt)
            .bind(&now)
            .execute(&mut *tx)
            .await?;
    }

    tx.commit().await?;

    let note = get(pool, &input.id)
        .await?
        .ok_or_else(|| AppError::Missing("note missing after update"))?;
    search::index_note(pool, &note).await?;
    Ok(note)
}

pub async fn soft_delete(pool: &SqlitePool, id: &str) -> AppResult<()> {
    let now = now_iso();
    sqlx::query("UPDATE notes SET deleted_at = ?2, updated_at = ?2 WHERE id = ?1")
        .bind(id)
        .bind(now)
        .execute(pool)
        .await?;
    search::remove(pool, search::EntityKind::Note, id).await?;
    Ok(())
}

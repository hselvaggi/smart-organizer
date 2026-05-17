use sqlx::SqlitePool;

use crate::domain::ids::{new_id, now_iso};
use crate::domain::{NewProject, Project, UpdateProject};
use crate::error::{AppError, AppResult};

pub async fn list_all(pool: &SqlitePool) -> AppResult<Vec<Project>> {
    let rows = sqlx::query_as::<_, Project>(
        "SELECT id, parent_id, title, description, description_format,
                sort_order, created_at, updated_at, deleted_at
         FROM projects
         WHERE deleted_at IS NULL
         ORDER BY sort_order, created_at",
    )
    .fetch_all(pool)
    .await?;
    Ok(rows)
}

pub async fn get(pool: &SqlitePool, id: &str) -> AppResult<Option<Project>> {
    let row = sqlx::query_as::<_, Project>(
        "SELECT id, parent_id, title, description, description_format,
                sort_order, created_at, updated_at, deleted_at
         FROM projects
         WHERE id = ?1 AND deleted_at IS NULL",
    )
    .bind(id)
    .fetch_optional(pool)
    .await?;
    Ok(row)
}

pub async fn create(pool: &SqlitePool, input: NewProject) -> AppResult<Project> {
    let id = new_id();
    let now = now_iso();
    let next_order: i64 = sqlx::query_scalar(
        "SELECT COALESCE(MAX(sort_order), -1) + 1 FROM projects WHERE parent_id IS ?1",
    )
    .bind(&input.parent_id)
    .fetch_one(pool)
    .await?;

    sqlx::query(
        "INSERT INTO projects
            (id, parent_id, title, description, description_format,
             sort_order, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?7)",
    )
    .bind(&id)
    .bind(&input.parent_id)
    .bind(&input.title)
    .bind(&input.description)
    .bind(input.description_format)
    .bind(next_order)
    .bind(&now)
    .execute(pool)
    .await?;

    get(pool, &id)
        .await?
        .ok_or_else(|| AppError::Other("project missing after insert".into()))
}

pub async fn update(pool: &SqlitePool, input: UpdateProject) -> AppResult<Project> {
    let now = now_iso();
    let mut tx = pool.begin().await?;

    if let Some(title) = &input.title {
        sqlx::query("UPDATE projects SET title = ?2, updated_at = ?3 WHERE id = ?1")
            .bind(&input.id)
            .bind(title)
            .bind(&now)
            .execute(&mut *tx)
            .await?;
    }
    if let Some(desc) = &input.description {
        sqlx::query("UPDATE projects SET description = ?2, updated_at = ?3 WHERE id = ?1")
            .bind(&input.id)
            .bind(desc)
            .bind(&now)
            .execute(&mut *tx)
            .await?;
    }
    if let Some(fmt) = input.description_format {
        sqlx::query("UPDATE projects SET description_format = ?2, updated_at = ?3 WHERE id = ?1")
            .bind(&input.id)
            .bind(fmt)
            .bind(&now)
            .execute(&mut *tx)
            .await?;
    }
    if let Some(parent) = input.parent_id {
        sqlx::query("UPDATE projects SET parent_id = ?2, updated_at = ?3 WHERE id = ?1")
            .bind(&input.id)
            .bind(parent)
            .bind(&now)
            .execute(&mut *tx)
            .await?;
    }

    tx.commit().await?;

    get(pool, &input.id)
        .await?
        .ok_or_else(|| AppError::Other("project missing after update".into()))
}

pub async fn soft_delete(pool: &SqlitePool, id: &str) -> AppResult<()> {
    let now = now_iso();
    sqlx::query("UPDATE projects SET deleted_at = ?2, updated_at = ?2 WHERE id = ?1")
        .bind(id)
        .bind(now)
        .execute(pool)
        .await?;
    Ok(())
}

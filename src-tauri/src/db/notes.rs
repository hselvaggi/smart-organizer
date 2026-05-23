use sqlx::{QueryBuilder, Sqlite, SqlitePool};

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
    let mut qb: QueryBuilder<Sqlite> = QueryBuilder::new("UPDATE notes SET ");
    let mut has_any = false;
    {
        let mut sep = qb.separated(", ");
        if let Some(ref title) = input.title {
            sep.push("title = ").push_bind_unseparated(title);
            has_any = true;
        }
        if let Some(ref body) = input.body {
            sep.push("body = ").push_bind_unseparated(body);
            has_any = true;
        }
        if let Some(fmt) = input.body_format {
            sep.push("body_format = ").push_bind_unseparated(fmt);
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

    let note = get(pool, &input.id)
        .await?
        .ok_or_else(|| AppError::Missing("note missing after update"))?;
    search::index_note(pool, &note).await?;
    Ok(note)
}

/// Insert a note verbatim from a peer. See `projects::insert_raw` for
/// semantics.
pub async fn insert_raw(pool: &SqlitePool, n: &Note) -> AppResult<bool> {
    let res = sqlx::query(
        "INSERT INTO notes
            (id, project_id, title, body, body_format, sort_order,
             created_at, updated_at, deleted_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)
         ON CONFLICT(id) DO NOTHING",
    )
    .bind(&n.id)
    .bind(&n.project_id)
    .bind(&n.title)
    .bind(&n.body)
    .bind(n.body_format)
    .bind(n.sort_order)
    .bind(&n.created_at)
    .bind(&n.updated_at)
    .bind(&n.deleted_at)
    .execute(pool)
    .await?;
    let inserted = res.rows_affected() > 0;
    if inserted && n.deleted_at.is_none() {
        search::index_note(pool, n).await?;
    }
    Ok(inserted)
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

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::projects;
    use crate::db::test_support::pool;
    use crate::domain::{NewProject, TextFormat};

    fn standalone(title: &str) -> NewNote {
        NewNote {
            title: title.into(),
            project_id: None,
            body: String::new(),
            body_format: TextFormat::default(),
        }
    }

    fn blank_update(id: String) -> UpdateNote {
        UpdateNote {
            id,
            title: None,
            body: None,
            body_format: None,
        }
    }

    #[tokio::test]
    async fn create_standalone_then_list() {
        let p = pool().await;
        let _ = create(&p, standalone("a")).await.unwrap();
        let _ = create(&p, standalone("b")).await.unwrap();
        let list = list_standalone(&p).await.unwrap();
        assert_eq!(list.len(), 2);
    }

    #[tokio::test]
    async fn standalone_vs_project_scoped_are_partitioned() {
        let p = pool().await;
        let project = projects::create(
            &p,
            NewProject {
                title: "P".into(),
                description: String::new(),
                description_format: TextFormat::default(),
            },
        )
        .await
        .unwrap();
        let _standalone = create(&p, standalone("loose")).await.unwrap();
        let _attached = create(
            &p,
            NewNote {
                title: "attached".into(),
                project_id: Some(project.id.clone()),
                body: String::new(),
                body_format: TextFormat::default(),
            },
        )
        .await
        .unwrap();

        let loose = list_standalone(&p).await.unwrap();
        let attached = list_for_project(&p, &project.id).await.unwrap();
        assert_eq!(loose.len(), 1);
        assert_eq!(loose[0].title, "loose");
        assert_eq!(attached.len(), 1);
        assert_eq!(attached[0].title, "attached");
    }

    #[tokio::test]
    async fn update_multiple_fields_in_one_statement() {
        let p = pool().await;
        let created = create(&p, standalone("orig")).await.unwrap();
        let updated = update(
            &p,
            UpdateNote {
                id: created.id.clone(),
                title: Some("new".into()),
                body: Some("# heading".into()),
                body_format: Some(TextFormat::Markdown),
            },
        )
        .await
        .unwrap();
        assert_eq!(updated.title, "new");
        assert_eq!(updated.body, "# heading");
        assert_eq!(updated.body_format, TextFormat::Markdown);
    }

    #[tokio::test]
    async fn empty_update_is_noop_and_keeps_updated_at() {
        let p = pool().await;
        let created = create(&p, standalone("x")).await.unwrap();
        let updated = update(&p, blank_update(created.id.clone())).await.unwrap();
        assert_eq!(updated.updated_at, created.updated_at);
    }
}

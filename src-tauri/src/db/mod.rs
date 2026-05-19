use std::path::Path;

use sqlx::sqlite::{SqliteConnectOptions, SqliteJournalMode, SqlitePoolOptions};
use sqlx::SqlitePool;

use crate::error::AppResult;

pub mod comments;
pub mod notes;
pub mod projects;
pub mod stories;
pub mod tasks;

pub async fn open_pool(db_path: &Path) -> AppResult<SqlitePool> {
    let options = SqliteConnectOptions::new()
        .filename(db_path)
        .create_if_missing(true)
        .journal_mode(SqliteJournalMode::Wal)
        .foreign_keys(true);

    let pool = SqlitePoolOptions::new()
        .max_connections(8)
        .connect_with(options)
        .await?;

    sqlx::migrate!("./migrations").run(&pool).await?;

    if crate::search::is_empty(&pool).await? {
        tracing::info!("backfilling search index");
        crate::search::reindex_all(&pool).await?;
    }

    Ok(pool)
}

#[cfg(test)]
pub(crate) mod test_support {
    use std::str::FromStr;

    use sqlx::sqlite::{SqliteConnectOptions, SqlitePoolOptions};
    use sqlx::SqlitePool;

    /// In-memory pool with migrations applied, suitable for unit tests.
    /// Single connection because `sqlite::memory:` is per-connection — a
    /// multi-connection pool would see empty schemas on the others.
    pub async fn pool() -> SqlitePool {
        let options = SqliteConnectOptions::from_str("sqlite::memory:")
            .unwrap()
            .foreign_keys(true);
        let pool = SqlitePoolOptions::new()
            .max_connections(1)
            .connect_with(options)
            .await
            .expect("test pool");
        sqlx::migrate!("./migrations")
            .run(&pool)
            .await
            .expect("migrations");
        pool
    }
}

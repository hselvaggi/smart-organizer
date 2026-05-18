pub mod extract;
pub mod index;
pub mod query;

pub use index::{
    index_comment, index_note, index_project, index_story, index_task, reindex_all, remove,
    EntityKind,
};
pub use query::{search, SearchHit};

use sqlx::SqlitePool;

use crate::error::AppResult;

/// Returns true when the FTS table has no rows. Used at startup to decide
/// whether the initial backfill needs to run.
pub async fn is_empty(pool: &SqlitePool) -> AppResult<bool> {
    let count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM search_index")
        .fetch_one(pool)
        .await?;
    Ok(count == 0)
}

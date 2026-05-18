use serde::{Deserialize, Serialize};
use sqlx::SqlitePool;
use ts_rs::TS;

use crate::error::AppResult;

#[derive(Debug, Clone, Serialize, Deserialize, TS, sqlx::FromRow)]
#[ts(export, export_to = "../../src/types/generated/")]
#[serde(rename_all = "camelCase")]
pub struct SearchHit {
    pub kind: String,
    pub entity_id: String,
    pub project_id: Option<String>,
    pub story_id: Option<String>,
    pub task_id: Option<String>,
    pub title: String,
    pub snippet: String,
    #[ts(type = "number")]
    pub score: f64,
}

pub async fn search(
    pool: &SqlitePool,
    query: &str,
    limit: i64,
) -> AppResult<Vec<SearchHit>> {
    let prepared = match prepare_fts_query(query) {
        Some(q) => q,
        None => return Ok(Vec::new()),
    };

    let hits = sqlx::query_as::<_, SearchHit>(
        "SELECT kind,
                entity_id,
                project_id,
                story_id,
                task_id,
                title,
                snippet(search_index, 6, '<mark>', '</mark>', '…', 12) AS snippet,
                bm25(search_index, 5.0, 1.0) AS score
           FROM search_index
          WHERE search_index MATCH ?1
          ORDER BY score
          LIMIT ?2",
    )
    .bind(&prepared)
    .bind(limit)
    .fetch_all(pool)
    .await?;
    Ok(hits)
}

/// Turn a user-typed string into a safe FTS5 MATCH query.
///
/// Each whitespace-separated token is wrapped in double quotes (after escaping
/// internal quotes by doubling them, per FTS5 grammar) and given a `*` suffix
/// to enable prefix matching. Returns `None` if there are no usable tokens.
fn prepare_fts_query(input: &str) -> Option<String> {
    let mut parts: Vec<String> = Vec::new();
    for raw in input.split_whitespace() {
        let cleaned: String = raw
            .chars()
            .filter(|c| c.is_alphanumeric() || *c == '_' || *c == '-')
            .collect();
        if cleaned.is_empty() {
            continue;
        }
        let escaped = cleaned.replace('"', "\"\"");
        parts.push(format!("\"{}\"*", escaped));
    }
    if parts.is_empty() {
        None
    } else {
        Some(parts.join(" "))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn empty_query_is_none() {
        assert_eq!(prepare_fts_query(""), None);
        assert_eq!(prepare_fts_query("   "), None);
        assert_eq!(prepare_fts_query("!@#"), None);
    }

    #[test]
    fn tokens_get_quoted_and_prefixed() {
        assert_eq!(prepare_fts_query("foo"), Some("\"foo\"*".into()));
        assert_eq!(
            prepare_fts_query("foo bar"),
            Some("\"foo\"* \"bar\"*".into())
        );
    }

    #[test]
    fn punctuation_inside_tokens_is_stripped() {
        // Punctuation that would otherwise confuse the FTS5 parser must be
        // sanitised before quoting.
        assert_eq!(prepare_fts_query("a:b"), Some("\"ab\"*".into()));
        assert_eq!(prepare_fts_query("a.b"), Some("\"ab\"*".into()));
    }
}

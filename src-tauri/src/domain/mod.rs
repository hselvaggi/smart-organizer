use serde::{Deserialize, Serialize};
use ts_rs::TS;

pub mod ids;

#[derive(Debug, Clone, Copy, Serialize, Deserialize, TS, sqlx::Type, PartialEq, Eq)]
#[ts(export, export_to = "../../src/types/generated/")]
#[serde(rename_all = "lowercase")]
#[sqlx(rename_all = "lowercase")]
pub enum TextFormat {
    Markdown,
    Plaintext,
    Html,
    Latex,
}

impl Default for TextFormat {
    fn default() -> Self {
        Self::Markdown
    }
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, TS, sqlx::Type, PartialEq, Eq)]
#[ts(export, export_to = "../../src/types/generated/")]
#[serde(rename_all = "snake_case")]
#[sqlx(rename_all = "snake_case")]
pub enum TaskStatus {
    Todo,
    InProgress,
    Done,
    Blocked,
    Cancelled,
}

impl Default for TaskStatus {
    fn default() -> Self {
        Self::Todo
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, TS, sqlx::FromRow)]
#[ts(export, export_to = "../../src/types/generated/")]
#[serde(rename_all = "camelCase")]
pub struct Project {
    pub id: String,
    pub parent_id: Option<String>,
    pub title: String,
    pub description: String,
    pub description_format: TextFormat,
    #[ts(type = "number")]
    pub sort_order: i64,
    pub created_at: String,
    pub updated_at: String,
    pub deleted_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS, sqlx::FromRow)]
#[ts(export, export_to = "../../src/types/generated/")]
#[serde(rename_all = "camelCase")]
pub struct Story {
    pub id: String,
    pub project_id: String,
    pub title: String,
    pub description: String,
    pub description_format: TextFormat,
    pub status: TaskStatus,
    #[ts(type = "number")]
    pub sort_order: i64,
    pub created_at: String,
    pub updated_at: String,
    pub deleted_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS, sqlx::FromRow)]
#[ts(export, export_to = "../../src/types/generated/")]
#[serde(rename_all = "camelCase")]
pub struct Task {
    pub id: String,
    pub story_id: String,
    pub parent_task_id: Option<String>,
    pub title: String,
    pub description: String,
    pub description_format: TextFormat,
    pub result: String,
    pub result_format: TextFormat,
    pub status: TaskStatus,
    #[ts(type = "number")]
    pub sort_order: i64,
    pub created_at: String,
    pub updated_at: String,
    pub deleted_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS, sqlx::FromRow)]
#[ts(export, export_to = "../../src/types/generated/")]
#[serde(rename_all = "camelCase")]
pub struct Comment {
    pub id: String,
    pub task_id: String,
    pub body: String,
    pub body_format: TextFormat,
    pub created_at: String,
    pub updated_at: String,
    pub deleted_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../src/types/generated/")]
#[serde(rename_all = "camelCase")]
pub struct NewProject {
    pub title: String,
    #[serde(default)]
    pub parent_id: Option<String>,
    #[serde(default)]
    pub description: String,
    #[serde(default)]
    pub description_format: TextFormat,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../src/types/generated/")]
#[serde(rename_all = "camelCase")]
pub struct NewStory {
    pub project_id: String,
    pub title: String,
    #[serde(default)]
    pub description: String,
    #[serde(default)]
    pub description_format: TextFormat,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../src/types/generated/")]
#[serde(rename_all = "camelCase")]
pub struct NewTask {
    pub story_id: String,
    pub title: String,
    #[serde(default)]
    pub parent_task_id: Option<String>,
    #[serde(default)]
    pub description: String,
    #[serde(default)]
    pub description_format: TextFormat,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../src/types/generated/")]
#[serde(rename_all = "camelCase")]
pub struct NewComment {
    pub task_id: String,
    pub body: String,
    #[serde(default)]
    pub body_format: TextFormat,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../src/types/generated/")]
#[serde(rename_all = "camelCase")]
pub struct UpdateProject {
    pub id: String,
    pub title: Option<String>,
    pub description: Option<String>,
    pub description_format: Option<TextFormat>,
    pub parent_id: Option<Option<String>>,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../src/types/generated/")]
#[serde(rename_all = "camelCase")]
pub struct UpdateStory {
    pub id: String,
    pub title: Option<String>,
    pub description: Option<String>,
    pub description_format: Option<TextFormat>,
    pub status: Option<TaskStatus>,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../src/types/generated/")]
#[serde(rename_all = "camelCase")]
pub struct ProjectBoard {
    pub stories: Vec<Story>,
    pub tasks: Vec<Task>,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../src/types/generated/")]
#[serde(rename_all = "camelCase")]
pub struct Capability {
    pub name: String,
    pub detected_path: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../src/types/generated/")]
#[serde(rename_all = "camelCase")]
pub struct SystemInfo {
    pub os: String,
    pub capabilities: Vec<Capability>,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../src/types/generated/")]
#[serde(rename_all = "camelCase")]
pub struct UpdateTask {
    pub id: String,
    pub title: Option<String>,
    pub description: Option<String>,
    pub description_format: Option<TextFormat>,
    pub result: Option<String>,
    pub result_format: Option<TextFormat>,
    pub status: Option<TaskStatus>,
    pub parent_task_id: Option<Option<String>>,
    #[ts(type = "number | null")]
    pub sort_order: Option<i64>,
}

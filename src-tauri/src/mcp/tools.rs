use serde_json::{json, Value};
use sqlx::SqlitePool;

use crate::db;
use crate::domain::{
    NewComment, NewProject, NewStory, NewTask, UpdateProject, UpdateStory, UpdateTask,
};
use crate::error::AppResult;
use crate::state::McpMode;

pub struct ToolDef {
    pub name: &'static str,
    pub description: &'static str,
    pub input_schema: fn() -> Value,
    pub writes: bool,
}

pub fn list_tools(mode: McpMode) -> Vec<&'static ToolDef> {
    TOOLS
        .iter()
        .filter(|t| !t.writes || mode.allows_writes())
        .collect()
}

pub async fn call_tool(
    pool: &SqlitePool,
    mode: McpMode,
    name: &str,
    args: &Value,
) -> Result<Value, String> {
    let tool = TOOLS
        .iter()
        .find(|t| t.name == name)
        .ok_or_else(|| format!("unknown tool: {name}"))?;
    if tool.writes && !mode.allows_writes() {
        return Err(format!("tool {name} requires full mode (read-only is on)"));
    }

    let result: AppResult<Value> = match name {
        // ---- read ----
        "list_projects" => db::projects::list_all(pool).await.map(|v| json!(v)),
        "get_project" => {
            let id = str_arg(args, "id")?;
            db::projects::get(pool, id).await.map(|v| json!(v))
        }
        "list_stories" => {
            let project_id = str_arg(args, "projectId")?;
            db::stories::list_for_project(pool, project_id)
                .await
                .map(|v| json!(v))
        }
        "get_story" => {
            let id = str_arg(args, "id")?;
            db::stories::get(pool, id).await.map(|v| json!(v))
        }
        "list_tasks" => {
            let story_id = str_arg(args, "storyId")?;
            db::tasks::list_for_story(pool, story_id)
                .await
                .map(|v| json!(v))
        }
        "get_task" => {
            let id = str_arg(args, "id")?;
            db::tasks::get(pool, id).await.map(|v| json!(v))
        }
        "list_comments" => {
            let task_id = str_arg(args, "taskId")?;
            db::comments::list_for_task(pool, task_id)
                .await
                .map(|v| json!(v))
        }
        "get_project_board" => {
            let project_id = str_arg(args, "projectId")?;
            let stories = db::stories::list_for_project(pool, project_id).await;
            let tasks = db::tasks::list_for_project(pool, project_id).await;
            match (stories, tasks) {
                (Ok(s), Ok(t)) => Ok(json!({ "stories": s, "tasks": t })),
                (Err(e), _) | (_, Err(e)) => Err(e),
            }
        }
        // ---- write ----
        "create_project" => {
            let input: NewProject = parse_arg(args)?;
            db::projects::create(pool, input).await.map(|v| json!(v))
        }
        "update_project" => {
            let input: UpdateProject = parse_arg(args)?;
            db::projects::update(pool, input).await.map(|v| json!(v))
        }
        "delete_project" => {
            let id = str_arg(args, "id")?;
            db::projects::soft_delete(pool, id)
                .await
                .map(|_| json!({ "ok": true }))
        }
        "create_story" => {
            let input: NewStory = parse_arg(args)?;
            db::stories::create(pool, input).await.map(|v| json!(v))
        }
        "update_story" => {
            let input: UpdateStory = parse_arg(args)?;
            db::stories::update(pool, input).await.map(|v| json!(v))
        }
        "delete_story" => {
            let id = str_arg(args, "id")?;
            db::stories::soft_delete(pool, id)
                .await
                .map(|_| json!({ "ok": true }))
        }
        "create_task" => {
            let input: NewTask = parse_arg(args)?;
            db::tasks::create(pool, input).await.map(|v| json!(v))
        }
        "update_task" => {
            let input: UpdateTask = parse_arg(args)?;
            db::tasks::update(pool, input).await.map(|v| json!(v))
        }
        "delete_task" => {
            let id = str_arg(args, "id")?;
            db::tasks::soft_delete(pool, id)
                .await
                .map(|_| json!({ "ok": true }))
        }
        "create_comment" => {
            let input: NewComment = parse_arg(args)?;
            db::comments::create(pool, input).await.map(|v| json!(v))
        }
        "delete_comment" => {
            let id = str_arg(args, "id")?;
            db::comments::soft_delete(pool, id)
                .await
                .map(|_| json!({ "ok": true }))
        }
        _ => unreachable!(),
    };

    result.map_err(|e| e.to_string())
}

fn str_arg<'a>(args: &'a Value, key: &str) -> Result<&'a str, String> {
    args.get(key)
        .and_then(|v| v.as_str())
        .ok_or_else(|| format!("missing string argument: {key}"))
}

fn parse_arg<T: serde::de::DeserializeOwned>(args: &Value) -> Result<T, String> {
    serde_json::from_value(args.clone()).map_err(|e| format!("invalid arguments: {e}"))
}

const STR: &str = r#"{"type":"string"}"#;
const OPT_STR: &str = r#"{"type":["string","null"]}"#;
const TEXT_FORMAT: &str =
    r#"{"type":"string","enum":["markdown","plaintext","html","latex"]}"#;
const STATUS: &str =
    r#"{"type":"string","enum":["todo","in_progress","done","blocked","cancelled"]}"#;

fn schema(properties: &[(&str, &str)], required: &[&str]) -> Value {
    let props: serde_json::Map<String, Value> = properties
        .iter()
        .map(|(k, v)| (k.to_string(), serde_json::from_str(v).unwrap()))
        .collect();
    json!({
        "type": "object",
        "properties": props,
        "required": required,
    })
}

pub static TOOLS: &[ToolDef] = &[
    // read
    ToolDef {
        name: "list_projects",
        description: "List all top-level and sub-projects",
        input_schema: || schema(&[], &[]),
        writes: false,
    },
    ToolDef {
        name: "get_project",
        description: "Get a project by id",
        input_schema: || schema(&[("id", STR)], &["id"]),
        writes: false,
    },
    ToolDef {
        name: "list_stories",
        description: "List all stories in a project",
        input_schema: || schema(&[("projectId", STR)], &["projectId"]),
        writes: false,
    },
    ToolDef {
        name: "get_story",
        description: "Get a story by id",
        input_schema: || schema(&[("id", STR)], &["id"]),
        writes: false,
    },
    ToolDef {
        name: "list_tasks",
        description: "List all tasks (including subtasks) of a story",
        input_schema: || schema(&[("storyId", STR)], &["storyId"]),
        writes: false,
    },
    ToolDef {
        name: "get_task",
        description: "Get a task (or subtask) by id",
        input_schema: || schema(&[("id", STR)], &["id"]),
        writes: false,
    },
    ToolDef {
        name: "list_comments",
        description: "List comments on a task",
        input_schema: || schema(&[("taskId", STR)], &["taskId"]),
        writes: false,
    },
    ToolDef {
        name: "get_project_board",
        description: "Get all stories + tasks of a project (kanban data)",
        input_schema: || schema(&[("projectId", STR)], &["projectId"]),
        writes: false,
    },
    // write
    ToolDef {
        name: "create_project",
        description: "Create a new project",
        input_schema: || {
            schema(
                &[
                    ("title", STR),
                    ("description", STR),
                    ("descriptionFormat", TEXT_FORMAT),
                    ("parentId", OPT_STR),
                ],
                &["title"],
            )
        },
        writes: true,
    },
    ToolDef {
        name: "update_project",
        description: "Update a project (only provided fields are changed)",
        input_schema: || {
            schema(
                &[
                    ("id", STR),
                    ("title", OPT_STR),
                    ("description", OPT_STR),
                    ("descriptionFormat", TEXT_FORMAT),
                    ("parentId", OPT_STR),
                ],
                &["id"],
            )
        },
        writes: true,
    },
    ToolDef {
        name: "delete_project",
        description: "Soft-delete a project",
        input_schema: || schema(&[("id", STR)], &["id"]),
        writes: true,
    },
    ToolDef {
        name: "create_story",
        description: "Create a new story within a project",
        input_schema: || {
            schema(
                &[
                    ("projectId", STR),
                    ("title", STR),
                    ("description", STR),
                    ("descriptionFormat", TEXT_FORMAT),
                ],
                &["projectId", "title"],
            )
        },
        writes: true,
    },
    ToolDef {
        name: "update_story",
        description: "Update a story (only provided fields are changed)",
        input_schema: || {
            schema(
                &[
                    ("id", STR),
                    ("title", OPT_STR),
                    ("description", OPT_STR),
                    ("descriptionFormat", TEXT_FORMAT),
                    ("status", STATUS),
                ],
                &["id"],
            )
        },
        writes: true,
    },
    ToolDef {
        name: "delete_story",
        description: "Soft-delete a story",
        input_schema: || schema(&[("id", STR)], &["id"]),
        writes: true,
    },
    ToolDef {
        name: "create_task",
        description: "Create a new task or subtask within a story",
        input_schema: || {
            schema(
                &[
                    ("storyId", STR),
                    ("title", STR),
                    ("description", STR),
                    ("descriptionFormat", TEXT_FORMAT),
                    ("parentTaskId", OPT_STR),
                ],
                &["storyId", "title"],
            )
        },
        writes: true,
    },
    ToolDef {
        name: "update_task",
        description: "Update a task (only provided fields are changed)",
        input_schema: || {
            schema(
                &[
                    ("id", STR),
                    ("title", OPT_STR),
                    ("description", OPT_STR),
                    ("descriptionFormat", TEXT_FORMAT),
                    ("result", OPT_STR),
                    ("resultFormat", TEXT_FORMAT),
                    ("status", STATUS),
                    ("parentTaskId", OPT_STR),
                ],
                &["id"],
            )
        },
        writes: true,
    },
    ToolDef {
        name: "delete_task",
        description: "Soft-delete a task",
        input_schema: || schema(&[("id", STR)], &["id"]),
        writes: true,
    },
    ToolDef {
        name: "create_comment",
        description: "Add a comment to a task",
        input_schema: || {
            schema(
                &[
                    ("taskId", STR),
                    ("body", STR),
                    ("bodyFormat", TEXT_FORMAT),
                ],
                &["taskId", "body"],
            )
        },
        writes: true,
    },
    ToolDef {
        name: "delete_comment",
        description: "Soft-delete a comment",
        input_schema: || schema(&[("id", STR)], &["id"]),
        writes: true,
    },
];

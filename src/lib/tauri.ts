import { invoke } from "@tauri-apps/api/core";
import type {
  Comment,
  McpMode,
  McpStatus,
  NewComment,
  NewNote,
  NewProject,
  NewStory,
  NewTask,
  Note,
  Project,
  ProjectBoard,
  Story,
  SystemInfo,
  Task,
  UpdateNote,
  UpdateProject,
  UpdateStory,
  UpdateTask,
} from "@/types/generated";

export const api = {
  listProjects: () => invoke<Project[]>("list_projects"),
  getProject: (id: string) => invoke<Project | null>("get_project", { id }),
  createProject: (input: NewProject) => invoke<Project>("create_project", { input }),
  updateProject: (input: UpdateProject) =>
    invoke<Project>("update_project", { input }),
  deleteProject: (id: string) => invoke<void>("delete_project", { id }),
  getProjectBoard: (projectId: string) =>
    invoke<ProjectBoard>("get_project_board", { projectId }),

  listStories: (projectId: string) =>
    invoke<Story[]>("list_stories", { projectId }),
  getStory: (id: string) => invoke<Story | null>("get_story", { id }),
  createStory: (input: NewStory) => invoke<Story>("create_story", { input }),
  updateStory: (input: UpdateStory) =>
    invoke<Story>("update_story", { input }),
  deleteStory: (id: string) => invoke<void>("delete_story", { id }),

  listTasks: (storyId: string) => invoke<Task[]>("list_tasks", { storyId }),
  getTask: (id: string) => invoke<Task | null>("get_task", { id }),
  createTask: (input: NewTask) => invoke<Task>("create_task", { input }),
  updateTask: (input: UpdateTask) => invoke<Task>("update_task", { input }),
  deleteTask: (id: string) => invoke<void>("delete_task", { id }),

  listComments: (taskId: string) =>
    invoke<Comment[]>("list_comments", { taskId }),
  createComment: (input: NewComment) =>
    invoke<Comment>("create_comment", { input }),
  deleteComment: (id: string) => invoke<void>("delete_comment", { id }),

  listNotes: () => invoke<Note[]>("list_notes"),
  listNotesForProject: (projectId: string) =>
    invoke<Note[]>("list_notes_for_project", { projectId }),
  getNote: (id: string) => invoke<Note | null>("get_note", { id }),
  createNote: (input: NewNote) => invoke<Note>("create_note", { input }),
  updateNote: (input: UpdateNote) => invoke<Note>("update_note", { input }),
  deleteNote: (id: string) => invoke<void>("delete_note", { id }),

  getSystemInfo: () => invoke<SystemInfo>("get_system_info"),
  resetDatabase: () => invoke<void>("reset_database"),
  quitApp: () => invoke<void>("quit_app"),
  getMcpStatus: () => invoke<McpStatus>("get_mcp_status"),
  setMcpMode: (mode: McpMode) => invoke<McpStatus>("set_mcp_mode", { mode }),
};

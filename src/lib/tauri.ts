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
  SearchHit,
  Story,
  SyncSummary,
  SystemInfo,
  Task,
  UpdateNote,
  UpdateProject,
  UpdateStory,
  UpdateTask,
} from "@/types/generated";

export const api = {
  projects: {
    list: () => invoke<Project[]>("list_projects"),
    get: (id: string) => invoke<Project | null>("get_project", { id }),
    create: (input: NewProject) => invoke<Project>("create_project", { input }),
    update: (input: UpdateProject) =>
      invoke<Project>("update_project", { input }),
    remove: (id: string) => invoke<void>("delete_project", { id }),
    board: (projectId: string) =>
      invoke<ProjectBoard>("get_project_board", { projectId }),
  },

  stories: {
    list: (projectId: string) =>
      invoke<Story[]>("list_stories", { projectId }),
    get: (id: string) => invoke<Story | null>("get_story", { id }),
    create: (input: NewStory) => invoke<Story>("create_story", { input }),
    update: (input: UpdateStory) =>
      invoke<Story>("update_story", { input }),
    remove: (id: string) => invoke<void>("delete_story", { id }),
  },

  tasks: {
    list: (storyId: string) => invoke<Task[]>("list_tasks", { storyId }),
    get: (id: string) => invoke<Task | null>("get_task", { id }),
    create: (input: NewTask) => invoke<Task>("create_task", { input }),
    update: (input: UpdateTask) => invoke<Task>("update_task", { input }),
    remove: (id: string) => invoke<void>("delete_task", { id }),
  },

  comments: {
    list: (taskId: string) => invoke<Comment[]>("list_comments", { taskId }),
    create: (input: NewComment) =>
      invoke<Comment>("create_comment", { input }),
    remove: (id: string) => invoke<void>("delete_comment", { id }),
  },

  notes: {
    list: () => invoke<Note[]>("list_notes"),
    listForProject: (projectId: string) =>
      invoke<Note[]>("list_notes_for_project", { projectId }),
    get: (id: string) => invoke<Note | null>("get_note", { id }),
    create: (input: NewNote) => invoke<Note>("create_note", { input }),
    update: (input: UpdateNote) => invoke<Note>("update_note", { input }),
    remove: (id: string) => invoke<void>("delete_note", { id }),
  },

  search: (query: string, limit?: number) =>
    invoke<SearchHit[]>("search", { query, limit }),

  system: {
    info: () => invoke<SystemInfo>("get_system_info"),
    reset: () => invoke<void>("reset_database"),
    quit: () => invoke<void>("quit_app"),
  },

  mcp: {
    status: () => invoke<McpStatus>("get_mcp_status"),
    setMode: (mode: McpMode) => invoke<McpStatus>("set_mcp_mode", { mode }),
  },

  sync: {
    fromPeer: (url: string) => invoke<SyncSummary>("sync_from_peer", { url }),
  },
};

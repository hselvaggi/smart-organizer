import { invoke } from "@tauri-apps/api/core";
import type {
  Comment,
  NewComment,
  NewProject,
  NewStory,
  NewTask,
  Project,
  Story,
  Task,
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
};

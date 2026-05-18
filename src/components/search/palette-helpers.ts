import DOMPurify from "dompurify";
import type { SearchHit } from "@/types/generated";

export type SearchTarget =
  | { to: "/projects/$projectId"; params: { projectId: string } }
  | {
      to: "/projects/$projectId/stories/$storyId";
      params: { projectId: string; storyId: string };
    }
  | {
      to: "/projects/$projectId/stories/$storyId/tasks/$taskId";
      params: { projectId: string; storyId: string; taskId: string };
    }
  | { to: "/notes/$noteId"; params: { noteId: string } };

export function routeFor(hit: SearchHit): SearchTarget | null {
  switch (hit.kind) {
    case "project":
      if (!hit.projectId) return null;
      return {
        to: "/projects/$projectId",
        params: { projectId: hit.projectId },
      };
    case "story":
      if (!hit.projectId || !hit.storyId) return null;
      return {
        to: "/projects/$projectId/stories/$storyId",
        params: { projectId: hit.projectId, storyId: hit.storyId },
      };
    case "task":
    case "comment":
      if (!hit.projectId || !hit.storyId || !hit.taskId) return null;
      return {
        to: "/projects/$projectId/stories/$storyId/tasks/$taskId",
        params: {
          projectId: hit.projectId,
          storyId: hit.storyId,
          taskId: hit.taskId,
        },
      };
    case "note":
      if (!hit.entityId) return null;
      return { to: "/notes/$noteId", params: { noteId: hit.entityId } };
    default:
      return null;
  }
}

export function sanitizeSnippet(snippet: string): string {
  return DOMPurify.sanitize(snippet, {
    ALLOWED_TAGS: ["mark"],
    ALLOWED_ATTR: [],
  });
}

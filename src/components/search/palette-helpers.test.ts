import { describe, expect, it } from "vitest";
import type { SearchHit } from "@/types/generated";
import { routeFor, sanitizeSnippet } from "./palette-helpers";

function hit(overrides: Partial<SearchHit>): SearchHit {
  return {
    kind: "project",
    entityId: "e1",
    projectId: null,
    storyId: null,
    taskId: null,
    title: "",
    snippet: "",
    score: 0,
    ...overrides,
  };
}

describe("routeFor", () => {
  it("routes a project hit", () => {
    expect(routeFor(hit({ kind: "project", projectId: "p1" }))).toEqual({
      to: "/projects/$projectId",
      params: { projectId: "p1" },
    });
  });

  it("routes a story hit", () => {
    expect(
      routeFor(hit({ kind: "story", projectId: "p1", storyId: "s1" })),
    ).toEqual({
      to: "/projects/$projectId/stories/$storyId",
      params: { projectId: "p1", storyId: "s1" },
    });
  });

  it("routes a task hit", () => {
    expect(
      routeFor(
        hit({
          kind: "task",
          projectId: "p1",
          storyId: "s1",
          taskId: "t1",
        }),
      ),
    ).toEqual({
      to: "/projects/$projectId/stories/$storyId/tasks/$taskId",
      params: { projectId: "p1", storyId: "s1", taskId: "t1" },
    });
  });

  it("routes a comment hit to its parent task", () => {
    expect(
      routeFor(
        hit({
          kind: "comment",
          projectId: "p1",
          storyId: "s1",
          taskId: "t1",
        }),
      ),
    ).toEqual({
      to: "/projects/$projectId/stories/$storyId/tasks/$taskId",
      params: { projectId: "p1", storyId: "s1", taskId: "t1" },
    });
  });

  it("routes a note hit using entityId as noteId", () => {
    expect(routeFor(hit({ kind: "note", entityId: "n1" }))).toEqual({
      to: "/notes/$noteId",
      params: { noteId: "n1" },
    });
  });

  it("returns null when a required parent id is missing", () => {
    expect(routeFor(hit({ kind: "story", projectId: "p1" }))).toBeNull();
    expect(routeFor(hit({ kind: "task", projectId: "p1", storyId: "s1" }))).toBeNull();
    expect(routeFor(hit({ kind: "comment", projectId: "p1" }))).toBeNull();
    expect(routeFor(hit({ kind: "project" }))).toBeNull();
  });

  it("returns null for unknown kinds", () => {
    expect(routeFor(hit({ kind: "unknown" }))).toBeNull();
  });
});

describe("sanitizeSnippet", () => {
  it("preserves <mark> highlights from FTS5", () => {
    expect(sanitizeSnippet("hello <mark>world</mark>")).toBe(
      "hello <mark>world</mark>",
    );
  });

  it("strips disallowed tags", () => {
    expect(sanitizeSnippet("foo <script>alert(1)</script> bar")).toBe(
      "foo  bar",
    );
  });

  it("strips event handlers on disallowed tags", () => {
    expect(sanitizeSnippet('<img src=x onerror="alert(1)">')).toBe("");
  });

  it("strips attributes from <mark>", () => {
    const out = sanitizeSnippet(
      '<mark onclick="alert(1)" id="evil">x</mark>',
    );
    expect(out).toBe("<mark>x</mark>");
  });

  it("passes plain text untouched", () => {
    expect(sanitizeSnippet("nothing to do here")).toBe("nothing to do here");
  });
});

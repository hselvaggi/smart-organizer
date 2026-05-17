import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  CheckCircle2,
  Circle,
  ChevronRight,
  CircleDashed,
  CircleSlash,
  FileText,
  ListTree,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { TaskDialog } from "@/components/task/task-dialog";
import { StoryDialog } from "@/components/story/story-dialog";
import { useProject } from "@/lib/queries/projects";
import { useStory } from "@/lib/queries/stories";
import {
  useDeleteTask,
  useTasks,
  useUpdateTask,
} from "@/lib/queries/tasks";
import type { Task, TaskStatus } from "@/types/generated";

type DialogState =
  | { kind: "create"; storyId: string; parentTaskId?: string | null }
  | { kind: "edit"; task: Task }
  | null;

export const Route = createFileRoute(
  "/projects/$projectId/stories/$storyId",
)({
  component: StoryDetail,
});

function StoryDetail() {
  const { projectId, storyId } = Route.useParams();
  const { data: project } = useProject(projectId);
  const { data: story } = useStory(storyId);
  const { data: tasks, isLoading } = useTasks(storyId);
  const remove = useDeleteTask(storyId);
  const update = useUpdateTask(storyId);

  const [dialog, setDialog] = useState<DialogState>(null);
  const [storyDialogOpen, setStoryDialogOpen] = useState(false);

  const topLevel = (tasks ?? []).filter((t) => !t.parentTaskId);
  const subtaskCount = (parentId: string) =>
    (tasks ?? []).filter((t) => t.parentTaskId === parentId).length;

  return (
    <div className="flex h-full flex-col gap-6 p-8">
      <Breadcrumbs
        projectId={projectId}
        projectTitle={project?.title ?? "…"}
        storyTitle={story?.title ?? "…"}
      />

      <header className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">
            {story?.title ?? "Loading…"}
          </h2>
          <p className="text-sm text-muted-foreground">Tasks for this story</p>
        </div>
        <div className="flex items-center gap-2">
          {story && (
            <Button variant="outline" onClick={() => setStoryDialogOpen(true)}>
              <Pencil />
              Edit story
            </Button>
          )}
          <Button onClick={() => setDialog({ kind: "create", storyId })}>
            <Plus />
            Add task
          </Button>
        </div>
      </header>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading tasks…</p>
      ) : topLevel.length === 0 ? (
        <EmptyTasks
          onAdd={() => setDialog({ kind: "create", storyId })}
        />
      ) : (
        <ul className="grid max-w-3xl grid-cols-1 gap-1">
          {topLevel.map((t) => (
            <TaskRow
              key={t.id}
              task={t}
              subtaskCount={subtaskCount(t.id)}
              onOpen={() => setDialog({ kind: "edit", task: t })}
              onToggleStatus={() =>
                update.mutate({
                  id: t.id,
                  status: nextStatus(t.status),
                  title: null,
                  description: null,
                  descriptionFormat: null,
                  result: null,
                  resultFormat: null,
                  parentTaskId: null,
                  sortOrder: null,
                })
              }
              onDelete={() => remove.mutate(t.id)}
            />
          ))}
        </ul>
      )}

      {dialog && (
        <TaskDialog
          open
          onOpenChange={(open) => !open && setDialog(null)}
          mode={dialog}
        />
      )}

      {story && storyDialogOpen && (
        <StoryDialog
          open
          onOpenChange={setStoryDialogOpen}
          mode={{ kind: "edit", story }}
        />
      )}
    </div>
  );
}

function EmptyTasks({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="flex max-w-3xl flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border p-10 text-center">
      <ListTree className="size-8 text-muted-foreground" />
      <p className="text-sm font-medium">No tasks yet</p>
      <p className="max-w-sm text-xs text-muted-foreground">
        Create your first task. Each one can carry a description, result,
        subtasks and rich notes.
      </p>
      <Button onClick={onAdd} size="sm">
        <Plus />
        Add task
      </Button>
    </div>
  );
}

function TaskRow({
  task,
  subtaskCount,
  onOpen,
  onToggleStatus,
  onDelete,
}: {
  task: Task;
  subtaskCount: number;
  onOpen: () => void;
  onToggleStatus: () => void;
  onDelete: () => void;
}) {
  const hasDescription = task.description.trim().length > 0;
  const preview = task.description.trim().slice(0, 120);
  return (
    <li className="group rounded-md border border-border bg-card transition-colors hover:border-primary/40">
      <div className="flex items-center gap-2 p-2">
        <Button
          size="icon"
          variant="ghost"
          onClick={onToggleStatus}
          aria-label="Toggle status"
        >
          <StatusIcon status={task.status} />
        </Button>
        <button
          type="button"
          onClick={onOpen}
          className="flex flex-1 items-center gap-2 text-left text-sm"
        >
          <span
            className={task.status === "done" ? "line-through opacity-60" : ""}
          >
            {task.title}
          </span>
          {hasDescription && (
            <FileText
              size={12}
              className="text-muted-foreground"
              aria-label="Has description"
            />
          )}
          {subtaskCount > 0 && (
            <span className="flex items-center gap-0.5 rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
              <ListTree size={10} />
              {subtaskCount}
            </span>
          )}
          <span className="ml-auto flex items-center gap-1 text-xs text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100">
            Open
            <ChevronRight size={12} />
          </span>
        </button>
        <Button
          size="icon"
          variant="ghost"
          className="opacity-0 transition-opacity group-hover:opacity-100"
          onClick={onDelete}
          aria-label="Delete task"
        >
          <Trash2 />
        </Button>
      </div>
      {hasDescription && (
        <p className="border-t border-border/60 px-3 py-1.5 text-xs text-muted-foreground">
          {preview}
          {task.description.length > 120 ? "…" : ""}
        </p>
      )}
    </li>
  );
}

function StatusIcon({ status }: { status: TaskStatus }) {
  switch (status) {
    case "todo":
      return <Circle size={16} className="text-muted-foreground" />;
    case "in_progress":
      return <CircleDashed size={16} className="text-primary" />;
    case "done":
      return <CheckCircle2 size={16} className="text-emerald-400" />;
    case "blocked":
      return <CircleSlash size={16} className="text-amber-400" />;
    case "cancelled":
      return <CircleSlash size={16} className="text-muted-foreground" />;
  }
}

function nextStatus(s: TaskStatus): TaskStatus {
  switch (s) {
    case "todo":
      return "in_progress";
    case "in_progress":
      return "done";
    case "done":
      return "todo";
    case "blocked":
      return "todo";
    case "cancelled":
      return "todo";
  }
}

function Breadcrumbs({
  projectId,
  projectTitle,
  storyTitle,
}: {
  projectId: string;
  projectTitle: string;
  storyTitle: string;
}) {
  return (
    <nav className="flex items-center gap-1 text-xs text-muted-foreground">
      <Link to="/" className="hover:text-foreground">
        Projects
      </Link>
      <ChevronRight size={12} />
      <Link
        to="/projects/$projectId"
        params={{ projectId }}
        className="hover:text-foreground"
      >
        {projectTitle}
      </Link>
      <ChevronRight size={12} />
      <span className="text-foreground">{storyTitle}</span>
    </nav>
  );
}

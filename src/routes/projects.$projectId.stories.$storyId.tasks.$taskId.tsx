import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  ChevronRight,
  ListTree,
  Plus,
  Save,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Breadcrumb, type BreadcrumbItem } from "@/components/breadcrumb";
import { SplitEditor } from "@/components/editor/split-editor";
import { StatusIcon, nextStatus } from "@/components/task/task-status";
import { Timeline } from "@/components/timeline";
import { cn } from "@/lib/cn";
import {
  DEADLINE_BORDER,
  getDeadlineStatus,
  useYellowDays,
} from "@/lib/deadline";
import { useProject } from "@/lib/queries/projects";
import { useStory } from "@/lib/queries/stories";
import {
  useCreateTask,
  useDeleteTask,
  useTask,
  useTasks,
  useUpdateTask,
} from "@/lib/queries/tasks";
import {
  useComments,
  useCreateComment,
  useDeleteComment,
} from "@/lib/queries/comments";
import { renderField } from "@/lib/render";
import type {
  Comment,
  Task,
  TaskStatus,
  TextFormat,
} from "@/types/generated";

const STATUSES: TaskStatus[] = [
  "todo",
  "in_progress",
  "done",
  "blocked",
  "cancelled",
];

export const Route = createFileRoute(
  "/projects/$projectId/stories/$storyId/tasks/$taskId",
)({
  component: TaskDetail,
});

function TaskDetail() {
  const { projectId, storyId, taskId } = Route.useParams();
  const navigate = useNavigate();

  const { data: project } = useProject(projectId);
  const { data: story } = useStory(storyId);
  const { data: task } = useTask(taskId);
  const { data: storyTasks } = useTasks(storyId);

  const update = useUpdateTask(storyId);
  const remove = useDeleteTask(storyId);
  const create = useCreateTask(storyId);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [descriptionFormat, setDescriptionFormat] =
    useState<TextFormat>("plaintext");
  const [result, setResult] = useState("");
  const [resultFormat, setResultFormat] = useState<TextFormat>("plaintext");
  const [status, setStatus] = useState<TaskStatus>("todo");
  const [dueDate, setDueDate] = useState<string>("");

  useEffect(() => {
    if (!task) return;
    setTitle(task.title);
    setDescription(task.description);
    setDescriptionFormat(task.descriptionFormat);
    setResult(task.result);
    setResultFormat(task.resultFormat);
    setStatus(task.status);
    setDueDate(task.dueDate ?? "");
  }, [task]);

  const ancestors = task ? ancestorTasks(task, storyTasks ?? []) : [];
  const subtasks = (storyTasks ?? []).filter((t) => t.parentTaskId === taskId);

  const items: BreadcrumbItem[] = [
    { label: "Projects", to: "/" },
    {
      label: project?.title ?? "…",
      to: "/projects/$projectId",
      params: { projectId },
    },
    {
      label: story?.title ?? "…",
      to: "/projects/$projectId/stories/$storyId",
      params: { projectId, storyId },
    },
    ...ancestors.map((a) => ({
      label: a.title,
      to: "/projects/$projectId/stories/$storyId/tasks/$taskId" as const,
      params: { projectId, storyId, taskId: a.id },
    })),
    { label: task?.title ?? "…" },
  ];

  const canSave = !!task && title.trim().length > 0 && !update.isPending;

  const handleSave = async () => {
    if (!task || !canSave) return;
    await update.mutateAsync({
      id: task.id,
      title: title.trim(),
      description,
      descriptionFormat,
      result,
      resultFormat,
      status,
      parentTaskId: null,
      sortOrder: null,
      dueDate: dueDate || null,
    });
  };

  const handleDelete = async () => {
    if (!task) return;
    await remove.mutateAsync(task.id);
    navigate({
      to: "/projects/$projectId/stories/$storyId",
      params: { projectId, storyId },
    });
  };

  const handleAddSubtask = async () => {
    if (!task) return;
    const created = await create.mutateAsync({
      storyId,
      title: "Untitled subtask",
      description: "",
      descriptionFormat: "plaintext",
      parentTaskId: task.id,
    });
    navigate({
      to: "/projects/$projectId/stories/$storyId/tasks/$taskId",
      params: { projectId, storyId, taskId: created.id },
    });
  };

  if (!task) {
    return (
      <div className="flex h-full flex-col gap-6 p-8">
        <Breadcrumb items={items} />
        <p className="text-sm text-muted-foreground">Loading task…</p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col gap-6 overflow-y-auto p-8">
      <Breadcrumb items={items} />
      <Timeline startedAt={task.startedAt} completedAt={task.completedAt} />

      <header className="flex items-start justify-between gap-4">
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Task title"
          className="flex-1 text-xl font-semibold"
        />
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            onClick={handleDelete}
            aria-label="Delete task"
          >
            <Trash2 />
            Delete
          </Button>
          <Button type="button" onClick={handleSave} disabled={!canSave}>
            <Save />
            {update.isPending ? "Saving…" : "Save"}
          </Button>
        </div>
      </header>

      <div className="flex flex-col gap-4">
        <Field label="Description">
          <SplitEditor
            value={description}
            onChange={setDescription}
            format={descriptionFormat}
            onFormatChange={setDescriptionFormat}
            placeholder="Add context, requirements, references…"
          />
        </Field>

        <SubtasksSection
          subtasks={subtasks}
          storyTasks={storyTasks ?? []}
          onOpen={(id) =>
            navigate({
              to: "/projects/$projectId/stories/$storyId/tasks/$taskId",
              params: { projectId, storyId, taskId: id },
            })
          }
          onAdd={handleAddSubtask}
          onToggle={(t) =>
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
              dueDate: null,
            })
          }
          onDelete={(id) => remove.mutate(id)}
        />

        <Field label="Result / notes">
          <SplitEditor
            value={result}
            onChange={setResult}
            format={resultFormat}
            onFormatChange={setResultFormat}
            placeholder="Outcomes, conclusions, follow-ups…"
          />
        </Field>

        <div className="flex flex-wrap gap-4">
          <Field label="Status">
            <Select
              value={status}
              onValueChange={(v) => setStatus(v as TaskStatus)}
            >
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s.replace("_", " ")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field label="Due date">
            <Input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-48"
            />
          </Field>
        </div>

        <CommentsSection taskId={taskId} />
      </div>
    </div>
  );
}

function CommentsSection({ taskId }: { taskId: string }) {
  const { data: comments } = useComments(taskId);
  const create = useCreateComment(taskId);
  const remove = useDeleteComment(taskId);

  const [body, setBody] = useState("");
  const [format, setFormat] = useState<TextFormat>("plaintext");

  const canSubmit = body.trim().length > 0 && !create.isPending;

  const handleAdd = async () => {
    if (!canSubmit) return;
    await create.mutateAsync({
      taskId,
      body: body.trim(),
      bodyFormat: format,
    });
    setBody("");
  };

  return (
    <section className="flex flex-col gap-3 border-t border-border pt-4">
      <h3 className="text-sm font-semibold">Comments</h3>

      {(comments ?? []).length === 0 ? (
        <p className="rounded-md border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
          No comments yet. Use this for follow-ups, decisions, or quick notes.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {comments!.map((c) => (
            <CommentRow
              key={c.id}
              comment={c}
              onDelete={() => remove.mutate(c.id)}
            />
          ))}
        </ul>
      )}

      <div className="flex flex-col gap-2 rounded-md border border-border bg-card/40 p-3">
        <SplitEditor
          value={body}
          onChange={setBody}
          format={format}
          onFormatChange={setFormat}
          placeholder="Write a comment…"
          minHeight={120}
        />
        <div className="flex justify-end">
          <Button
            type="button"
            size="sm"
            onClick={handleAdd}
            disabled={!canSubmit}
          >
            <Plus />
            {create.isPending ? "Posting…" : "Post comment"}
          </Button>
        </div>
      </div>
    </section>
  );
}

function CommentRow({
  comment,
  onDelete,
}: {
  comment: Comment;
  onDelete: () => void;
}) {
  const html = renderField(comment.body, comment.bodyFormat);
  return (
    <li className="group rounded-md border border-border bg-background p-3">
      <header className="mb-1 flex items-center justify-between text-[11px] text-muted-foreground">
        <time dateTime={comment.createdAt}>
          {new Date(comment.createdAt).toLocaleString()}
        </time>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="opacity-0 transition-opacity group-hover:opacity-100"
          onClick={onDelete}
          aria-label="Delete comment"
        >
          <Trash2 />
        </Button>
      </header>
      <div
        className="prose-tasks"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </li>
  );
}

function SubtasksSection({
  subtasks,
  storyTasks,
  onOpen,
  onAdd,
  onToggle,
  onDelete,
}: {
  subtasks: Task[];
  storyTasks: Task[];
  onOpen: (id: string) => void;
  onAdd: () => void;
  onToggle: (t: Task) => void;
  onDelete: (id: string) => void;
}) {
  const [yellowDays] = useYellowDays();
  const childCount = (id: string) =>
    storyTasks.filter((t) => t.parentTaskId === id).length;

  return (
    <section className="flex flex-col gap-2 border-t border-border pt-4">
      <header className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Subtasks</h3>
        <Button type="button" size="sm" variant="outline" onClick={onAdd}>
          <Plus />
          Add subtask
        </Button>
      </header>

      {subtasks.length === 0 ? (
        <p className="rounded-md border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
          No subtasks yet — break this task down with "Add subtask".
        </p>
      ) : (
        <ul className="flex flex-col gap-1">
          {subtasks.map((s) => (
            <li
              key={s.id}
              className={cn(
                "group flex items-center gap-2 rounded-md border border-border bg-background p-2",
                DEADLINE_BORDER[getDeadlineStatus(s.dueDate, s.status, yellowDays)],
              )}
            >
              <Button
                type="button"
                size="icon"
                variant="ghost"
                onClick={() => onToggle(s)}
                aria-label="Toggle status"
              >
                <StatusIcon status={s.status} />
              </Button>
              <button
                type="button"
                onClick={() => onOpen(s.id)}
                className="flex flex-1 items-center gap-2 text-left text-sm"
              >
                <span
                  className={s.status === "done" ? "line-through opacity-60" : ""}
                >
                  {s.title}
                </span>
                {childCount(s.id) > 0 && (
                  <span className="flex items-center gap-0.5 rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                    <ListTree size={10} />
                    {childCount(s.id)}
                  </span>
                )}
                <span className="ml-auto flex items-center gap-1 text-xs text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100">
                  Open
                  <ChevronRight size={12} />
                </span>
              </button>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="opacity-0 transition-opacity group-hover:opacity-100"
                onClick={() => onDelete(s.id)}
                aria-label="Delete subtask"
              >
                <Trash2 />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function ancestorTasks(task: Task, allTasks: Task[]): Task[] {
  const chain: Task[] = [];
  let current = task;
  while (current.parentTaskId) {
    const parent = allTasks.find((t) => t.id === current.parentTaskId);
    if (!parent) break;
    chain.unshift(parent);
    current = parent;
  }
  return chain;
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium">{label}</label>
      {children}
    </div>
  );
}

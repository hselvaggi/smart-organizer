import { useEffect, useState } from "react";
import {
  CheckCircle2,
  Circle,
  CircleDashed,
  CircleSlash,
  Plus,
  Save,
  Trash2,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SplitEditor } from "@/components/editor/split-editor";
import {
  useCreateTask,
  useDeleteTask,
  useTasks,
  useUpdateTask,
} from "@/lib/queries/tasks";
import type { Task, TaskStatus, TextFormat } from "@/types/generated";

const STATUSES: TaskStatus[] = [
  "todo",
  "in_progress",
  "done",
  "blocked",
  "cancelled",
];

type Mode =
  | { kind: "create"; storyId: string; parentTaskId?: string | null }
  | { kind: "edit"; task: Task };

export function TaskDialog({
  open,
  onOpenChange,
  mode,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: Mode;
}) {
  const storyId = mode.kind === "create" ? mode.storyId : mode.task.storyId;
  const create = useCreateTask(storyId);
  const update = useUpdateTask(storyId);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [descriptionFormat, setDescriptionFormat] =
    useState<TextFormat>("plaintext");
  const [result, setResult] = useState("");
  const [resultFormat, setResultFormat] = useState<TextFormat>("plaintext");
  const [status, setStatus] = useState<TaskStatus>("todo");

  useEffect(() => {
    if (!open) return;
    if (mode.kind === "create") {
      setTitle("");
      setDescription("");
      setDescriptionFormat("plaintext");
      setResult("");
      setResultFormat("plaintext");
      setStatus("todo");
    } else {
      const t = mode.task;
      setTitle(t.title);
      setDescription(t.description);
      setDescriptionFormat(t.descriptionFormat);
      setResult(t.result);
      setResultFormat(t.resultFormat);
      setStatus(t.status);
    }
  }, [open, mode]);

  const isCreate = mode.kind === "create";
  const pending = isCreate ? create.isPending : update.isPending;
  const canSubmit = title.trim().length > 0 && !pending;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    if (isCreate) {
      await create.mutateAsync({
        storyId,
        title: title.trim(),
        description,
        descriptionFormat,
        parentTaskId: mode.parentTaskId ?? null,
      });
    } else {
      await update.mutateAsync({
        id: mode.task.id,
        title: title.trim(),
        description,
        descriptionFormat,
        result,
        resultFormat,
        status,
        parentTaskId: null,
        sortOrder: null,
      });
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-5xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isCreate ? "New task" : "Edit task"}</DialogTitle>
          <DialogDescription>
            {isCreate
              ? "Title is required; everything else is optional."
              : "Edit any field and click Save when ready."}
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={submit}
          className="flex flex-col gap-4"
          id="task-form"
        >
          <Field label="Title">
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="What needs to be done?"
              autoFocus
              required
            />
          </Field>

          <Field label="Description">
            <SplitEditor
              value={description}
              onChange={setDescription}
              format={descriptionFormat}
              onFormatChange={setDescriptionFormat}
              placeholder="Add context, requirements, references…"
            />
          </Field>

          <SubtasksSection parentTask={isCreate ? null : mode.task} />

          {!isCreate && (
            <>
              <Field label="Result / notes">
                <SplitEditor
                  value={result}
                  onChange={setResult}
                  format={resultFormat}
                  onFormatChange={setResultFormat}
                  placeholder="Outcomes, conclusions, follow-ups…"
                />
              </Field>

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
            </>
          )}
        </form>

        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button type="submit" form="task-form" disabled={!canSubmit}>
            {isCreate ? <Plus /> : <Save />}
            {pending
              ? isCreate
                ? "Creating…"
                : "Saving…"
              : isCreate
                ? "Create"
                : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SubtasksSection({ parentTask }: { parentTask: Task | null }) {
  if (!parentTask) {
    return (
      <section className="flex flex-col gap-2 border-t border-border pt-4">
        <header className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Subtasks</h3>
          <Button type="button" size="sm" variant="outline" disabled>
            <Plus />
            Add subtask
          </Button>
        </header>
        <p className="rounded-md border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
          Save this task first to break it down into subtasks.
        </p>
      </section>
    );
  }

  return <SubtasksList parentTask={parentTask} />;
}

function SubtasksList({ parentTask }: { parentTask: Task }) {
  const { data: allTasks } = useTasks(parentTask.storyId);
  const remove = useDeleteTask(parentTask.storyId);
  const update = useUpdateTask(parentTask.storyId);
  const [childMode, setChildMode] = useState<Mode | null>(null);

  const subtasks = (allTasks ?? []).filter(
    (t) => t.parentTaskId === parentTask.id,
  );

  return (
    <section className="flex flex-col gap-2 border-t border-border pt-4">
      <header className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Subtasks</h3>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() =>
            setChildMode({
              kind: "create",
              storyId: parentTask.storyId,
              parentTaskId: parentTask.id,
            })
          }
        >
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
              className="group flex items-center gap-2 rounded-md border border-border bg-background p-2"
            >
              <Button
                type="button"
                size="icon"
                variant="ghost"
                onClick={() =>
                  update.mutate({
                    id: s.id,
                    status: nextStatus(s.status),
                    title: null,
                    description: null,
                    descriptionFormat: null,
                    result: null,
                    resultFormat: null,
                    parentTaskId: null,
                    sortOrder: null,
                  })
                }
                aria-label="Toggle status"
              >
                <StatusIcon status={s.status} />
              </Button>
              <button
                type="button"
                onClick={() => setChildMode({ kind: "edit", task: s })}
                className="flex-1 text-left text-sm"
              >
                <span
                  className={s.status === "done" ? "line-through opacity-60" : ""}
                >
                  {s.title}
                </span>
              </button>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="opacity-0 transition-opacity group-hover:opacity-100"
                onClick={() => remove.mutate(s.id)}
                aria-label="Delete subtask"
              >
                <Trash2 />
              </Button>
            </li>
          ))}
        </ul>
      )}

      {childMode && (
        <TaskDialog
          open
          onOpenChange={(o) => !o && setChildMode(null)}
          mode={childMode}
        />
      )}
    </section>
  );
}

export function StatusIcon({ status }: { status: TaskStatus }) {
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

export function nextStatus(s: TaskStatus): TaskStatus {
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

function Field({
  label,
  trailing,
  children,
}: {
  label: string;
  trailing?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium">{label}</label>
        {trailing}
      </div>
      {children}
    </div>
  );
}


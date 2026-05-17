import { useEffect, useState } from "react";
import { Plus, Save, Trash2 } from "lucide-react";
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
import { SplitEditor } from "@/components/editor/split-editor";
import {
  StatusIcon,
  TaskDialog,
  nextStatus,
} from "@/components/task/task-dialog";
import {
  useCreateStory,
  useUpdateStory,
} from "@/lib/queries/stories";
import {
  useDeleteTask,
  useTasks,
  useUpdateTask,
} from "@/lib/queries/tasks";
import type { Story, Task, TextFormat } from "@/types/generated";

type Mode =
  | { kind: "create"; projectId: string }
  | { kind: "edit"; story: Story };

type ChildTaskMode =
  | { kind: "create"; storyId: string; parentTaskId?: string | null }
  | { kind: "edit"; task: Task };

export function StoryDialog({
  open,
  onOpenChange,
  mode,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: Mode;
}) {
  const projectId =
    mode.kind === "create" ? mode.projectId : mode.story.projectId;
  const create = useCreateStory(projectId);
  const update = useUpdateStory(projectId);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [descriptionFormat, setDescriptionFormat] =
    useState<TextFormat>("plaintext");

  useEffect(() => {
    if (!open) return;
    if (mode.kind === "create") {
      setTitle("");
      setDescription("");
      setDescriptionFormat("plaintext");
    } else {
      const s = mode.story;
      setTitle(s.title);
      setDescription(s.description);
      setDescriptionFormat(s.descriptionFormat);
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
        projectId,
        title: title.trim(),
        description,
        descriptionFormat,
      });
    } else {
      await update.mutateAsync({
        id: mode.story.id,
        title: title.trim(),
        description,
        descriptionFormat,
      });
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isCreate ? "New story" : "Edit story"}</DialogTitle>
          <DialogDescription>
            Stories group related tasks — sprints, themes, or chapters.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="flex flex-col gap-4" id="story-form">
          <Field label="Title">
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Story title"
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
              placeholder="Context, goals, references…"
            />
          </Field>

          <TasksSection story={isCreate ? null : mode.story} />
        </form>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" form="story-form" disabled={!canSubmit}>
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

function TasksSection({ story }: { story: Story | null }) {
  if (!story) {
    return (
      <section className="flex flex-col gap-2 border-t border-border pt-4">
        <header className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Tasks</h3>
          <Button type="button" size="sm" variant="outline" disabled>
            <Plus />
            Add task
          </Button>
        </header>
        <p className="rounded-md border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
          Save this story first to start adding tasks.
        </p>
      </section>
    );
  }

  return <TasksList story={story} />;
}

function TasksList({ story }: { story: Story }) {
  const { data: allTasks } = useTasks(story.id);
  const remove = useDeleteTask(story.id);
  const update = useUpdateTask(story.id);
  const [childMode, setChildMode] = useState<ChildTaskMode | null>(null);

  const tasks = (allTasks ?? []).filter((t) => !t.parentTaskId);

  return (
    <section className="flex flex-col gap-2 border-t border-border pt-4">
      <header className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Tasks</h3>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() =>
            setChildMode({
              kind: "create",
              storyId: story.id,
              parentTaskId: null,
            })
          }
        >
          <Plus />
          Add task
        </Button>
      </header>

      {tasks.length === 0 ? (
        <p className="rounded-md border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
          No tasks yet — break this story down with "Add task".
        </p>
      ) : (
        <ul className="flex flex-col gap-1">
          {tasks.map((t) => (
            <li
              key={t.id}
              className="group flex items-center gap-2 rounded-md border border-border bg-background p-2"
            >
              <Button
                type="button"
                size="icon"
                variant="ghost"
                onClick={() =>
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
                aria-label="Toggle status"
              >
                <StatusIcon status={t.status} />
              </Button>
              <button
                type="button"
                onClick={() => setChildMode({ kind: "edit", task: t })}
                className="flex-1 text-left text-sm"
              >
                <span
                  className={t.status === "done" ? "line-through opacity-60" : ""}
                >
                  {t.title}
                </span>
              </button>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="opacity-0 transition-opacity group-hover:opacity-100"
                onClick={() => remove.mutate(t.id)}
                aria-label="Delete task"
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

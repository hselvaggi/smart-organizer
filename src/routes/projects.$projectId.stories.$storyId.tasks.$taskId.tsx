import { useEffect, useRef, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { LayoutGrid, Save, Trash2 } from "lucide-react";
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
import { RichTextField } from "@/components/rich-text-field";
import { TaskComments } from "@/components/task/task-comments";
import { TaskSubtasks } from "@/components/task/task-subtasks";
import { nextStatus } from "@/components/task/task-status";
import { Timeline } from "@/components/timeline";
import { useConfirmDelete } from "@/lib/confirm";
import { useProject } from "@/lib/queries/projects";
import { useStory } from "@/lib/queries/stories";
import {
  useCreateTask,
  useDeleteTask,
  useTask,
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

export const Route = createFileRoute(
  "/projects/$projectId/stories/$storyId/tasks/$taskId",
)({
  validateSearch: (
    search: Record<string, unknown>,
  ): { parent?: string } => ({
    parent: typeof search.parent === "string" ? search.parent : undefined,
  }),
  component: TaskDetail,
});

function TaskDetail() {
  const { t } = useTranslation();
  const { projectId, storyId, taskId } = Route.useParams();
  const { parent: parentTaskIdFromSearch } = Route.useSearch();
  const isCreating = taskId === "new";
  const isCreatingSubtask = isCreating && !!parentTaskIdFromSearch;
  const navigate = useNavigate();
  const confirmDelete = useConfirmDelete();

  const { data: project } = useProject(projectId);
  const { data: story } = useStory(storyId);
  const { data: task } = useTask(isCreating ? "" : taskId);
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
  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isCreating) titleRef.current?.focus();
  }, [isCreating]);

  useEffect(() => {
    if (isCreating || !task) return;
    setTitle(task.title);
    setDescription(task.description);
    setDescriptionFormat(task.descriptionFormat);
    setResult(task.result);
    setResultFormat(task.resultFormat);
    setStatus(task.status);
    setDueDate(task.dueDate ?? "");
  }, [task?.id, isCreating]);

  // When editing, walk up from the loaded task. When creating a subtask, walk
  // up from the parent task referenced in the search params.
  const ancestors = task
    ? ancestorTasks(task, storyTasks ?? [])
    : isCreatingSubtask
      ? (() => {
          const parent = (storyTasks ?? []).find(
            (t) => t.id === parentTaskIdFromSearch,
          );
          if (!parent) return [];
          return [...ancestorTasks(parent, storyTasks ?? []), parent];
        })()
      : [];
  const subtasks = isCreating
    ? []
    : (storyTasks ?? []).filter((t) => t.parentTaskId === taskId);

  const trailingLabel = isCreating
    ? t(isCreatingSubtask ? "tasks.newSubtaskCrumb" : "tasks.newCrumb")
    : (task?.title ?? "…");

  const items: BreadcrumbItem[] = [
    { label: t("nav.projects"), to: "/" },
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
    { label: trailingLabel },
  ];

  const canSubmit =
    title.trim().length > 0 && !update.isPending && !create.isPending;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    if (isCreating) {
      const created = await create.mutateAsync({
        storyId,
        title: title.trim(),
        description,
        descriptionFormat,
        parentTaskId: parentTaskIdFromSearch ?? null,
      });
      navigate({
        to: "/projects/$projectId/stories/$storyId/tasks/$taskId",
        params: { projectId, storyId, taskId: created.id },
        replace: true,
      });
      return;
    }
    if (!task) return;
    await update.mutateAsync({
      id: task.id,
      title: title.trim(),
      description,
      descriptionFormat,
      result,
      resultFormat,
      status,
      dueDate: dueDate || null,
    });
  };

  const handleDelete = async () => {
    if (!task) return;
    // The current task may itself be a subtask — pick the appropriate copy.
    const kind = task.parentTaskId ? "subtask" : "task";
    if (!(await confirmDelete(kind))) return;
    await remove.mutateAsync(task.id);
    navigate({
      to: "/projects/$projectId/stories/$storyId",
      params: { projectId, storyId },
    });
  };

  const handleAddSubtask = () => {
    if (!task) return;
    navigate({
      to: "/projects/$projectId/stories/$storyId/tasks/$taskId",
      params: { projectId, storyId, taskId: "new" },
      search: { parent: task.id },
    });
  };

  if (!isCreating && !task) {
    return (
      <div className="flex h-full flex-col gap-6 p-8">
        <Breadcrumb items={items} />
        <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col gap-6 overflow-y-auto p-8">
      <Breadcrumb items={items} />
      {!isCreating && task && (
        <Timeline startedAt={task.startedAt} completedAt={task.completedAt} />
      )}

      <header className="flex items-start justify-between gap-4">
        <Input
          ref={titleRef}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={t("fields.title")}
          className="flex-1 text-xl font-semibold"
        />
        <div className="flex items-center gap-2">
          {!isCreating && (
            <>
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  navigate({
                    to: "/projects/$projectId/board",
                    params: { projectId },
                  })
                }
              >
                <LayoutGrid />
                {t("projects.boardButton")}
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={handleDelete}
                aria-label={t("tasks.deleteAria")}
              >
                <Trash2 />
                {t("common.delete")}
              </Button>
            </>
          )}
          <Button type="button" onClick={handleSubmit} disabled={!canSubmit}>
            <Save />
            {t(
              isCreating
                ? create.isPending
                  ? "common.creating"
                  : "common.create"
                : update.isPending
                  ? "common.saving"
                  : "common.save",
            )}
          </Button>
        </div>
      </header>

      <div className="flex flex-col gap-4">
        <RichTextField
          label={t("fields.description")}
          value={description}
          onChange={setDescription}
          format={descriptionFormat}
          onFormatChange={setDescriptionFormat}
          placeholder={t("tasks.descriptionPlaceholder")}
          emptyLabel={t("tasks.emptyDescription")}
        />

        {!isCreating && (
          <TaskSubtasks
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
              update.mutate({ id: t.id, status: nextStatus(t.status) })
            }
            onDelete={async (id) => {
              if (await confirmDelete("subtask")) remove.mutate(id);
            }}
          />
        )}

        {!isCreating && (
          <RichTextField
            label={t("fields.result")}
            value={result}
            onChange={setResult}
            format={resultFormat}
            onFormatChange={setResultFormat}
            placeholder={t("tasks.resultPlaceholder")}
            emptyLabel={t("tasks.emptyResult")}
          />
        )}

        {!isCreating && (
          <div className="flex flex-wrap gap-4">
            <Field label={t("fields.status")}>
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
                      {t(`status.${s}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field label={t("fields.dueDate")}>
              <Input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-48"
              />
            </Field>
          </div>
        )}

        {!isCreating && <TaskComments taskId={taskId} />}
      </div>
    </div>
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

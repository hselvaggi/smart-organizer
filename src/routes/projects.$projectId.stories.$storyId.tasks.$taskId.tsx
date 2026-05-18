import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Save, Trash2 } from "lucide-react";
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
  component: TaskDetail,
});

function TaskDetail() {
  const { t } = useTranslation();
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
  }, [task?.id]);

  const ancestors = task ? ancestorTasks(task, storyTasks ?? []) : [];
  const subtasks = (storyTasks ?? []).filter((t) => t.parentTaskId === taskId);

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
      title: t("common.untitledSubtask"),
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
        <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
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
          placeholder={t("fields.title")}
          className="flex-1 text-xl font-semibold"
        />
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            onClick={handleDelete}
            aria-label={t("tasks.deleteAria")}
          >
            <Trash2 />
            {t("common.delete")}
          </Button>
          <Button type="button" onClick={handleSave} disabled={!canSave}>
            <Save />
            {t(update.isPending ? "common.saving" : "common.save")}
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
          onDelete={(id) => remove.mutate(id)}
        />

        <RichTextField
          label={t("fields.result")}
          value={result}
          onChange={setResult}
          format={resultFormat}
          onFormatChange={setResultFormat}
          placeholder={t("tasks.resultPlaceholder")}
          emptyLabel={t("tasks.emptyResult")}
        />

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

        <TaskComments taskId={taskId} />
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

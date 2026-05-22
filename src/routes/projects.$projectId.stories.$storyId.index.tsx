import { useEffect, useRef, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import {
  ChevronRight,
  FileText,
  ListTree,
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
import { ListSection } from "@/components/list-section";
import { RichTextField } from "@/components/rich-text-field";
import { StatusIcon, nextStatus } from "@/components/task/task-status";
import { useConfirmDelete } from "@/lib/confirm";
import { Timeline } from "@/components/timeline";
import { cn } from "@/lib/cn";
import {
  DEADLINE_BORDER,
  getDeadlineStatus,
  useYellowDays,
} from "@/lib/deadline";
import { useProject } from "@/lib/queries/projects";
import {
  useCreateStory,
  useDeleteStory,
  useStory,
  useUpdateStory,
} from "@/lib/queries/stories";
import {
  useDeleteTask,
  useTasks,
  useUpdateTask,
} from "@/lib/queries/tasks";
import type { TaskStatus, TextFormat } from "@/types/generated";

const STATUSES: TaskStatus[] = [
  "todo",
  "in_progress",
  "done",
  "blocked",
  "cancelled",
];

export const Route = createFileRoute(
  "/projects/$projectId/stories/$storyId/",
)({
  component: StoryDetail,
});

function StoryDetail() {
  const { t } = useTranslation();
  const { projectId, storyId } = Route.useParams();
  const isCreating = storyId === "new";
  const navigate = useNavigate();
  const [yellowDays] = useYellowDays();
  const confirmDelete = useConfirmDelete();

  const { data: project } = useProject(projectId);
  const { data: story } = useStory(isCreating ? "" : storyId);
  const { data: tasks } = useTasks(isCreating ? "" : storyId);

  const create = useCreateStory(projectId);
  const update = useUpdateStory(projectId);
  const removeStory = useDeleteStory(projectId);
  const updateTask = useUpdateTask(storyId);
  const removeTask = useDeleteTask(storyId);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [descriptionFormat, setDescriptionFormat] =
    useState<TextFormat>("plaintext");
  const [status, setStatus] = useState<TaskStatus>("todo");
  const [dueDate, setDueDate] = useState<string>("");
  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isCreating) titleRef.current?.focus();
  }, [isCreating]);

  useEffect(() => {
    if (isCreating || !story) return;
    setTitle(story.title);
    setDescription(story.description);
    setDescriptionFormat(story.descriptionFormat);
    setStatus(story.status);
    setDueDate(story.dueDate ?? "");
  }, [story?.id, isCreating]);

  const topLevel = (tasks ?? []).filter((t) => !t.parentTaskId);
  const subtaskCount = (id: string) =>
    (tasks ?? []).filter((t) => t.parentTaskId === id).length;

  const items: BreadcrumbItem[] = [
    { label: t("nav.projects"), to: "/" },
    {
      label: project?.title ?? "…",
      to: "/projects/$projectId",
      params: { projectId },
    },
    { label: isCreating ? t("stories.newCrumb") : (story?.title ?? "…") },
  ];

  const canSubmit =
    title.trim().length > 0 && !update.isPending && !create.isPending;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    if (isCreating) {
      const created = await create.mutateAsync({
        projectId,
        title: title.trim(),
        description,
        descriptionFormat,
      });
      navigate({
        to: "/projects/$projectId/stories/$storyId",
        params: { projectId, storyId: created.id },
        replace: true,
      });
      return;
    }
    if (!story) return;
    await update.mutateAsync({
      id: story.id,
      title: title.trim(),
      description,
      descriptionFormat,
      status,
      dueDate: dueDate || null,
    });
  };

  const handleDelete = async () => {
    if (!story) return;
    if (!(await confirmDelete("story"))) return;
    await removeStory.mutateAsync(story.id);
    navigate({ to: "/projects/$projectId", params: { projectId } });
  };

  const handleAddTask = () => {
    navigate({
      to: "/projects/$projectId/stories/$storyId/tasks/$taskId",
      params: { projectId, storyId, taskId: "new" },
    });
  };

  if (!isCreating && !story) {
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
      {!isCreating && story && (
        <Timeline startedAt={story.startedAt} completedAt={story.completedAt} />
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
            <Button
              type="button"
              variant="ghost"
              onClick={handleDelete}
              aria-label={t("stories.deleteAria")}
            >
              <Trash2 />
              {t("common.delete")}
            </Button>
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
          placeholder={t("stories.descriptionPlaceholder")}
          emptyLabel={t("stories.emptyDescription")}
        />

        {!isCreating && (
          <ListSection
          title={t("fields.tasks")}
          addLabel={t("stories.addTask")}
          onAdd={handleAddTask}
          items={topLevel}
          emptyLabel={t("stories.noTasks")}
          renderItem={(task) => (
            <li
              key={task.id}
              className={cn(
                "group rounded-md border border-border bg-card transition-colors hover:border-primary/40",
                DEADLINE_BORDER[getDeadlineStatus(task.dueDate, task.status, yellowDays)],
              )}
            >
              <div className="flex items-center gap-2 p-2">
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  onClick={() =>
                    updateTask.mutate({
                      id: task.id,
                      status: nextStatus(task.status),
                    })
                  }
                  aria-label={t("tasks.toggleStatusAria")}
                >
                  <StatusIcon status={task.status} />
                </Button>
                <button
                  type="button"
                  onClick={() =>
                    navigate({
                      to: "/projects/$projectId/stories/$storyId/tasks/$taskId",
                      params: { projectId, storyId, taskId: task.id },
                    })
                  }
                  className="flex flex-1 items-center gap-2 text-left text-sm"
                >
                  <span
                    className={
                      task.status === "done" ? "line-through opacity-60" : ""
                    }
                  >
                    {task.title}
                  </span>
                  {task.description.trim().length > 0 && (
                    <FileText size={12} className="text-muted-foreground" />
                  )}
                  {subtaskCount(task.id) > 0 && (
                    <span className="flex items-center gap-0.5 rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                      <ListTree size={10} />
                      {subtaskCount(task.id)}
                    </span>
                  )}
                  <span className="ml-auto flex items-center gap-1 text-xs text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100">
                    {t("common.open")}
                    <ChevronRight size={12} />
                  </span>
                </button>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="opacity-0 transition-opacity group-hover:opacity-100"
                  onClick={async () => {
                    if (await confirmDelete("task")) removeTask.mutate(task.id);
                  }}
                  aria-label={t("stories.deleteTaskAria")}
                >
                  <Trash2 />
                </Button>
              </div>
            </li>
          )}
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
      </div>
    </div>
  );
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

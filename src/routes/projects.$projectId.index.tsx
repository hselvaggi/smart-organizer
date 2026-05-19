import { useEffect, useRef, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import {
  BookOpen,
  ChevronRight,
  FileText,
  LayoutGrid,
  NotebookPen,
  Save,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Breadcrumb, type BreadcrumbItem } from "@/components/breadcrumb";
import { ListSection } from "@/components/list-section";
import { RichTextField } from "@/components/rich-text-field";
import { StatusIcon, nextStatus } from "@/components/task/task-status";
import { cn } from "@/lib/cn";
import {
  DEADLINE_BORDER,
  getDeadlineStatus,
  useYellowDays,
} from "@/lib/deadline";
import {
  useCreateProject,
  useDeleteProject,
  useProject,
  useUpdateProject,
} from "@/lib/queries/projects";
import {
  useDeleteStory,
  useStories,
  useUpdateStory,
} from "@/lib/queries/stories";
import {
  useDeleteNote,
  useNotesForProject,
} from "@/lib/queries/notes";
import type { TextFormat } from "@/types/generated";

export const Route = createFileRoute("/projects/$projectId/")({
  component: ProjectDetail,
});

function ProjectDetail() {
  const { t } = useTranslation();
  const { projectId } = Route.useParams();
  const isCreating = projectId === "new";
  const navigate = useNavigate();
  const [yellowDays] = useYellowDays();

  // In create mode we don't fetch anything — the entity doesn't exist yet.
  // `enabled: !!id` in the query hooks treats "" as a no-op.
  const { data: project } = useProject(isCreating ? "" : projectId);
  const { data: stories } = useStories(isCreating ? "" : projectId);
  const { data: notes } = useNotesForProject(isCreating ? "" : projectId);

  const create = useCreateProject();
  const update = useUpdateProject();
  const removeProject = useDeleteProject();
  const updateStory = useUpdateStory(projectId);
  const removeStory = useDeleteStory(projectId);
  const removeNote = useDeleteNote();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [descriptionFormat, setDescriptionFormat] =
    useState<TextFormat>("plaintext");
  const titleRef = useRef<HTMLInputElement>(null);

  // Focus the title input on first render of create mode.
  useEffect(() => {
    if (isCreating) titleRef.current?.focus();
  }, [isCreating]);

  // Hydrate the form from server data once the project loads (edit mode only).
  useEffect(() => {
    if (isCreating || !project) return;
    setTitle(project.title);
    setDescription(project.description);
    setDescriptionFormat(project.descriptionFormat);
  }, [project?.id, isCreating]);

  const items: BreadcrumbItem[] = [
    { label: t("nav.projects"), to: "/" },
    { label: isCreating ? t("projects.newCrumb") : (project?.title ?? "…") },
  ];

  const canSubmit =
    title.trim().length > 0 && !update.isPending && !create.isPending;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    if (isCreating) {
      const created = await create.mutateAsync({
        title: title.trim(),
        description,
        descriptionFormat,
      });
      navigate({
        to: "/projects/$projectId",
        params: { projectId: created.id },
        replace: true,
      });
      return;
    }
    if (!project) return;
    await update.mutateAsync({
      id: project.id,
      title: title.trim(),
      description,
      descriptionFormat,
    });
  };

  const handleDelete = async () => {
    if (!project) return;
    await removeProject.mutateAsync(project.id);
    navigate({ to: "/" });
  };

  const handleAddStory = () => {
    navigate({
      to: "/projects/$projectId/stories/$storyId",
      params: { projectId, storyId: "new" },
    });
  };

  const handleAddNote = () => {
    navigate({
      to: "/notes/$noteId",
      params: { noteId: "new" },
      search: { projectId },
    });
  };

  if (!isCreating && !project) {
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
                aria-label={t("projects.deleteAria")}
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
          placeholder={t("projects.descriptionPlaceholder")}
          emptyLabel={t("projects.emptyDescription")}
        />

        {!isCreating && (
          <ListSection
          title={t("nav.notes")}
          addLabel={t("projects.addNote")}
          onAdd={handleAddNote}
          items={notes ?? []}
          emptyLabel={t("projects.noNotes")}
          renderItem={(n) => {
            const preview = n.body.replace(/\s+/g, " ").trim().slice(0, 140);
            return (
              <li
                key={n.id}
                className="group flex items-center gap-2 rounded-md border border-border bg-card p-2 transition-colors hover:border-primary/40"
              >
                <button
                  type="button"
                  onClick={() =>
                    navigate({ to: "/notes/$noteId", params: { noteId: n.id } })
                  }
                  className="flex flex-1 flex-col gap-0.5 text-left"
                >
                  <div className="flex items-center gap-2 text-sm">
                    <NotebookPen size={14} className="text-muted-foreground" />
                    <span className="font-medium">{n.title}</span>
                    <span className="ml-auto flex items-center gap-1 text-xs text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100">
                      {t("common.open")}
                      <ChevronRight size={12} />
                    </span>
                  </div>
                  {preview && (
                    <p className="line-clamp-2 text-xs text-muted-foreground">
                      {preview}
                      {n.body.length > 140 ? "…" : ""}
                    </p>
                  )}
                </button>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="opacity-0 transition-opacity group-hover:opacity-100"
                  onClick={() => removeNote.mutate(n.id)}
                  aria-label={t("projects.deleteNoteAria")}
                >
                  <Trash2 />
                </Button>
              </li>
            );
          }}
          />
        )}

        {!isCreating && (
          <ListSection
          title={t("fields.stories")}
          addLabel={t("projects.addStory")}
          onAdd={handleAddStory}
          items={stories ?? []}
          emptyLabel={t("projects.noStories")}
          renderItem={(s) => (
            <li
              key={s.id}
              className={cn(
                "group flex items-center gap-2 rounded-md border border-border bg-card p-2 transition-colors hover:border-primary/40",
                DEADLINE_BORDER[getDeadlineStatus(s.dueDate, s.status, yellowDays)],
              )}
            >
              <Button
                type="button"
                size="icon"
                variant="ghost"
                onClick={() =>
                  updateStory.mutate({ id: s.id, status: nextStatus(s.status) })
                }
                aria-label={t("tasks.toggleStatusAria")}
              >
                <StatusIcon status={s.status} />
              </Button>
              <button
                type="button"
                onClick={() =>
                  navigate({
                    to: "/projects/$projectId/stories/$storyId",
                    params: { projectId, storyId: s.id },
                  })
                }
                className="flex flex-1 items-center gap-2 text-left text-sm"
              >
                <BookOpen size={16} className="text-muted-foreground" />
                <span
                  className={s.status === "done" ? "line-through opacity-60" : ""}
                >
                  {s.title}
                </span>
                {s.description.trim().length > 0 && (
                  <FileText size={12} className="text-muted-foreground" />
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
                onClick={() => removeStory.mutate(s.id)}
                aria-label={t("projects.deleteStoryAria")}
              >
                <Trash2 />
              </Button>
            </li>
          )}
          />
        )}
      </div>
    </div>
  );
}


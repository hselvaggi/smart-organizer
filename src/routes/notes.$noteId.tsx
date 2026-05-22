import { useEffect, useRef, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Save, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Breadcrumb, type BreadcrumbItem } from "@/components/breadcrumb";
import { RichTextField } from "@/components/rich-text-field";
import { useConfirmDelete } from "@/lib/confirm";
import {
  useCreateNote,
  useDeleteNote,
  useNote,
  useUpdateNote,
} from "@/lib/queries/notes";
import { useProject } from "@/lib/queries/projects";
import type { TextFormat } from "@/types/generated";

export const Route = createFileRoute("/notes/$noteId")({
  validateSearch: (
    search: Record<string, unknown>,
  ): { projectId?: string } => ({
    projectId:
      typeof search.projectId === "string" ? search.projectId : undefined,
  }),
  component: NoteDetail,
});

function NoteDetail() {
  const { t } = useTranslation();
  const { noteId } = Route.useParams();
  const { projectId: projectIdFromSearch } = Route.useSearch();
  const isCreating = noteId === "new";
  const navigate = useNavigate();
  const confirmDelete = useConfirmDelete();

  const { data: note } = useNote(isCreating ? "" : noteId);
  // Project context for breadcrumb: either the loaded note's projectId (edit)
  // or the search-param one (create-from-project).
  const projectIdForCrumb = isCreating
    ? (projectIdFromSearch ?? null)
    : (note?.projectId ?? null);
  const { data: project } = useProject(projectIdForCrumb ?? "");

  const create = useCreateNote();
  const update = useUpdateNote();
  const remove = useDeleteNote();

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [bodyFormat, setBodyFormat] = useState<TextFormat>("plaintext");
  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isCreating) titleRef.current?.focus();
  }, [isCreating]);

  useEffect(() => {
    if (isCreating || !note) return;
    setTitle(note.title);
    setBody(note.body);
    setBodyFormat(note.bodyFormat);
  }, [note?.id, isCreating]);

  const trailingLabel = isCreating
    ? t("notes.newCrumb")
    : (note?.title ?? "…");

  const items: BreadcrumbItem[] = projectIdForCrumb
    ? [
        { label: t("nav.projects"), to: "/" },
        {
          label: project?.title ?? "…",
          to: "/projects/$projectId",
          params: { projectId: projectIdForCrumb },
        },
        { label: trailingLabel },
      ]
    : [
        { label: t("nav.notes"), to: "/notes" },
        { label: trailingLabel },
      ];

  const canSubmit =
    title.trim().length > 0 && !update.isPending && !create.isPending;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    if (isCreating) {
      const created = await create.mutateAsync({
        title: title.trim(),
        body,
        bodyFormat,
        projectId: projectIdFromSearch ?? null,
      });
      navigate({
        to: "/notes/$noteId",
        params: { noteId: created.id },
        replace: true,
      });
      return;
    }
    if (!note) return;
    await update.mutateAsync({
      id: note.id,
      title: title.trim(),
      body,
      bodyFormat,
    });
  };

  const handleDelete = async () => {
    if (!note) return;
    if (!(await confirmDelete("note"))) return;
    await remove.mutateAsync(note.id);
    if (note.projectId) {
      navigate({
        to: "/projects/$projectId",
        params: { projectId: note.projectId },
      });
    } else {
      navigate({ to: "/notes" });
    }
  };

  if (!isCreating && !note) {
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
            <Button
              type="button"
              variant="ghost"
              onClick={handleDelete}
              aria-label={t("notes.deleteAria")}
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

      <RichTextField
        label={t("fields.body")}
        value={body}
        onChange={setBody}
        format={bodyFormat}
        onFormatChange={setBodyFormat}
        placeholder={t("notes.bodyPlaceholder")}
        emptyLabel={t("notes.emptyBody")}
      />
    </div>
  );
}

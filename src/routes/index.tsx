import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import {
  ChevronRight,
  FileText,
  FolderKanban,
  Plus,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  useCreateProject,
  useDeleteProject,
  useProjects,
} from "@/lib/queries/projects";
import type { Project } from "@/types/generated";

export const Route = createFileRoute("/")({
  component: ProjectsIndex,
});

function ProjectsIndex() {
  const { t } = useTranslation();
  const { data: projects, isLoading } = useProjects();
  const create = useCreateProject();
  const remove = useDeleteProject();
  const navigate = useNavigate();

  const handleAdd = async () => {
    const created = await create.mutateAsync({
      title: t("common.untitledProject"),
      description: "",
      descriptionFormat: "plaintext",
    });
    navigate({
      to: "/projects/$projectId",
      params: { projectId: created.id },
    });
  };

  return (
    <div className="flex h-full flex-col gap-6 p-8">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">
            {t("projects.indexHeading")}
          </h2>
          <p className="text-sm text-muted-foreground">
            {t("projects.indexSubtitle")}
          </p>
        </div>
        <Button onClick={handleAdd}>
          <Plus />
          {t("projects.newProject")}
        </Button>
      </header>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
      ) : (projects ?? []).length === 0 ? (
        <EmptyProjects onAdd={handleAdd} />
      ) : (
        <ul className="grid max-w-3xl grid-cols-1 gap-2 sm:grid-cols-2">
          {(projects ?? []).map((p) => (
            <ProjectCard
              key={p.id}
              project={p}
              onOpen={() =>
                navigate({
                  to: "/projects/$projectId",
                  params: { projectId: p.id },
                })
              }
              onDelete={() => remove.mutate(p.id)}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function ProjectCard({
  project,
  onOpen,
  onDelete,
}: {
  project: Project;
  onOpen: () => void;
  onDelete: () => void;
}) {
  const { t } = useTranslation();
  const hasDescription = project.description.trim().length > 0;
  return (
    <li className="group flex items-center gap-2 rounded-md border border-border bg-card p-3 transition-colors hover:border-primary/40">
      <button
        type="button"
        onClick={onOpen}
        className="flex flex-1 items-center gap-2 text-left text-sm font-medium"
      >
        <FolderKanban size={16} className="text-muted-foreground" />
        <span>{project.title}</span>
        {hasDescription && (
          <FileText size={12} className="text-muted-foreground" />
        )}
        <ChevronRight
          size={14}
          className="ml-auto text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100"
        />
      </button>
      <Button
        size="icon"
        variant="ghost"
        className="opacity-0 transition-opacity group-hover:opacity-100"
        onClick={onDelete}
        aria-label={t("projects.deleteAria")}
      >
        <Trash2 />
      </Button>
    </li>
  );
}

function EmptyProjects({ onAdd }: { onAdd: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="flex max-w-3xl flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border p-12 text-center">
      <FolderKanban className="size-10 text-muted-foreground" />
      <h3 className="text-sm font-medium">{t("projects.emptyTitle")}</h3>
      <p className="max-w-sm text-xs text-muted-foreground">
        {t("projects.emptyHelp")}
      </p>
      <Button onClick={onAdd} size="sm">
        <Plus />
        {t("projects.newProject")}
      </Button>
    </div>
  );
}

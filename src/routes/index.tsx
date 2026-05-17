import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  ChevronRight,
  FileText,
  FolderKanban,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProjectDialog } from "@/components/project/project-dialog";
import {
  useDeleteProject,
  useProjects,
} from "@/lib/queries/projects";
import type { Project } from "@/types/generated";

type DialogState =
  | { kind: "create"; parentId?: string | null }
  | { kind: "edit"; project: Project }
  | null;

export const Route = createFileRoute("/")({
  component: ProjectsIndex,
});

function ProjectsIndex() {
  const { data: projects, isLoading } = useProjects();
  const remove = useDeleteProject();
  const navigate = useNavigate();
  const [dialog, setDialog] = useState<DialogState>(null);

  const topLevel = (projects ?? []).filter((p) => !p.parentId);

  return (
    <div className="flex h-full flex-col gap-6 p-8">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Projects</h2>
          <p className="text-sm text-muted-foreground">
            Top-level workspaces for your tasks
          </p>
        </div>
        <Button onClick={() => setDialog({ kind: "create" })}>
          <Plus />
          New project
        </Button>
      </header>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : topLevel.length === 0 ? (
        <EmptyProjects onAdd={() => setDialog({ kind: "create" })} />
      ) : (
        <ul className="grid max-w-3xl grid-cols-1 gap-2 sm:grid-cols-2">
          {topLevel.map((p) => (
            <ProjectCard
              key={p.id}
              project={p}
              onOpen={() =>
                navigate({
                  to: "/projects/$projectId",
                  params: { projectId: p.id },
                })
              }
              onEdit={() => setDialog({ kind: "edit", project: p })}
              onDelete={() => remove.mutate(p.id)}
            />
          ))}
        </ul>
      )}

      {dialog && (
        <ProjectDialog
          open
          onOpenChange={(open) => !open && setDialog(null)}
          mode={dialog}
        />
      )}
    </div>
  );
}

function ProjectCard({
  project,
  onOpen,
  onEdit,
  onDelete,
}: {
  project: Project;
  onOpen: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
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
          <FileText
            size={12}
            className="text-muted-foreground"
            aria-label="Has description"
          />
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
        onClick={onEdit}
        aria-label="Edit project"
      >
        <Pencil />
      </Button>
      <Button
        size="icon"
        variant="ghost"
        className="opacity-0 transition-opacity group-hover:opacity-100"
        onClick={onDelete}
        aria-label="Delete project"
      >
        <Trash2 />
      </Button>
    </li>
  );
}

function EmptyProjects({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="flex max-w-3xl flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border p-12 text-center">
      <FolderKanban className="size-10 text-muted-foreground" />
      <h3 className="text-sm font-medium">No projects yet</h3>
      <p className="max-w-sm text-xs text-muted-foreground">
        Create your first project to start tracking stories and tasks.
      </p>
      <Button onClick={onAdd} size="sm">
        <Plus />
        New project
      </Button>
    </div>
  );
}

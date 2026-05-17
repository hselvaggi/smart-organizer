import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  BookOpen,
  ChevronRight,
  FileText,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { StoryDialog } from "@/components/story/story-dialog";
import { ProjectDialog } from "@/components/project/project-dialog";
import { useProject } from "@/lib/queries/projects";
import {
  useDeleteStory,
  useStories,
} from "@/lib/queries/stories";
import type { Story } from "@/types/generated";

type StoryDialogState =
  | { kind: "create"; projectId: string }
  | { kind: "edit"; story: Story }
  | null;

export const Route = createFileRoute("/projects/$projectId")({
  component: ProjectDetail,
});

function ProjectDetail() {
  const { projectId } = Route.useParams();
  const navigate = useNavigate();
  const { data: project } = useProject(projectId);
  const { data: stories, isLoading } = useStories(projectId);
  const remove = useDeleteStory(projectId);

  const [storyDialog, setStoryDialog] = useState<StoryDialogState>(null);
  const [projectDialogOpen, setProjectDialogOpen] = useState(false);

  return (
    <div className="flex h-full flex-col gap-6 p-8">
      <Breadcrumbs projectTitle={project?.title ?? "…"} />

      <header className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">
            {project?.title ?? "Loading…"}
          </h2>
          <p className="text-sm text-muted-foreground">
            Stories group related tasks within this project
          </p>
        </div>
        <div className="flex items-center gap-2">
          {project && (
            <Button
              variant="outline"
              onClick={() => setProjectDialogOpen(true)}
            >
              <Pencil />
              Edit project
            </Button>
          )}
          <Button onClick={() => setStoryDialog({ kind: "create", projectId })}>
            <Plus />
            New story
          </Button>
        </div>
      </header>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading stories…</p>
      ) : !stories || stories.length === 0 ? (
        <EmptyStories
          onAdd={() => setStoryDialog({ kind: "create", projectId })}
        />
      ) : (
        <ul className="grid max-w-3xl grid-cols-1 gap-2">
          {stories.map((s) => (
            <StoryRow
              key={s.id}
              story={s}
              onOpen={() =>
                navigate({
                  to: "/projects/$projectId/stories/$storyId",
                  params: { projectId, storyId: s.id },
                })
              }
              onEdit={() => setStoryDialog({ kind: "edit", story: s })}
              onDelete={() => remove.mutate(s.id)}
            />
          ))}
        </ul>
      )}

      {storyDialog && (
        <StoryDialog
          open
          onOpenChange={(o) => !o && setStoryDialog(null)}
          mode={storyDialog}
        />
      )}

      {project && projectDialogOpen && (
        <ProjectDialog
          open
          onOpenChange={setProjectDialogOpen}
          mode={{ kind: "edit", project }}
        />
      )}
    </div>
  );
}

function StoryRow({
  story,
  onOpen,
  onEdit,
  onDelete,
}: {
  story: Story;
  onOpen: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const hasDescription = story.description.trim().length > 0;
  return (
    <li className="group flex items-center gap-2 rounded-md border border-border bg-card p-3 transition-colors hover:border-primary/40">
      <button
        type="button"
        onClick={onOpen}
        className="flex flex-1 items-center gap-2 text-left text-sm font-medium"
      >
        <BookOpen size={16} className="text-muted-foreground" />
        <span>{story.title}</span>
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
        aria-label="Edit story"
      >
        <Pencil />
      </Button>
      <Button
        size="icon"
        variant="ghost"
        className="opacity-0 transition-opacity group-hover:opacity-100"
        onClick={onDelete}
        aria-label="Delete story"
      >
        <Trash2 />
      </Button>
    </li>
  );
}

function EmptyStories({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="flex max-w-3xl flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border p-10 text-center">
      <BookOpen className="size-8 text-muted-foreground" />
      <p className="text-sm font-medium">No stories yet</p>
      <p className="max-w-sm text-xs text-muted-foreground">
        Stories are a flexible grouping — use them for sprints, themes, or
        study chapters.
      </p>
      <Button onClick={onAdd} size="sm">
        <Plus />
        New story
      </Button>
    </div>
  );
}

function Breadcrumbs({ projectTitle }: { projectTitle: string }) {
  return (
    <nav className="flex items-center gap-1 text-xs text-muted-foreground">
      <Link to="/" className="hover:text-foreground">
        Projects
      </Link>
      <ChevronRight size={12} />
      <span className="text-foreground">{projectTitle}</span>
    </nav>
  );
}

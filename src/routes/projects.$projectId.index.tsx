import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  BookOpen,
  ChevronRight,
  FileText,
  LayoutGrid,
  Plus,
  Save,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Breadcrumb, type BreadcrumbItem } from "@/components/breadcrumb";
import { SplitEditor } from "@/components/editor/split-editor";
import { StatusIcon, nextStatus } from "@/components/task/task-status";
import { cn } from "@/lib/cn";
import {
  DEADLINE_BORDER,
  getDeadlineStatus,
  useYellowDays,
} from "@/lib/deadline";
import {
  useDeleteProject,
  useProject,
  useUpdateProject,
} from "@/lib/queries/projects";
import {
  useCreateStory,
  useDeleteStory,
  useStories,
  useUpdateStory,
} from "@/lib/queries/stories";
import type { Story, TextFormat } from "@/types/generated";

export const Route = createFileRoute("/projects/$projectId/")({
  component: ProjectDetail,
});

function ProjectDetail() {
  const { projectId } = Route.useParams();
  const navigate = useNavigate();

  const { data: project } = useProject(projectId);
  const { data: stories } = useStories(projectId);

  const update = useUpdateProject();
  const removeProject = useDeleteProject();
  const createStory = useCreateStory(projectId);
  const updateStory = useUpdateStory(projectId);
  const removeStory = useDeleteStory(projectId);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [descriptionFormat, setDescriptionFormat] =
    useState<TextFormat>("plaintext");

  useEffect(() => {
    if (!project) return;
    setTitle(project.title);
    setDescription(project.description);
    setDescriptionFormat(project.descriptionFormat);
  }, [project]);

  const items: BreadcrumbItem[] = [
    { label: "Projects", to: "/" },
    { label: project?.title ?? "…" },
  ];

  const canSave = !!project && title.trim().length > 0 && !update.isPending;

  const handleSave = async () => {
    if (!project || !canSave) return;
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

  const handleAddStory = async () => {
    const created = await createStory.mutateAsync({
      projectId,
      title: "Untitled story",
      description: "",
      descriptionFormat: "plaintext",
    });
    navigate({
      to: "/projects/$projectId/stories/$storyId",
      params: { projectId, storyId: created.id },
    });
  };

  if (!project) {
    return (
      <div className="flex h-full flex-col gap-6 p-8">
        <Breadcrumb items={items} />
        <p className="text-sm text-muted-foreground">Loading project…</p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col gap-6 overflow-y-auto p-8">
      <Breadcrumb items={items} />

      <header className="flex items-start justify-between gap-4">
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Project title"
          className="flex-1 text-xl font-semibold"
        />
        <div className="flex items-center gap-2">
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
            Board
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={handleDelete}
            aria-label="Delete project"
          >
            <Trash2 />
            Delete
          </Button>
          <Button type="button" onClick={handleSave} disabled={!canSave}>
            <Save />
            {update.isPending ? "Saving…" : "Save"}
          </Button>
        </div>
      </header>

      <div className="flex flex-col gap-4">
        <Field label="Description">
          <SplitEditor
            value={description}
            onChange={setDescription}
            format={descriptionFormat}
            onFormatChange={setDescriptionFormat}
            placeholder="Goals, scope, references…"
          />
        </Field>

        <StoriesSection
          stories={stories ?? []}
          onOpen={(id) =>
            navigate({
              to: "/projects/$projectId/stories/$storyId",
              params: { projectId, storyId: id },
            })
          }
          onAdd={handleAddStory}
          onToggle={(s) =>
            updateStory.mutate({
              id: s.id,
              status: nextStatus(s.status),
              title: null,
              description: null,
              descriptionFormat: null,
              dueDate: null,
            })
          }
          onDelete={(id) => removeStory.mutate(id)}
        />
      </div>
    </div>
  );
}

function StoriesSection({
  stories,
  onOpen,
  onAdd,
  onToggle,
  onDelete,
}: {
  stories: Story[];
  onOpen: (id: string) => void;
  onAdd: () => void;
  onToggle: (s: Story) => void;
  onDelete: (id: string) => void;
}) {
  const [yellowDays] = useYellowDays();
  return (
    <section className="flex flex-col gap-2 border-t border-border pt-4">
      <header className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Stories</h3>
        <Button type="button" size="sm" variant="outline" onClick={onAdd}>
          <Plus />
          Add story
        </Button>
      </header>

      {stories.length === 0 ? (
        <p className="rounded-md border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
          No stories yet — group related tasks with "Add story".
        </p>
      ) : (
        <ul className="flex flex-col gap-1">
          {stories.map((s) => (
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
                onClick={() => onToggle(s)}
                aria-label="Toggle status"
              >
                <StatusIcon status={s.status} />
              </Button>
              <button
                type="button"
                onClick={() => onOpen(s.id)}
                className="flex flex-1 items-center gap-2 text-left text-sm"
              >
                <BookOpen size={16} className="text-muted-foreground" />
                <span
                  className={s.status === "done" ? "line-through opacity-60" : ""}
                >
                  {s.title}
                </span>
                {s.description.trim().length > 0 && (
                  <FileText
                    size={12}
                    className="text-muted-foreground"
                    aria-label="Has description"
                  />
                )}
                <span className="ml-auto flex items-center gap-1 text-xs text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100">
                  Open
                  <ChevronRight size={12} />
                </span>
              </button>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="opacity-0 transition-opacity group-hover:opacity-100"
                onClick={() => onDelete(s.id)}
                aria-label="Delete story"
              >
                <Trash2 />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </section>
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

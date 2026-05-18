import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { Breadcrumb, type BreadcrumbItem } from "@/components/breadcrumb";
import { nextStatus } from "@/components/task/task-status";
import {
  BoardCardPreview,
  BoardColumn,
  type BoardCard,
} from "@/components/project/board";
import { useProject } from "@/lib/queries/projects";
import { useUpdateStory } from "@/lib/queries/stories";
import { useUpdateTask } from "@/lib/queries/tasks";
import { api } from "@/lib/tauri";
import type { TaskStatus } from "@/types/generated";

const COLUMN_STATUSES: TaskStatus[] = [
  "todo",
  "in_progress",
  "done",
  "blocked",
  "cancelled",
];

export const Route = createFileRoute("/projects/$projectId/board")({
  component: ProjectBoard,
});

function ProjectBoard() {
  const { t } = useTranslation();
  const { projectId } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: project } = useProject(projectId);
  const { data: board, isLoading } = useQuery({
    queryKey: ["project-board", projectId],
    queryFn: () => api.projects.board(projectId),
    enabled: !!projectId,
  });

  const updateStory = useUpdateStory(projectId);
  const updateTask = useUpdateTask();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  const [activeCard, setActiveCard] = useState<BoardCard | null>(null);

  const handleDragStart = (event: DragStartEvent) => {
    const card = event.active.data.current?.card as BoardCard | undefined;
    setActiveCard(card ?? null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveCard(null);
    const { active, over } = event;
    if (!over) return;
    const newStatus = String(over.id) as TaskStatus;
    const card = active.data.current?.card as BoardCard | undefined;
    if (!card || card.item.status === newStatus) return;

    const invalidate = () =>
      qc.invalidateQueries({ queryKey: ["project-board", projectId] });

    if (card.kind === "story") {
      updateStory.mutate(
        { id: card.item.id, status: newStatus },
        { onSuccess: invalidate },
      );
    } else {
      updateTask.mutate(
        { id: card.item.id, status: newStatus },
        { onSuccess: invalidate },
      );
    }
  };

  const items: BreadcrumbItem[] = [
    { label: t("nav.projects"), to: "/" },
    {
      label: project?.title ?? "…",
      to: "/projects/$projectId",
      params: { projectId },
    },
    { label: t("board.headingSuffix") },
  ];

  const cards: BoardCard[] = board
    ? [
        ...board.stories.map((s) => ({ kind: "story" as const, item: s })),
        ...board.tasks.map((t) => ({ kind: "task" as const, item: t })),
      ]
    : [];

  const cardsByStatus = (status: TaskStatus) =>
    cards.filter((c) => c.item.status === status);

  const handleOpen = (card: BoardCard) => {
    if (card.kind === "story") {
      navigate({
        to: "/projects/$projectId/stories/$storyId",
        params: { projectId, storyId: card.item.id },
      });
    } else {
      navigate({
        to: "/projects/$projectId/stories/$storyId/tasks/$taskId",
        params: {
          projectId,
          storyId: card.item.storyId,
          taskId: card.item.id,
        },
      });
    }
  };

  const handleToggle = (card: BoardCard) => {
    if (card.kind === "story") {
      updateStory.mutate({
        id: card.item.id,
        status: nextStatus(card.item.status),
      });
    } else {
      updateTask.mutate({
        id: card.item.id,
        status: nextStatus(card.item.status),
      });
    }
  };

  return (
    <div className="flex h-full flex-col gap-4 overflow-hidden p-8">
      <Breadcrumb items={items} />
      <header>
        <h2 className="text-xl font-semibold tracking-tight">
          {project?.title ?? t("common.loading")} · {t("board.headingSuffix")}
        </h2>
        <p className="text-sm text-muted-foreground">{t("board.subtitle")}</p>
      </header>

      {isLoading && (
        <p className="text-sm text-muted-foreground">{t("board.loading")}</p>
      )}

      {board && cards.length === 0 && (
        <p className="text-sm text-muted-foreground">
          {t("board.emptyState")}
        </p>
      )}

      {board && cards.length > 0 && (
        <DndContext
          sensors={sensors}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDragCancel={() => setActiveCard(null)}
        >
          <div className="grid min-h-0 flex-1 grid-cols-5 gap-3 overflow-x-auto">
            {COLUMN_STATUSES.map((status) => (
              <BoardColumn
                key={status}
                label={t(`status.${status}`)}
                status={status}
                cards={cardsByStatus(status)}
                onOpen={handleOpen}
                onToggle={handleToggle}
              />
            ))}
          </div>
          <DragOverlay dropAnimation={null}>
            {activeCard ? <BoardCardPreview card={activeCard} /> : null}
          </DragOverlay>
        </DndContext>
      )}
    </div>
  );
}

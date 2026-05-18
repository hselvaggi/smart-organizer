import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { BookOpen, ListTree } from "lucide-react";
import { Breadcrumb, type BreadcrumbItem } from "@/components/breadcrumb";
import { StatusIcon, nextStatus } from "@/components/task/task-status";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import {
  DEADLINE_BORDER,
  getDeadlineStatus,
  useYellowDays,
} from "@/lib/deadline";
import { useProject } from "@/lib/queries/projects";
import { useUpdateStory } from "@/lib/queries/stories";
import { useUpdateTask } from "@/lib/queries/tasks";
import { api } from "@/lib/tauri";
import type { Story, Task, TaskStatus } from "@/types/generated";

const COLUMN_STATUSES: TaskStatus[] = [
  "todo",
  "in_progress",
  "done",
  "blocked",
  "cancelled",
];

type StoryCard = { kind: "story"; item: Story };
type TaskCard = { kind: "task"; item: Task };
type Card = StoryCard | TaskCard;

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
    queryFn: () => api.getProjectBoard(projectId),
    enabled: !!projectId,
  });

  const updateStory = useUpdateStory(projectId);
  const updateTask = useUpdateTask();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  const [activeCard, setActiveCard] = useState<Card | null>(null);

  const handleDragStart = (event: DragStartEvent) => {
    const card = event.active.data.current?.card as Card | undefined;
    setActiveCard(card ?? null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveCard(null);
    const { active, over } = event;
    if (!over) return;
    const newStatus = String(over.id) as TaskStatus;
    const card = active.data.current?.card as Card | undefined;
    if (!card || card.item.status === newStatus) return;

    if (card.kind === "story") {
      updateStory.mutate(
        {
          id: card.item.id,
          status: newStatus,
          title: null,
          description: null,
          descriptionFormat: null,
          dueDate: null,
        },
        {
          onSuccess: () =>
            qc.invalidateQueries({ queryKey: ["project-board", projectId] }),
        },
      );
    } else {
      updateTask.mutate(
        {
          id: card.item.id,
          status: newStatus,
          title: null,
          description: null,
          descriptionFormat: null,
          result: null,
          resultFormat: null,
          parentTaskId: null,
          sortOrder: null,
          dueDate: null,
        },
        {
          onSuccess: () =>
            qc.invalidateQueries({ queryKey: ["project-board", projectId] }),
        },
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

  const cards: Card[] = board
    ? [
        ...board.stories.map((s) => ({ kind: "story" as const, item: s })),
        ...board.tasks.map((t) => ({ kind: "task" as const, item: t })),
      ]
    : [];

  const cardsByStatus = (status: TaskStatus) =>
    cards.filter((c) => c.item.status === status);

  const handleOpen = (card: Card) => {
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

  const handleToggle = (card: Card) => {
    if (card.kind === "story") {
      updateStory.mutate({
        id: card.item.id,
        status: nextStatus(card.item.status),
        title: null,
        description: null,
        descriptionFormat: null,
        dueDate: null,
      });
    } else {
      updateTask.mutate({
        id: card.item.id,
        status: nextStatus(card.item.status),
        title: null,
        description: null,
        descriptionFormat: null,
        result: null,
        resultFormat: null,
        parentTaskId: null,
        sortOrder: null,
        dueDate: null,
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
              <Column
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
            {activeCard ? <CardPreview card={activeCard} /> : null}
          </DragOverlay>
        </DndContext>
      )}
    </div>
  );
}

function Column({
  label,
  status,
  cards,
  onOpen,
  onToggle,
}: {
  label: string;
  status: TaskStatus;
  cards: Card[];
  onOpen: (c: Card) => void;
  onToggle: (c: Card) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex min-w-[220px] flex-col overflow-hidden rounded-md border border-border bg-muted/40 transition-colors",
        isOver && "border-primary/60 bg-primary/5",
      )}
    >
      <header className="flex items-center gap-2 border-b border-border bg-muted/70 px-3 py-2">
        <StatusIcon status={status} />
        <h3 className="text-sm font-semibold">{label}</h3>
        <span className="ml-auto rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
          {cards.length}
        </span>
      </header>

      <ul className="flex flex-1 flex-col gap-2 overflow-y-auto p-2">
        {cards.map((c) => (
          <CardItem
            key={`${c.kind}-${c.item.id}`}
            card={c}
            onOpen={() => onOpen(c)}
            onToggle={() => onToggle(c)}
          />
        ))}
      </ul>
    </div>
  );
}

function CardItem({
  card,
  onOpen,
  onToggle,
}: {
  card: Card;
  onOpen: () => void;
  onToggle: () => void;
}) {
  const { t } = useTranslation();
  const item = card.item;
  const isStory = card.kind === "story";
  const isSubtask = card.kind === "task" && !!(item as Task).parentTaskId;
  const typeLabel = t(
    isStory ? "board.typeStory" : isSubtask ? "board.typeSubtask" : "board.typeTask",
  );
  const Icon = isStory ? BookOpen : ListTree;

  const preview = item.description
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 260);

  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `${card.kind}-${card.item.id}`,
    data: { card },
  });

  const [yellowDays] = useYellowDays();
  const deadline = getDeadlineStatus(item.dueDate, item.status, yellowDays);

  return (
    <li
      ref={setNodeRef}
      className={cn(
        "rounded-md border border-border bg-background p-2 transition-colors hover:border-primary/40",
        DEADLINE_BORDER[deadline],
        isDragging && "opacity-30",
      )}
    >
      <div className="flex items-start gap-2">
        <Button
          type="button"
          size="icon"
          variant="ghost"
          onClick={onToggle}
          aria-label={t("tasks.toggleStatusAria")}
        >
          <StatusIcon status={item.status} />
        </Button>
        <button
          type="button"
          onClick={onOpen}
          className="flex flex-1 cursor-grab flex-col gap-1 text-left active:cursor-grabbing"
          {...attributes}
          {...listeners}
        >
          <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-muted-foreground">
            <Icon size={11} />
            <span>{typeLabel}</span>
          </div>
          <span
            className={
              item.status === "done"
                ? "text-sm font-medium line-through opacity-60"
                : "text-sm font-medium"
            }
          >
            {item.title}
          </span>
          {preview && (
            <p className="whitespace-pre-line text-xs text-muted-foreground line-clamp-5">
              {preview}
              {item.description.length > 260 ? "…" : ""}
            </p>
          )}
        </button>
      </div>
    </li>
  );
}

function CardPreview({ card }: { card: Card }) {
  const { t } = useTranslation();
  const item = card.item;
  const isStory = card.kind === "story";
  const isSubtask = card.kind === "task" && !!(item as Task).parentTaskId;
  const typeLabel = t(
    isStory ? "board.typeStory" : isSubtask ? "board.typeSubtask" : "board.typeTask",
  );
  const Icon = isStory ? BookOpen : ListTree;

  const preview = item.description
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 260);

  const [yellowDays] = useYellowDays();
  const deadline = getDeadlineStatus(item.dueDate, item.status, yellowDays);

  return (
    <div
      className={cn(
        "w-[200px] cursor-grabbing rounded-md border border-primary/60 bg-background p-2 shadow-2xl",
        DEADLINE_BORDER[deadline],
      )}
    >
      <div className="flex items-start gap-2">
        <span className="flex h-9 w-9 items-center justify-center">
          <StatusIcon status={item.status} />
        </span>
        <div className="flex flex-1 flex-col gap-1 text-left">
          <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-muted-foreground">
            <Icon size={11} />
            <span>{typeLabel}</span>
          </div>
          <span
            className={
              item.status === "done"
                ? "text-sm font-medium line-through opacity-60"
                : "text-sm font-medium"
            }
          >
            {item.title}
          </span>
          {preview && (
            <p className="whitespace-pre-line text-xs text-muted-foreground line-clamp-5">
              {preview}
              {item.description.length > 260 ? "…" : ""}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

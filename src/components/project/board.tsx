import { useDraggable, useDroppable } from "@dnd-kit/core";
import { useTranslation } from "react-i18next";
import { BookOpen, ListTree } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusIcon } from "@/components/task/task-status";
import { cn } from "@/lib/cn";
import {
  DEADLINE_BORDER,
  getDeadlineStatus,
  useYellowDays,
} from "@/lib/deadline";
import type { Story, Task, TaskStatus } from "@/types/generated";

export type StoryCard = { kind: "story"; item: Story };
export type TaskCard = { kind: "task"; item: Task };
export type BoardCard = StoryCard | TaskCard;

const PREVIEW_LIMIT = 260;

export function BoardColumn({
  label,
  status,
  cards,
  onOpen,
  onToggle,
}: {
  label: string;
  status: TaskStatus;
  cards: BoardCard[];
  onOpen: (c: BoardCard) => void;
  onToggle: (c: BoardCard) => void;
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
          <BoardCardItem
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

function BoardCardItem({
  card,
  onOpen,
  onToggle,
}: {
  card: BoardCard;
  onOpen: () => void;
  onToggle: () => void;
}) {
  const { t } = useTranslation();
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `${card.kind}-${card.item.id}`,
    data: { card },
  });
  const deadlineClass = useDeadlineClass(card);

  return (
    <li
      ref={setNodeRef}
      className={cn(
        "rounded-md border border-border bg-background p-2 transition-colors hover:border-primary/40",
        deadlineClass,
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
          <StatusIcon status={card.item.status} />
        </Button>
        <button
          type="button"
          onClick={onOpen}
          className="flex flex-1 cursor-grab flex-col gap-1 text-left active:cursor-grabbing"
          {...attributes}
          {...listeners}
        >
          <BoardCardBody card={card} />
        </button>
      </div>
    </li>
  );
}

export function BoardCardPreview({ card }: { card: BoardCard }) {
  const deadlineClass = useDeadlineClass(card);
  return (
    <div
      className={cn(
        "w-[200px] cursor-grabbing rounded-md border border-primary/60 bg-background p-2 shadow-2xl",
        deadlineClass,
      )}
    >
      <div className="flex items-start gap-2">
        <span className="flex h-9 w-9 items-center justify-center">
          <StatusIcon status={card.item.status} />
        </span>
        <div className="flex flex-1 flex-col gap-1 text-left">
          <BoardCardBody card={card} />
        </div>
      </div>
    </div>
  );
}

function BoardCardBody({ card }: { card: BoardCard }) {
  const { t } = useTranslation();
  const item = card.item;
  const isStory = card.kind === "story";
  const isSubtask = card.kind === "task" && !!(item as Task).parentTaskId;
  const typeLabel = t(
    isStory ? "board.typeStory" : isSubtask ? "board.typeSubtask" : "board.typeTask",
  );
  const Icon = isStory ? BookOpen : ListTree;
  const preview = item.description.replace(/\s+/g, " ").trim().slice(0, PREVIEW_LIMIT);

  return (
    <>
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
          {item.description.length > PREVIEW_LIMIT ? "…" : ""}
        </p>
      )}
    </>
  );
}

function useDeadlineClass(card: BoardCard): string {
  const [yellowDays] = useYellowDays();
  const deadline = getDeadlineStatus(card.item.dueDate, card.item.status, yellowDays);
  return DEADLINE_BORDER[deadline];
}

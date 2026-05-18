import { useTranslation } from "react-i18next";
import { ChevronRight, ListTree, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusIcon } from "@/components/task/task-status";
import { cn } from "@/lib/cn";
import {
  DEADLINE_BORDER,
  getDeadlineStatus,
  useYellowDays,
} from "@/lib/deadline";
import type { Task } from "@/types/generated";

export function TaskSubtasks({
  subtasks,
  storyTasks,
  onOpen,
  onAdd,
  onToggle,
  onDelete,
}: {
  subtasks: Task[];
  storyTasks: Task[];
  onOpen: (id: string) => void;
  onAdd: () => void;
  onToggle: (t: Task) => void;
  onDelete: (id: string) => void;
}) {
  const { t } = useTranslation();
  const [yellowDays] = useYellowDays();
  const childCount = (id: string) =>
    storyTasks.filter((task) => task.parentTaskId === id).length;

  return (
    <section className="flex flex-col gap-2 border-t border-border pt-4">
      <header className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">{t("fields.subtasks")}</h3>
        <Button type="button" size="sm" variant="outline" onClick={onAdd}>
          <Plus />
          {t("tasks.addSubtask")}
        </Button>
      </header>

      {subtasks.length === 0 ? (
        <p className="rounded-md border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
          {t("tasks.noSubtasks")}
        </p>
      ) : (
        <ul className="flex flex-col gap-1">
          {subtasks.map((sub) => (
            <li
              key={sub.id}
              className={cn(
                "group flex items-center gap-2 rounded-md border border-border bg-background p-2",
                DEADLINE_BORDER[getDeadlineStatus(sub.dueDate, sub.status, yellowDays)],
              )}
            >
              <Button
                type="button"
                size="icon"
                variant="ghost"
                onClick={() => onToggle(sub)}
                aria-label={t("tasks.toggleStatusAria")}
              >
                <StatusIcon status={sub.status} />
              </Button>
              <button
                type="button"
                onClick={() => onOpen(sub.id)}
                className="flex flex-1 items-center gap-2 text-left text-sm"
              >
                <span
                  className={sub.status === "done" ? "line-through opacity-60" : ""}
                >
                  {sub.title}
                </span>
                {childCount(sub.id) > 0 && (
                  <span className="flex items-center gap-0.5 rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                    <ListTree size={10} />
                    {childCount(sub.id)}
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
                onClick={() => onDelete(sub.id)}
                aria-label={t("tasks.deleteSubtaskAria")}
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

import { CalendarCheck, CalendarClock } from "lucide-react";

export function Timeline({
  startedAt,
  completedAt,
}: {
  startedAt: string | null;
  completedAt: string | null;
}) {
  return (
    <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
      <span className="flex items-center gap-1.5">
        <CalendarClock size={12} />
        Started: {fmt(startedAt)}
      </span>
      <span className="flex items-center gap-1.5">
        <CalendarCheck size={12} />
        Completed: {fmt(completedAt)}
      </span>
    </div>
  );
}

function fmt(value: string | null): string {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

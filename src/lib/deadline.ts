import { useEffect, useState } from "react";

export type DeadlineStatus = "safe" | "soon" | "overdue" | "none";

const KEY = "yellow-days-threshold";
const DEFAULT_YELLOW_DAYS = 1;

let cachedValue: number | null = null;
const listeners = new Set<(v: number) => void>();

function read(): number {
  if (cachedValue !== null) return cachedValue;
  const stored = localStorage.getItem(KEY);
  cachedValue = stored !== null ? Number(stored) : DEFAULT_YELLOW_DAYS;
  return cachedValue;
}

function write(v: number) {
  cachedValue = v;
  localStorage.setItem(KEY, String(v));
  listeners.forEach((l) => l(v));
}

export function useYellowDays(): [number, (v: number) => void] {
  const [value, setValue] = useState(read);
  useEffect(() => {
    const listener = (v: number) => setValue(v);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);
  return [value, write];
}

export function getDeadlineStatus(
  dueDate: string | null,
  status: string,
  yellowDays: number,
): DeadlineStatus {
  if (!dueDate) return "none";
  if (status === "done" || status === "cancelled") return "none";

  const due = new Date(dueDate);
  // Treat the due date as end-of-day in local time.
  due.setHours(23, 59, 59, 999);

  const msUntil = due.getTime() - Date.now();
  if (msUntil < 0) return "overdue";

  const daysUntil = msUntil / (1000 * 60 * 60 * 24);
  if (daysUntil <= yellowDays) return "soon";
  return "safe";
}

export const DEADLINE_BORDER: Record<DeadlineStatus, string> = {
  safe: "border-l-4 border-l-emerald-500",
  soon: "border-l-4 border-l-amber-500",
  overdue: "border-l-4 border-l-red-500",
  none: "",
};

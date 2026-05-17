import {
  CheckCircle2,
  Circle,
  CircleDashed,
  CircleSlash,
} from "lucide-react";
import type { TaskStatus } from "@/types/generated";

export function StatusIcon({ status }: { status: TaskStatus }) {
  switch (status) {
    case "todo":
      return <Circle size={16} className="text-muted-foreground" />;
    case "in_progress":
      return <CircleDashed size={16} className="text-primary" />;
    case "done":
      return <CheckCircle2 size={16} className="text-emerald-400" />;
    case "blocked":
      return <CircleSlash size={16} className="text-amber-400" />;
    case "cancelled":
      return <CircleSlash size={16} className="text-muted-foreground" />;
  }
}

export function nextStatus(s: TaskStatus): TaskStatus {
  switch (s) {
    case "todo":
      return "in_progress";
    case "in_progress":
      return "done";
    case "done":
      return "todo";
    case "blocked":
      return "todo";
    case "cancelled":
      return "todo";
  }
}

import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  Bot,
  CalendarClock,
  Check,
  Circle,
  Copy,
  Power,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useYellowDays } from "@/lib/deadline";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/cn";
import { api } from "@/lib/tauri";
import type { McpMode } from "@/types/generated";

export const Route = createFileRoute("/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  return (
    <div className="flex h-full flex-col gap-6 overflow-y-auto p-8">
      <header>
        <h2 className="text-xl font-semibold tracking-tight">Settings</h2>
        <p className="text-sm text-muted-foreground">
          Device identity, paired peers and preferences will live here.
        </p>
      </header>

      <DeadlinesSection />
      <McpSection />
      <ApplicationSection />
      <DangerZone />
    </div>
  );
}

function ApplicationSection() {
  return (
    <section className="flex max-w-2xl flex-col gap-3 rounded-md border border-border bg-card/40 p-4">
      <header className="flex items-center gap-2">
        <Power size={16} className="text-muted-foreground" />
        <h3 className="text-sm font-semibold">Application</h3>
      </header>
      <p className="text-xs text-muted-foreground">
        Closing the window via the X minimises Organizer to the tray. Use
        this to actually shut it down.
      </p>
      <div>
        <Button type="button" variant="outline" onClick={() => api.quitApp()}>
          <Power />
          Quit Organizer
        </Button>
      </div>
    </section>
  );
}

function DeadlinesSection() {
  const [yellowDays, setYellowDays] = useYellowDays();

  return (
    <section className="flex max-w-2xl flex-col gap-3 rounded-md border border-border bg-card/40 p-4">
      <header className="flex items-center gap-2">
        <CalendarClock size={16} className="text-muted-foreground" />
        <h3 className="text-sm font-semibold">Deadlines</h3>
      </header>
      <p className="text-xs text-muted-foreground">
        Stories and tasks that are not yet done show a coloured left border on
        their card based on how close the due date is. Past due is red, within
        the threshold below is yellow, otherwise green.
      </p>
      <label className="flex items-center gap-3">
        <span className="text-sm">Warn before:</span>
        <Input
          type="number"
          min={0}
          max={365}
          value={yellowDays}
          onChange={(e) => {
            const v = Number(e.target.value);
            if (!Number.isNaN(v) && v >= 0) setYellowDays(v);
          }}
          className="w-24"
        />
        <span className="text-sm text-muted-foreground">day(s) of due date</span>
      </label>
    </section>
  );
}

const MODE_OPTIONS: { value: McpMode; label: string; description: string }[] = [
  {
    value: "off",
    label: "Off",
    description: "No MCP server. Agents cannot connect.",
  },
  {
    value: "readonly",
    label: "Read-only",
    description:
      "Agents can list and inspect data but not create, update or delete anything.",
  },
  {
    value: "full",
    label: "Full access",
    description:
      "Agents can create, update and delete projects, stories, tasks and comments.",
  },
];

function McpSection() {
  const qc = useQueryClient();
  const { data: status } = useQuery({
    queryKey: ["mcp-status"],
    queryFn: api.getMcpStatus,
  });
  const setMode = useMutation({
    mutationFn: (mode: McpMode) => api.setMcpMode(mode),
    onSuccess: (data) => {
      qc.setQueryData(["mcp-status"], data);
    },
  });
  const [copied, setCopied] = useState(false);

  const handleCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (e) {
      console.error("clipboard write failed", e);
    }
  };

  const current = status?.mode ?? "off";
  const running = status?.running ?? false;

  return (
    <section className="flex max-w-2xl flex-col gap-4 rounded-md border border-border bg-card/40 p-4">
      <header className="flex items-center gap-2">
        <Bot size={16} className="text-muted-foreground" />
        <h3 className="text-sm font-semibold">MCP server (for agents)</h3>
        <span
          className={cn(
            "ml-auto flex items-center gap-1.5 rounded px-2 py-0.5 text-[11px] font-medium",
            running
              ? "bg-emerald-500/15 text-emerald-300"
              : "bg-muted text-muted-foreground",
          )}
        >
          <Circle
            size={8}
            className={
              running ? "fill-emerald-400 text-emerald-400" : "fill-current"
            }
          />
          {running ? "Running" : "Stopped"}
        </span>
      </header>

      <p className="text-xs text-muted-foreground">
        Expose this app's data over a local Model Context Protocol server so
        an AI agent can read and (optionally) modify your tasks. Disabled by
        default for security. The server only binds to{" "}
        <code className="rounded bg-muted px-1 font-mono">127.0.0.1</code> so
        it is not reachable from the network.
      </p>

      <div className="flex flex-col gap-2">
        {MODE_OPTIONS.map((opt) => (
          <label
            key={opt.value}
            className={cn(
              "flex cursor-pointer items-start gap-3 rounded-md border p-3 transition-colors",
              current === opt.value
                ? "border-primary/60 bg-primary/5"
                : "border-border hover:border-border/80",
            )}
          >
            <input
              type="radio"
              name="mcp-mode"
              checked={current === opt.value}
              onChange={() => setMode.mutate(opt.value)}
              disabled={setMode.isPending}
              className="mt-0.5 h-4 w-4 cursor-pointer accent-primary"
            />
            <div className="flex flex-col gap-0.5">
              <span className="text-sm font-medium">{opt.label}</span>
              <span className="text-xs text-muted-foreground">
                {opt.description}
              </span>
            </div>
          </label>
        ))}
      </div>

      {running && status && (
        <div className="flex items-center gap-2 rounded border border-border bg-background px-3 py-2">
          <code className="flex-1 font-mono text-xs">{status.url}</code>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => handleCopy(status.url)}
            aria-label="Copy endpoint URL"
          >
            {copied ? <Check /> : <Copy />}
            {copied ? "Copied" : "Copy"}
          </Button>
        </div>
      )}

      {setMode.error && (
        <p className="text-xs text-destructive">
          Failed to apply: {String(setMode.error)}
        </p>
      )}
    </section>
  );
}

function DangerZone() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [done, setDone] = useState(false);

  const reset = useMutation({
    mutationFn: api.resetDatabase,
    onSuccess: () => {
      qc.clear();
      setDone(true);
      setTimeout(() => {
        setOpen(false);
        setDone(false);
        setConfirmation("");
        navigate({ to: "/" });
      }, 1200);
    },
  });

  const canConfirm = confirmation === "RESET" && !reset.isPending;

  return (
    <section className="flex max-w-2xl flex-col gap-3 rounded-md border border-destructive/40 bg-destructive/5 p-4">
      <header className="flex items-center gap-2">
        <AlertTriangle size={16} className="text-destructive" />
        <h3 className="text-sm font-semibold">Danger zone</h3>
      </header>
      <p className="text-xs text-muted-foreground">
        Permanently delete all projects, stories, tasks, comments and paired
        peers. This cannot be undone.
      </p>
      <div>
        <Button
          type="button"
          variant="destructive"
          onClick={() => setOpen(true)}
        >
          <Trash2 />
          Reset database
        </Button>
      </div>

      <Dialog open={open} onOpenChange={(o) => !reset.isPending && setOpen(o)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle size={16} className="text-destructive" />
              Reset database
            </DialogTitle>
            <DialogDescription>
              All data on this device will be wiped: projects, stories, tasks,
              comments, sync state. This is irreversible. Type{" "}
              <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
                RESET
              </code>{" "}
              below to confirm.
            </DialogDescription>
          </DialogHeader>

          {done ? (
            <div className="flex items-center gap-2 rounded-md border border-emerald-500/40 bg-emerald-500/10 p-3 text-sm text-emerald-300">
              <Check size={16} />
              Database wiped. Returning to projects…
            </div>
          ) : (
            <>
              <Input
                value={confirmation}
                onChange={(e) => setConfirmation(e.target.value)}
                placeholder="Type RESET to confirm"
                autoFocus
                disabled={reset.isPending}
              />
              {reset.error && (
                <p className="text-xs text-destructive">
                  Failed: {String(reset.error)}
                </p>
              )}
            </>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setOpen(false)}
              disabled={reset.isPending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => reset.mutate()}
              disabled={!canConfirm || done}
            >
              <Trash2 />
              {reset.isPending ? "Wiping…" : "Reset everything"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}

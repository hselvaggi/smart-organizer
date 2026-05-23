import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Download, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/tauri";
import type { SyncSummary } from "@/types/generated";

const LAST_URL_KEY = "tasks-sync-last-url";

export function SyncSection() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [url, setUrl] = useState(
    () => localStorage.getItem(LAST_URL_KEY) ?? "",
  );

  const pull = useMutation({
    mutationFn: (peerUrl: string) => api.sync.fromPeer(peerUrl),
    onSuccess: () => {
      // Anything could have arrived — invalidate the whole entity cache so
      // the UI rehydrates from disk on next render.
      qc.invalidateQueries({ queryKey: ["projects"] });
      qc.invalidateQueries({ queryKey: ["stories"] });
      qc.invalidateQueries({ queryKey: ["tasks"] });
      qc.invalidateQueries({ queryKey: ["notes"] });
      qc.invalidateQueries({ queryKey: ["comments"] });
    },
  });

  const trimmed = url.trim();
  const canPull = trimmed.length > 0 && !pull.isPending;

  const handlePull = () => {
    if (!canPull) return;
    localStorage.setItem(LAST_URL_KEY, trimmed);
    pull.mutate(trimmed);
  };

  return (
    <section className="flex max-w-2xl flex-col gap-3 rounded-md border border-border bg-card/40 p-4">
      <header className="flex items-center gap-2">
        <RefreshCw size={16} className="text-muted-foreground" />
        <h3 className="text-sm font-semibold">
          {t("settings.sync.heading")}
        </h3>
      </header>
      <p className="text-xs text-muted-foreground">
        {t("settings.sync.description")}
      </p>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder={t("settings.sync.urlPlaceholder")}
          className="flex-1"
          spellCheck={false}
          autoCorrect="off"
          autoCapitalize="off"
        />
        <Button type="button" onClick={handlePull} disabled={!canPull}>
          <Download />
          {t(pull.isPending ? "settings.sync.pulling" : "settings.sync.pull")}
        </Button>
      </div>

      {pull.isError && (
        <p className="rounded-md border border-destructive/40 bg-destructive/10 p-2 text-xs text-destructive">
          {String((pull.error as Error)?.message ?? pull.error)}
        </p>
      )}

      {pull.isSuccess && pull.data && <SummaryReport summary={pull.data} />}
    </section>
  );
}

function SummaryReport({ summary }: { summary: SyncSummary }) {
  const { t } = useTranslation();
  const total =
    summary.projectsAdded +
    summary.storiesAdded +
    summary.tasksAdded +
    summary.commentsAdded +
    summary.notesAdded;

  if (total === 0 && summary.skipped === 0) {
    return (
      <p className="rounded-md border border-border bg-muted/30 p-2 text-xs text-muted-foreground">
        {t("settings.sync.empty")}
      </p>
    );
  }

  if (total === 0) {
    return (
      <p className="rounded-md border border-border bg-muted/30 p-2 text-xs text-muted-foreground">
        {t("settings.sync.upToDate", { skipped: summary.skipped })}
      </p>
    );
  }

  return (
    <ul className="grid grid-cols-2 gap-x-4 gap-y-1 rounded-md border border-border bg-muted/30 p-3 text-xs text-muted-foreground sm:grid-cols-3">
      <SummaryRow
        label={t("settings.sync.projects")}
        value={summary.projectsAdded}
      />
      <SummaryRow
        label={t("settings.sync.stories")}
        value={summary.storiesAdded}
      />
      <SummaryRow
        label={t("settings.sync.tasks")}
        value={summary.tasksAdded}
      />
      <SummaryRow
        label={t("settings.sync.comments")}
        value={summary.commentsAdded}
      />
      <SummaryRow
        label={t("settings.sync.notes")}
        value={summary.notesAdded}
      />
      <SummaryRow
        label={t("settings.sync.skipped")}
        value={summary.skipped}
        muted
      />
    </ul>
  );
}

function SummaryRow({
  label,
  value,
  muted,
}: {
  label: string;
  value: number;
  muted?: boolean;
}) {
  return (
    <li className="flex items-baseline justify-between gap-2">
      <span>{label}</span>
      <span
        className={muted ? "font-mono" : "font-mono font-semibold text-foreground"}
      >
        {value}
      </span>
    </li>
  );
}

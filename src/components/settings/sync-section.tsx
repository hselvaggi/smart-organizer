import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Download, RefreshCw, Wifi } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/tauri";
import type { Peer, SyncSummary } from "@/types/generated";

const LAST_URL_KEY = "tasks-sync-last-url";
const LAST_TOKEN_KEY = "tasks-sync-last-token";

export function SyncSection() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [url, setUrl] = useState(
    () => localStorage.getItem(LAST_URL_KEY) ?? "",
  );
  const [token, setToken] = useState(
    () => localStorage.getItem(LAST_TOKEN_KEY) ?? "",
  );

  const { data: peers = [] } = useQuery({
    queryKey: ["mdns-peers"],
    queryFn: api.sync.listPeers,
    refetchInterval: 3000,
    refetchIntervalInBackground: false,
  });

  const pull = useMutation({
    mutationFn: (args: { url: string; token: string }) =>
      api.sync.fromPeer(args.url, args.token || undefined),
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

  const trimmedUrl = url.trim();
  const trimmedToken = token.trim();
  const canPull = trimmedUrl.length > 0 && !pull.isPending;

  const handlePull = () => {
    if (!canPull) return;
    localStorage.setItem(LAST_URL_KEY, trimmedUrl);
    localStorage.setItem(LAST_TOKEN_KEY, trimmedToken);
    pull.mutate({ url: trimmedUrl, token: trimmedToken });
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

      <DiscoveredPeers peers={peers} onPick={(p) => setUrl(p.url)} />

      <div className="flex flex-col gap-2">
        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            {t("settings.sync.urlLabel")}
          </span>
          <Input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder={t("settings.sync.urlPlaceholder")}
            spellCheck={false}
            autoCorrect="off"
            autoCapitalize="off"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            {t("settings.sync.tokenLabel")}
          </span>
          <Input
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder={t("settings.sync.tokenPlaceholder")}
            spellCheck={false}
            autoCorrect="off"
            autoCapitalize="off"
            className="font-mono"
          />
        </label>
        <div>
          <Button type="button" onClick={handlePull} disabled={!canPull}>
            <Download />
            {t(pull.isPending ? "settings.sync.pulling" : "settings.sync.pull")}
          </Button>
        </div>
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

function DiscoveredPeers({
  peers,
  onPick,
}: {
  peers: Peer[];
  onPick: (p: Peer) => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-1">
      <span className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        <Wifi size={12} />
        {t("settings.sync.discoveredLabel")}
      </span>
      {peers.length === 0 ? (
        <p className="rounded-md border border-dashed border-border p-2 text-center text-xs text-muted-foreground">
          {t("settings.sync.discoveredEmpty")}
        </p>
      ) : (
        <ul className="flex flex-col gap-1">
          {peers.map((p) => (
            <li key={p.name}>
              <button
                type="button"
                onClick={() => onPick(p)}
                className="flex w-full items-center justify-between gap-2 rounded-md border border-border bg-card px-3 py-1.5 text-left text-xs transition-colors hover:border-primary/40"
              >
                <span className="flex items-center gap-2">
                  <Wifi size={12} className="text-muted-foreground" />
                  <span className="font-medium">{p.label}</span>
                </span>
                <span className="font-mono text-muted-foreground">{p.url}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
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

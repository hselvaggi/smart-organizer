import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  AlertTriangle,
  Bot,
  Check,
  Circle,
  Copy,
  Globe,
  KeyRound,
  RefreshCcw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { api } from "@/lib/tauri";
import type { McpMode, McpStatus } from "@/types/generated";

function useModeOptions() {
  const { t } = useTranslation();
  const options: { value: McpMode; label: string; description: string }[] = [
    {
      value: "off",
      label: t("settings.mcp.modeOff"),
      description: t("settings.mcp.modeOffDescription"),
    },
    {
      value: "readonly",
      label: t("settings.mcp.modeReadonly"),
      description: t("settings.mcp.modeReadonlyDescription"),
    },
    {
      value: "full",
      label: t("settings.mcp.modeFull"),
      description: t("settings.mcp.modeFullDescription"),
    },
  ];
  return options;
}

export function McpSection() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const { data: status } = useQuery({
    queryKey: ["mcp-status"],
    queryFn: api.mcp.status,
  });
  const onSuccess = (data: McpStatus) => qc.setQueryData(["mcp-status"], data);
  const setMode = useMutation({
    mutationFn: (mode: McpMode) => api.mcp.setMode(mode),
    onSuccess,
  });
  const setExposeLan = useMutation({
    mutationFn: (expose: boolean) => api.mcp.setExposeLan(expose),
    onSuccess,
  });
  const regenerateToken = useMutation({
    mutationFn: () => api.mcp.regenerateToken(),
    onSuccess,
  });
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const modeOptions = useModeOptions();

  const handleCopy = async (key: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey((k) => (k === key ? null : k)), 1500);
    } catch (e) {
      console.error("clipboard write failed", e);
    }
  };

  const current = status?.mode ?? "off";
  const running = status?.running ?? false;
  const exposeLan = status?.exposeLan ?? false;

  return (
    <section className="flex max-w-2xl flex-col gap-4 rounded-md border border-border bg-card/40 p-4">
      <header className="flex items-center gap-2">
        <Bot size={16} className="text-muted-foreground" />
        <h3 className="text-sm font-semibold">{t("settings.mcp.heading")}</h3>
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
          {t(running ? "settings.mcp.running" : "settings.mcp.stopped")}
        </span>
      </header>

      <p className="text-xs text-muted-foreground">
        {t("settings.mcp.description")}
      </p>

      <div className="flex flex-col gap-2">
        {modeOptions.map((opt) => (
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
            onClick={() => handleCopy("url", status.url)}
            aria-label={t("settings.mcp.copyEndpoint")}
          >
            {copiedKey === "url" ? <Check /> : <Copy />}
            {t(copiedKey === "url" ? "common.copied" : "common.copy")}
          </Button>
        </div>
      )}

      {/* LAN expose section — only meaningful when MCP is running. */}
      {running && status && (
        <div
          className={cn(
            "flex flex-col gap-3 rounded-md border p-3 transition-colors",
            exposeLan ? "border-amber-500/40 bg-amber-500/5" : "border-border",
          )}
        >
          <label className="flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              checked={exposeLan}
              onChange={(e) => setExposeLan.mutate(e.target.checked)}
              disabled={setExposeLan.isPending}
              className="mt-0.5 h-4 w-4 cursor-pointer accent-primary"
            />
            <div className="flex flex-1 flex-col gap-0.5">
              <span className="flex items-center gap-1.5 text-sm font-medium">
                <Globe size={14} className="text-muted-foreground" />
                {t("settings.mcp.exposeLan")}
              </span>
              <span className="text-xs text-muted-foreground">
                {t("settings.mcp.exposeLanDescription")}
              </span>
            </div>
          </label>

          {exposeLan && (
            <>
              <div className="flex items-start gap-2 rounded border border-amber-500/30 bg-amber-500/10 p-2 text-xs text-amber-200">
                <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                <span>{t("settings.mcp.exposeLanWarning")}</span>
              </div>

              {status.lanUrl ? (
                <LabeledCopyRow
                  label={t("settings.mcp.lanUrlLabel")}
                  value={status.lanUrl}
                  copied={copiedKey === "lan-url"}
                  onCopy={() => handleCopy("lan-url", status.lanUrl ?? "")}
                  copyAria={t("settings.mcp.copyLanUrl")}
                  t={t}
                />
              ) : (
                <p className="text-xs text-muted-foreground">
                  {t("settings.mcp.lanUrlUnknown")}
                </p>
              )}

              <LabeledCopyRow
                label={t("settings.mcp.tokenLabel")}
                value={status.token}
                icon={<KeyRound size={14} className="text-muted-foreground" />}
                copied={copiedKey === "token"}
                onCopy={() => handleCopy("token", status.token)}
                copyAria={t("settings.mcp.copyToken")}
                t={t}
                trailingButton={
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => regenerateToken.mutate()}
                    disabled={regenerateToken.isPending}
                    aria-label={t("settings.mcp.regenerateToken")}
                    title={t("settings.mcp.regenerateToken")}
                  >
                    <RefreshCcw />
                  </Button>
                }
              />
            </>
          )}
        </div>
      )}

      {(setMode.error || setExposeLan.error || regenerateToken.error) && (
        <p className="text-xs text-destructive">
          {t("settings.mcp.failed")}:{" "}
          {String(
            setMode.error ?? setExposeLan.error ?? regenerateToken.error,
          )}
        </p>
      )}
    </section>
  );
}

function LabeledCopyRow({
  label,
  value,
  icon,
  copied,
  onCopy,
  copyAria,
  trailingButton,
  t,
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
  copied: boolean;
  onCopy: () => void;
  copyAria: string;
  trailingButton?: React.ReactNode;
  t: (key: string) => string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {icon}
        {label}
      </span>
      <div className="flex items-center gap-2 rounded border border-border bg-background px-3 py-2">
        <code className="flex-1 break-all font-mono text-xs">{value}</code>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={onCopy}
          aria-label={copyAria}
        >
          {copied ? <Check /> : <Copy />}
          {t(copied ? "common.copied" : "common.copy")}
        </Button>
        {trailingButton}
      </div>
    </div>
  );
}

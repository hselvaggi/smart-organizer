import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Bot, Check, Circle, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { api } from "@/lib/tauri";
import type { McpMode } from "@/types/generated";

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
  const setMode = useMutation({
    mutationFn: (mode: McpMode) => api.mcp.setMode(mode),
    onSuccess: (data) => {
      qc.setQueryData(["mcp-status"], data);
    },
  });
  const [copied, setCopied] = useState(false);
  const modeOptions = useModeOptions();

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
            onClick={() => handleCopy(status.url)}
            aria-label={t("settings.mcp.copyEndpoint")}
          >
            {copied ? <Check /> : <Copy />}
            {t(copied ? "common.copied" : "common.copy")}
          </Button>
        </div>
      )}

      {setMode.error && (
        <p className="text-xs text-destructive">
          {t("settings.mcp.failed")}: {String(setMode.error)}
        </p>
      )}
    </section>
  );
}

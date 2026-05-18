import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  AlertTriangle,
  Bot,
  CalendarClock,
  Check,
  Circle,
  Copy,
  Languages,
  Power,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { SUPPORTED_LOCALES, type Locale } from "@/i18n";
import { api } from "@/lib/tauri";
import type { McpMode } from "@/types/generated";

export const Route = createFileRoute("/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const { t } = useTranslation();
  return (
    <div className="flex h-full flex-col gap-6 overflow-y-auto p-8">
      <header>
        <h2 className="text-xl font-semibold tracking-tight">
          {t("settings.heading")}
        </h2>
        <p className="text-sm text-muted-foreground">{t("settings.subtitle")}</p>
      </header>

      <LanguageSection />
      <DeadlinesSection />
      <McpSection />
      <ApplicationSection />
      <DangerZone />
    </div>
  );
}

function LanguageSection() {
  const { t, i18n } = useTranslation();
  const current = (i18n.resolvedLanguage ?? "en") as Locale;

  return (
    <section className="flex max-w-2xl flex-col gap-3 rounded-md border border-border bg-card/40 p-4">
      <header className="flex items-center gap-2">
        <Languages size={16} className="text-muted-foreground" />
        <h3 className="text-sm font-semibold">
          {t("settings.language.heading")}
        </h3>
      </header>
      <p className="text-xs text-muted-foreground">
        {t("settings.language.description")}
      </p>
      <Select
        value={current}
        onValueChange={(v) => i18n.changeLanguage(v as Locale)}
      >
        <SelectTrigger className="w-48">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {SUPPORTED_LOCALES.map((loc) => (
            <SelectItem key={loc} value={loc}>
              {loc === "en"
                ? t("settings.language.english")
                : t("settings.language.spanish")}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </section>
  );
}

function ApplicationSection() {
  const { t } = useTranslation();
  return (
    <section className="flex max-w-2xl flex-col gap-3 rounded-md border border-border bg-card/40 p-4">
      <header className="flex items-center gap-2">
        <Power size={16} className="text-muted-foreground" />
        <h3 className="text-sm font-semibold">
          {t("settings.application.heading")}
        </h3>
      </header>
      <p className="text-xs text-muted-foreground">
        {t("settings.application.description")}
      </p>
      <div>
        <Button type="button" variant="outline" onClick={() => api.system.quit()}>
          <Power />
          {t("settings.application.quit")}
        </Button>
      </div>
    </section>
  );
}

function DeadlinesSection() {
  const { t } = useTranslation();
  const [yellowDays, setYellowDays] = useYellowDays();

  return (
    <section className="flex max-w-2xl flex-col gap-3 rounded-md border border-border bg-card/40 p-4">
      <header className="flex items-center gap-2">
        <CalendarClock size={16} className="text-muted-foreground" />
        <h3 className="text-sm font-semibold">
          {t("settings.deadlines.heading")}
        </h3>
      </header>
      <p className="text-xs text-muted-foreground">
        {t("settings.deadlines.description")}
      </p>
      <label className="flex items-center gap-3">
        <span className="text-sm">{t("settings.deadlines.warnBefore")}</span>
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
        <span className="text-sm text-muted-foreground">
          {t("settings.deadlines.days")}
        </span>
      </label>
    </section>
  );
}

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

function McpSection() {
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

function DangerZone() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [done, setDone] = useState(false);

  const reset = useMutation({
    mutationFn: api.system.reset,
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
        <h3 className="text-sm font-semibold">
          {t("settings.dangerZone.heading")}
        </h3>
      </header>
      <p className="text-xs text-muted-foreground">
        {t("settings.dangerZone.description")}
      </p>
      <div>
        <Button
          type="button"
          variant="destructive"
          onClick={() => setOpen(true)}
        >
          <Trash2 />
          {t("settings.dangerZone.resetButton")}
        </Button>
      </div>

      <Dialog open={open} onOpenChange={(o) => !reset.isPending && setOpen(o)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle size={16} className="text-destructive" />
              {t("settings.dangerZone.dialogTitle")}
            </DialogTitle>
            <DialogDescription>
              {t("settings.dangerZone.dialogDescription", {
                token: "RESET",
              })}
            </DialogDescription>
          </DialogHeader>

          {done ? (
            <div className="flex items-center gap-2 rounded-md border border-emerald-500/40 bg-emerald-500/10 p-3 text-sm text-emerald-300">
              <Check size={16} />
              {t("settings.dangerZone.done")}
            </div>
          ) : (
            <>
              <Input
                value={confirmation}
                onChange={(e) => setConfirmation(e.target.value)}
                placeholder={t("settings.dangerZone.confirmPlaceholder")}
                autoFocus
                disabled={reset.isPending}
              />
              {reset.error && (
                <p className="text-xs text-destructive">
                  {t("settings.dangerZone.failed")}: {String(reset.error)}
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
              {t("common.cancel")}
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => reset.mutate()}
              disabled={!canConfirm || done}
            >
              <Trash2 />
              {reset.isPending
                ? t("settings.dangerZone.wiping")
                : t("settings.dangerZone.confirmButton")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}

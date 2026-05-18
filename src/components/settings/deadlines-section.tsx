import { useTranslation } from "react-i18next";
import { CalendarClock } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useYellowDays } from "@/lib/deadline";

export function DeadlinesSection() {
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

import { useTranslation } from "react-i18next";
import { Power } from "lucide-react";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/tauri";

export function ApplicationSection() {
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

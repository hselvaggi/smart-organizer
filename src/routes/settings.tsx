import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { ApplicationSection } from "@/components/settings/application-section";
import { AppearanceSection } from "@/components/settings/appearance-section";
import { DangerZoneSection } from "@/components/settings/danger-zone-section";
import { DeadlinesSection } from "@/components/settings/deadlines-section";
import { LanguageSection } from "@/components/settings/language-section";
import { McpSection } from "@/components/settings/mcp-section";
import { SyncSection } from "@/components/settings/sync-section";

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
      <AppearanceSection />
      <DeadlinesSection />
      <McpSection />
      <SyncSection />
      <ApplicationSection />
      <DangerZoneSection />
    </div>
  );
}

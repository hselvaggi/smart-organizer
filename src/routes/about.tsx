import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { getName, getVersion } from "@tauri-apps/api/app";
import { Info } from "lucide-react";

export const Route = createFileRoute("/about")({
  component: AboutPage,
});

function AboutPage() {
  const { t } = useTranslation();
  const [name, setName] = useState<string>("Organizer");
  const [version, setVersion] = useState<string>("");

  useEffect(() => {
    getName().then(setName).catch(() => {});
    getVersion().then(setVersion).catch(() => {});
  }, []);

  return (
    <div className="flex h-full flex-col gap-6 overflow-y-auto p-8">
      <header className="flex items-center gap-2">
        <Info size={18} className="text-muted-foreground" />
        <h2 className="text-xl font-semibold tracking-tight">
          {t("about.heading")}
        </h2>
      </header>

      <section className="flex max-w-2xl flex-col gap-4 rounded-md border border-border bg-card/40 p-6">
        <div>
          <h3 className="text-lg font-semibold">{name}</h3>
          {version && (
            <p className="text-xs text-muted-foreground">
              {t("about.version")} {version}
            </p>
          )}
        </div>
        <p className="text-sm text-muted-foreground">{t("about.description")}</p>

        <dl className="grid grid-cols-[max-content_1fr] gap-x-6 gap-y-2 text-sm">
          <dt className="text-muted-foreground">{t("about.labelAuthor")}</dt>
          <dd className="font-medium">Harold Selvaggi</dd>

          <dt className="text-muted-foreground">{t("about.labelStack")}</dt>
          <dd>Tauri 2 · Rust · React · TypeScript · SQLite</dd>

          <dt className="text-muted-foreground">{t("about.labelLicense")}</dt>
          <dd>
            {t("about.licenseDescription")}{" "}
            <a
              href="mailto:harold.selvaggi@gmail.com"
              className="text-primary hover:underline"
            >
              harold.selvaggi@gmail.com
            </a>
            .
          </dd>
        </dl>
      </section>
    </div>
  );
}

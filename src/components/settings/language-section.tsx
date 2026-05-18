import { useTranslation } from "react-i18next";
import { Languages } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SUPPORTED_LOCALES, type Locale } from "@/i18n";

export function LanguageSection() {
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

import { useTranslation } from "react-i18next";
import { Palette } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { THEMES, useTheme, type Theme } from "@/lib/theme";

export function AppearanceSection() {
  const { t } = useTranslation();
  const [theme, setTheme] = useTheme();

  return (
    <section className="flex max-w-2xl flex-col gap-3 rounded-md border border-border bg-card/40 p-4">
      <header className="flex items-center gap-2">
        <Palette size={16} className="text-muted-foreground" />
        <h3 className="text-sm font-semibold">
          {t("settings.appearance.heading")}
        </h3>
      </header>
      <p className="text-xs text-muted-foreground">
        {t("settings.appearance.description")}
      </p>
      <Select value={theme} onValueChange={(v) => setTheme(v as Theme)}>
        <SelectTrigger className="w-48">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {THEMES.map((name) => (
            <SelectItem key={name} value={name}>
              {t(`settings.appearance.themes.${name}`)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </section>
  );
}

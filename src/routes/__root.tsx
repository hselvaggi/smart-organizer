import { useEffect } from "react";
import { Outlet, Link, createRootRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import {
  Cpu,
  FolderKanban,
  Info,
  NotebookPen,
  Search,
  Settings2,
} from "lucide-react";
import { ResizeHandles } from "@/components/resize-handles";
import { TitleBar } from "@/components/title-bar";
import { CommandPalette } from "@/components/search/command-palette";
import { cn } from "@/lib/cn";
import { useUiStore } from "@/lib/store/ui";
import { useSearchStore } from "@/lib/store/search";

export const Route = createRootRoute({
  component: RootLayout,
});

function RootLayout() {
  const { t } = useTranslation();
  const sidebarCollapsed = useUiStore((s) => s.sidebarCollapsed);
  const openSearch = useSearchStore((s) => s.setOpen);
  const toggleSearch = useSearchStore((s) => s.toggle);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const isShortcut =
        (e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && e.key === "k";
      if (isShortcut) {
        e.preventDefault();
        toggleSearch();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggleSearch]);

  return (
    <div className="relative flex h-full flex-col bg-background">
      <ResizeHandles />
      <TitleBar />
      <CommandPalette />
      <div
        className="grid min-h-0 flex-1 transition-[grid-template-columns] duration-200 ease-out"
        style={{
          gridTemplateColumns: sidebarCollapsed ? "0px 1fr" : "220px 1fr",
        }}
      >
        <aside
          className={cn(
            "flex flex-col gap-1 overflow-hidden border-r border-border bg-card/40",
            sidebarCollapsed ? "border-r-0" : "p-3",
          )}
        >
          <div className="px-2 pb-3 pt-1">
            <h1 className="text-sm font-semibold tracking-tight">Organizer</h1>
            <p className="text-xs text-muted-foreground">{t("nav.tagline")}</p>
          </div>
          <button
            type="button"
            onClick={() => openSearch(true)}
            className={cn(
              "flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-sm text-muted-foreground transition-colors",
              "hover:bg-accent hover:text-accent-foreground",
            )}
          >
            <span className="flex items-center gap-2">
              <Search size={16} />
              <span>{t("nav.search")}</span>
            </span>
            <kbd className="rounded border border-border bg-card px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">
              ⌘K
            </kbd>
          </button>
          <NavItem
            to="/"
            icon={<FolderKanban size={16} />}
            label={t("nav.projects")}
          />
          <NavItem
            to="/notes"
            icon={<NotebookPen size={16} />}
            label={t("nav.notes")}
          />
          <NavItem
            to="/system-check"
            icon={<Cpu size={16} />}
            label={t("nav.system")}
          />
          <NavItem
            to="/settings"
            icon={<Settings2 size={16} />}
            label={t("nav.settings")}
          />
          <NavItem
            to="/about"
            icon={<Info size={16} />}
            label={t("nav.about")}
          />
        </aside>
        <main className="overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

function NavItem({
  to,
  icon,
  label,
}: {
  to: string;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <Link
      to={to}
      className={cn(
        "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-muted-foreground transition-colors",
        "hover:bg-accent hover:text-accent-foreground",
      )}
      activeProps={{ className: "bg-accent text-accent-foreground" }}
    >
      {icon}
      <span>{label}</span>
    </Link>
  );
}

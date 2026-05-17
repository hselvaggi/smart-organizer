import { Outlet, Link, createRootRoute } from "@tanstack/react-router";
import { FolderKanban, Settings2, Cpu } from "lucide-react";
import { ResizeHandles } from "@/components/resize-handles";
import { TitleBar } from "@/components/title-bar";
import { cn } from "@/lib/cn";

export const Route = createRootRoute({
  component: RootLayout,
});

function RootLayout() {
  return (
    <div className="relative flex h-full flex-col bg-background">
      <ResizeHandles />
      <TitleBar />
      <div className="grid min-h-0 flex-1 grid-cols-[220px_1fr]">
        <aside className="flex flex-col gap-1 border-r border-border bg-card/40 p-3">
          <div className="px-2 pb-3 pt-1">
            <h1 className="text-sm font-semibold tracking-tight">Tasks</h1>
            <p className="text-xs text-muted-foreground">
              Local-first work tracker
            </p>
          </div>
          <NavItem to="/" icon={<FolderKanban size={16} />} label="Projects" />
          <NavItem
            to="/system-check"
            icon={<Cpu size={16} />}
            label="System"
          />
          <NavItem
            to="/settings"
            icon={<Settings2 size={16} />}
            label="Settings"
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

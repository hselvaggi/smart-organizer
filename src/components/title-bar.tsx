import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { getCurrentWindow } from "@tauri-apps/api/window";
import {
  Maximize2,
  Minimize2,
  Minus,
  PanelLeftClose,
  PanelLeftOpen,
  X,
} from "lucide-react";
import { useUiStore } from "@/lib/store/ui";

export function TitleBar() {
  const win = getCurrentWindow();
  const { t } = useTranslation();
  const [maximized, setMaximized] = useState(false);
  const sidebarCollapsed = useUiStore((s) => s.sidebarCollapsed);
  const toggleSidebar = useUiStore((s) => s.toggleSidebar);

  useEffect(() => {
    win.isMaximized().then(setMaximized);
    const unlistenPromise = win.onResized(() => {
      win.isMaximized().then(setMaximized);
    });
    return () => {
      unlistenPromise.then((u) => u());
    };
  }, [win]);

  return (
    <div
      data-tauri-drag-region
      className="flex h-9 select-none items-center justify-between border-b border-border bg-card/80 pl-1 pr-1"
    >
      <div className="flex items-center gap-1">
        <TitleBarButton
          onClick={toggleSidebar}
          label={t(sidebarCollapsed ? "nav.showSidebar" : "nav.hideSidebar")}
        >
          {sidebarCollapsed ? (
            <PanelLeftOpen size={14} />
          ) : (
            <PanelLeftClose size={14} />
          )}
        </TitleBarButton>
        <span
          data-tauri-drag-region
          className="px-1 text-xs font-semibold tracking-tight text-foreground"
        >
          Organizer
        </span>
      </div>
      <div className="flex items-center">
        <TitleBarButton
          onClick={() => win.minimize()}
          label={t("titleBar.minimize")}
        >
          <Minus size={14} />
        </TitleBarButton>
        <TitleBarButton
          onClick={() => win.toggleMaximize()}
          label={t(maximized ? "titleBar.restore" : "titleBar.maximize")}
        >
          {maximized ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
        </TitleBarButton>
        <TitleBarButton
          onClick={() => win.close()}
          label={t("titleBar.close")}
          danger
        >
          <X size={14} />
        </TitleBarButton>
      </div>
    </div>
  );
}

function TitleBarButton({
  onClick,
  label,
  danger,
  children,
}: {
  onClick: () => void;
  label: string;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={
        "flex h-7 w-9 items-center justify-center rounded text-muted-foreground transition-colors " +
        (danger
          ? "hover:bg-destructive/90 hover:text-destructive-foreground"
          : "hover:bg-accent hover:text-accent-foreground")
      }
    >
      {children}
    </button>
  );
}

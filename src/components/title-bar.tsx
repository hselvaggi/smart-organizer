import { useEffect, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { Maximize2, Minimize2, Minus, X } from "lucide-react";

export function TitleBar() {
  const win = getCurrentWindow();
  const [maximized, setMaximized] = useState(false);

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
      className="flex h-9 select-none items-center justify-between border-b border-border bg-card/80 pl-3 pr-1"
    >
      <span
        data-tauri-drag-region
        className="text-xs font-semibold tracking-tight text-foreground"
      >
        Tasks
      </span>
      <div className="flex items-center">
        <TitleBarButton onClick={() => win.minimize()} label="Minimize">
          <Minus size={14} />
        </TitleBarButton>
        <TitleBarButton
          onClick={() => win.toggleMaximize()}
          label={maximized ? "Restore" : "Maximize"}
        >
          {maximized ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
        </TitleBarButton>
        <TitleBarButton
          onClick={() => win.close()}
          label="Close"
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

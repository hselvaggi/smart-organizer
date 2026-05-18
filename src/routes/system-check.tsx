import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Check, Copy, X } from "lucide-react";
import { useState } from "react";
import { writeText as tauriWriteText } from "@tauri-apps/plugin-clipboard-manager";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/tauri";

export const Route = createFileRoute("/system-check")({
  component: SystemCheck,
});

type CapMeta = {
  description: string;
  install: Record<string, string>;
};

const META: Record<string, CapMeta> = {
  pdflatex: {
    description: "Compile full LaTeX documents to PDF",
    install: {
      linux: "sudo apt install texlive-latex-recommended",
      macos: "brew install --cask basictex",
      windows: "winget install MiKTeX.MiKTeX",
    },
  },
  xelatex: {
    description: "LaTeX with Unicode + system fonts",
    install: {
      linux: "sudo apt install texlive-xetex",
      macos: "brew install --cask basictex",
      windows: "winget install MiKTeX.MiKTeX",
    },
  },
  pandoc: {
    description: "Convert between document formats (md ↔ docx ↔ pdf)",
    install: {
      linux: "sudo apt install pandoc",
      macos: "brew install pandoc",
      windows: "winget install JohnMacFarlane.Pandoc",
    },
  },
  git: {
    description: "Version control. Required for some future sync features",
    install: {
      linux: "sudo apt install git",
      macos: "brew install git",
      windows: "winget install Git.Git",
    },
  },
  dot: {
    description: "Graphviz — render .dot diagrams",
    install: {
      linux: "sudo apt install graphviz",
      macos: "brew install graphviz",
      windows: "winget install Graphviz.Graphviz",
    },
  },
  mmdc: {
    description: "Mermaid CLI — render flowcharts and sequence diagrams",
    install: {
      linux: "npm install -g @mermaid-js/mermaid-cli",
      macos: "npm install -g @mermaid-js/mermaid-cli",
      windows: "npm install -g @mermaid-js/mermaid-cli",
    },
  },
  node: {
    description: "Node.js runtime — required by mermaid-cli and other tools",
    install: {
      linux: "sudo apt install nodejs npm",
      macos: "brew install node",
      windows: "winget install OpenJS.NodeJS",
    },
  },
  plantuml: {
    description: "PlantUML — UML diagrams from plain text",
    install: {
      linux: "sudo apt install plantuml",
      macos: "brew install plantuml",
      windows: "winget install PlantUML.PlantUML",
    },
  },
};

function SystemCheck() {
  const { t } = useTranslation();
  const { data, isLoading, error } = useQuery({
    queryKey: ["system-info"],
    queryFn: api.system.info,
  });

  return (
    <div className="flex h-full flex-col gap-6 overflow-y-auto p-8">
      <header>
        <h2 className="text-xl font-semibold tracking-tight">
          {t("systemCheck.heading")}
        </h2>
        <p className="text-sm text-muted-foreground">
          {t("systemCheck.subtitle")}
        </p>
      </header>

      {isLoading && (
        <p className="text-sm text-muted-foreground">
          {t("systemCheck.loading")}
        </p>
      )}

      {error && (
        <p className="text-sm text-destructive">
          {t("systemCheck.failed")}: {String(error)}
        </p>
      )}

      {data && (
        <div className="max-w-4xl">
          <p className="mb-4 text-xs text-muted-foreground">
            {t("systemCheck.detectedPlatform")}:{" "}
            <span className="font-mono">{data.os}</span>
          </p>
          <ul className="flex flex-col gap-2">
            {data.capabilities.map((cap) => (
              <CapabilityRow key={cap.name} cap={cap} os={data.os} />
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function CapabilityRow({
  cap,
  os,
}: {
  cap: { name: string; detectedPath: string | null };
  os: string;
}) {
  const { t } = useTranslation();
  const meta = META[cap.name];
  const installCmd = meta?.install[os] ?? meta?.install.linux ?? "";
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!installCmd) return;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(installCmd);
      } else {
        await tauriWriteText(installCmd);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (err) {
      console.error("clipboard write failed, trying tauri plugin", err);
      try {
        await tauriWriteText(installCmd);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      } catch (err2) {
        console.error("tauri clipboard also failed", err2);
      }
    }
  };

  return (
    <li className="rounded-md border border-border bg-card p-3">
      <div className="flex items-center gap-3">
        <span
          className={
            cap.detectedPath
              ? "flex size-6 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-400"
              : "flex size-6 items-center justify-center rounded-full bg-muted text-muted-foreground"
          }
        >
          {cap.detectedPath ? <Check size={14} /> : <X size={14} />}
        </span>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm font-medium">{cap.name}</span>
            {cap.detectedPath && (
              <span className="font-mono text-xs text-muted-foreground">
                {cap.detectedPath}
              </span>
            )}
          </div>
          {meta && (
            <p className="text-xs text-muted-foreground">{meta.description}</p>
          )}
        </div>
      </div>

      {!cap.detectedPath && installCmd && (
        <div className="mt-3 flex items-center gap-2 rounded border border-border bg-background px-3 py-2">
          <code className="flex-1 font-mono text-xs text-foreground">
            {installCmd}
          </code>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={handleCopy}
            aria-label={t("systemCheck.copyAria")}
          >
            {copied ? <Check /> : <Copy />}
            {t(copied ? "common.copied" : "common.copy")}
          </Button>
        </div>
      )}
    </li>
  );
}

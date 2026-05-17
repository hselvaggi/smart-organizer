import { useEffect, useMemo, useRef, useState } from "react";
import { EditorState } from "@codemirror/state";
import { EditorView, keymap, lineNumbers } from "@codemirror/view";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { syntaxHighlighting, defaultHighlightStyle } from "@codemirror/language";
import { markdown } from "@codemirror/lang-markdown";
import { html as htmlLang } from "@codemirror/lang-html";
import { stex } from "@codemirror/legacy-modes/mode/stex";
import { StreamLanguage } from "@codemirror/language";
import { oneDark } from "@codemirror/theme-one-dark";
import { Columns2, FileCode, FileText } from "lucide-react";

import { cn } from "@/lib/cn";
import { renderField } from "@/lib/render";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { TextFormat } from "@/types/generated";

type ViewMode = "split" | "edit" | "preview";

const FORMATS: TextFormat[] = ["markdown", "plaintext", "html", "latex"];

function languageFor(format: TextFormat) {
  switch (format) {
    case "markdown":
      return markdown();
    case "html":
      return htmlLang();
    case "latex":
      return StreamLanguage.define(stex);
    case "plaintext":
      return [];
  }
}

export function SplitEditor({
  value,
  onChange,
  onBlur,
  format,
  onFormatChange,
  placeholder,
  minHeight = 220,
}: {
  value: string;
  onChange: (next: string) => void;
  onBlur?: () => void;
  format: TextFormat;
  onFormatChange: (next: TextFormat) => void;
  placeholder?: string;
  minHeight?: number;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const valueRef = useRef(value);
  const onChangeRef = useRef(onChange);
  const onBlurRef = useRef(onBlur);

  const [mode, setMode] = useState<ViewMode>("split");

  useEffect(() => {
    valueRef.current = value;
    onChangeRef.current = onChange;
    onBlurRef.current = onBlur;
  });

  useEffect(() => {
    if (!hostRef.current) return;

    const state = EditorState.create({
      doc: valueRef.current,
      extensions: [
        lineNumbers(),
        history(),
        keymap.of([...defaultKeymap, ...historyKeymap]),
        EditorView.lineWrapping,
        syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
        languageFor(format),
        oneDark,
        EditorView.theme({
          "&": {
            fontSize: "13px",
            backgroundColor: "transparent",
            height: "100%",
          },
          ".cm-scroller": { fontFamily: "inherit" },
          ".cm-content": { fontFamily: "var(--font-mono, monospace)" },
          ".cm-gutters": {
            backgroundColor: "transparent",
            border: "none",
            color: "hsl(var(--muted-foreground) / 0.5)",
          },
          "&.cm-focused": { outline: "none" },
        }),
        EditorView.updateListener.of((u) => {
          if (u.docChanged) {
            const next = u.state.doc.toString();
            if (next !== valueRef.current) {
              valueRef.current = next;
              onChangeRef.current(next);
            }
          }
        }),
        EditorView.domEventHandlers({
          blur: () => {
            onBlurRef.current?.();
            return false;
          },
        }),
      ],
    });

    const view = new EditorView({ state, parent: hostRef.current });
    viewRef.current = view;

    return () => {
      view.destroy();
      viewRef.current = null;
    };
    // language changes are handled below to avoid rebuilding the editor.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep doc in sync when value changes externally (e.g. dialog opens with a different task).
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const current = view.state.doc.toString();
    if (current === value) return;
    view.dispatch({
      changes: { from: 0, to: current.length, insert: value },
    });
  }, [value]);

  const previewHtml = useMemo(() => renderField(value, format), [value, format]);

  return (
    <div className="flex flex-col overflow-hidden rounded-md border border-input bg-background">
      <div className="flex items-center justify-between border-b border-border bg-card/60 px-2 py-1">
        <Select value={format} onValueChange={(v) => onFormatChange(v as TextFormat)}>
          <SelectTrigger className="h-7 w-32 px-2 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {FORMATS.map((f) => (
              <SelectItem key={f} value={f}>
                {f}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <ModeToggle mode={mode} onChange={setMode} />
      </div>

      <div
        className="grid overflow-hidden"
        style={{
          height: minHeight,
          gridTemplateColumns:
            mode === "split"
              ? "1fr 1fr"
              : mode === "edit"
                ? "1fr 0"
                : "0 1fr",
        }}
      >
        <div
          ref={hostRef}
          style={{ gridColumn: 1, gridRow: 1 }}
          className={cn(
            "h-full min-w-0 overflow-hidden",
            mode === "split" && "border-r border-border",
          )}
          aria-label={placeholder}
          data-placeholder={placeholder}
        />
        <div
          style={{ gridColumn: 2, gridRow: 1 }}
          className="h-full min-w-0 overflow-auto bg-background p-3"
        >
          {previewHtml ? (
            <div
              className="prose-tasks"
              dangerouslySetInnerHTML={{ __html: previewHtml }}
            />
          ) : (
            <p className="text-xs italic text-muted-foreground">
              {placeholder ?? "Preview will appear here as you type"}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function ModeToggle({
  mode,
  onChange,
}: {
  mode: ViewMode;
  onChange: (m: ViewMode) => void;
}) {
  const items: { value: ViewMode; icon: React.ReactNode; label: string }[] = [
    { value: "edit", icon: <FileCode size={14} />, label: "Source" },
    { value: "split", icon: <Columns2 size={14} />, label: "Split" },
    { value: "preview", icon: <FileText size={14} />, label: "Preview" },
  ];
  return (
    <div className="flex items-center gap-1 rounded-md border border-input bg-background p-0.5">
      {items.map((it) => (
        <button
          key={it.value}
          type="button"
          onClick={() => onChange(it.value)}
          aria-label={it.label}
          title={it.label}
          className={cn(
            "flex h-6 items-center gap-1 rounded px-1.5 text-xs transition-colors",
            mode === it.value
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {it.icon}
        </button>
      ))}
    </div>
  );
}

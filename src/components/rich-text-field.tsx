import { useMemo, useState } from "react";
import { Eye, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SplitEditor } from "@/components/editor/split-editor";
import { renderField } from "@/lib/render";
import type { TextFormat } from "@/types/generated";

export function RichTextField({
  label,
  value,
  onChange,
  format,
  onFormatChange,
  placeholder,
  emptyLabel,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
  format: TextFormat;
  onFormatChange: (next: TextFormat) => void;
  placeholder?: string;
  emptyLabel?: string;
}) {
  const [editing, setEditing] = useState(false);
  const rendered = useMemo(() => renderField(value, format), [value, format]);

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium">{label}</label>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => setEditing((v) => !v)}
        >
          {editing ? <Eye /> : <Pencil />}
          {editing ? "Preview" : "Edit"}
        </Button>
      </div>

      {editing ? (
        <SplitEditor
          value={value}
          onChange={onChange}
          format={format}
          onFormatChange={onFormatChange}
          placeholder={placeholder}
        />
      ) : value.trim() ? (
        <div
          className="prose-tasks rounded-md border border-border bg-muted/50 p-4"
          dangerouslySetInnerHTML={{ __html: rendered }}
        />
      ) : (
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="rounded-md border border-dashed border-border p-4 text-center text-xs text-muted-foreground hover:border-border/80 hover:text-foreground"
        >
          {emptyLabel ?? "Empty — click to add content."}
        </button>
      )}
    </div>
  );
}

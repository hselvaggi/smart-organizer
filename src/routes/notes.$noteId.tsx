import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Save, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Breadcrumb, type BreadcrumbItem } from "@/components/breadcrumb";
import { RichTextField } from "@/components/rich-text-field";
import {
  useDeleteNote,
  useNote,
  useUpdateNote,
} from "@/lib/queries/notes";
import { useProject } from "@/lib/queries/projects";
import type { TextFormat } from "@/types/generated";

export const Route = createFileRoute("/notes/$noteId")({
  component: NoteDetail,
});

function NoteDetail() {
  const { noteId } = Route.useParams();
  const navigate = useNavigate();

  const { data: note } = useNote(noteId);
  const { data: project } = useProject(note?.projectId ?? "");
  const update = useUpdateNote();
  const remove = useDeleteNote();

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [bodyFormat, setBodyFormat] = useState<TextFormat>("plaintext");

  useEffect(() => {
    if (!note) return;
    setTitle(note.title);
    setBody(note.body);
    setBodyFormat(note.bodyFormat);
  }, [note]);

  const items: BreadcrumbItem[] = note?.projectId
    ? [
        { label: "Projects", to: "/" },
        {
          label: project?.title ?? "…",
          to: "/projects/$projectId",
          params: { projectId: note.projectId },
        },
        { label: note.title },
      ]
    : [
        { label: "Notes", to: "/notes" },
        { label: note?.title ?? "…" },
      ];

  const canSave = !!note && title.trim().length > 0 && !update.isPending;

  const handleSave = async () => {
    if (!note || !canSave) return;
    await update.mutateAsync({
      id: note.id,
      title: title.trim(),
      body,
      bodyFormat,
    });
  };

  const handleDelete = async () => {
    if (!note) return;
    await remove.mutateAsync(note.id);
    if (note.projectId) {
      navigate({
        to: "/projects/$projectId",
        params: { projectId: note.projectId },
      });
    } else {
      navigate({ to: "/notes" });
    }
  };

  if (!note) {
    return (
      <div className="flex h-full flex-col gap-6 p-8">
        <Breadcrumb items={items} />
        <p className="text-sm text-muted-foreground">Loading note…</p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col gap-6 overflow-y-auto p-8">
      <Breadcrumb items={items} />

      <header className="flex items-start justify-between gap-4">
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Note title"
          className="flex-1 text-xl font-semibold"
        />
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            onClick={handleDelete}
            aria-label="Delete note"
          >
            <Trash2 />
            Delete
          </Button>
          <Button type="button" onClick={handleSave} disabled={!canSave}>
            <Save />
            {update.isPending ? "Saving…" : "Save"}
          </Button>
        </div>
      </header>

      <RichTextField
        label="Body"
        value={body}
        onChange={setBody}
        format={bodyFormat}
        onFormatChange={setBodyFormat}
        placeholder="Write your note here…"
        emptyLabel="Empty note — click to start writing."
      />
    </div>
  );
}

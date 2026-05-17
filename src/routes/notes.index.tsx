import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ChevronRight, NotebookPen, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  useCreateNote,
  useDeleteNote,
  useNotes,
} from "@/lib/queries/notes";
import type { Note } from "@/types/generated";

export const Route = createFileRoute("/notes/")({
  component: NotesIndex,
});

function NotesIndex() {
  const navigate = useNavigate();
  const { data: notes, isLoading } = useNotes();
  const create = useCreateNote();
  const remove = useDeleteNote();

  const handleAdd = async () => {
    const created = await create.mutateAsync({
      title: "Untitled note",
      body: "",
      bodyFormat: "plaintext",
      projectId: null,
    });
    navigate({ to: "/notes/$noteId", params: { noteId: created.id } });
  };

  return (
    <div className="flex h-full flex-col gap-6 p-8">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Notes</h2>
          <p className="text-sm text-muted-foreground">
            Standalone notes, independent of projects and tasks.
          </p>
        </div>
        <Button onClick={handleAdd}>
          <Plus />
          New note
        </Button>
      </header>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : !notes || notes.length === 0 ? (
        <EmptyNotes onAdd={handleAdd} />
      ) : (
        <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {notes.map((n) => (
            <NoteCard
              key={n.id}
              note={n}
              onOpen={() =>
                navigate({
                  to: "/notes/$noteId",
                  params: { noteId: n.id },
                })
              }
              onDelete={() => remove.mutate(n.id)}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function NoteCard({
  note,
  onOpen,
  onDelete,
}: {
  note: Note;
  onOpen: () => void;
  onDelete: () => void;
}) {
  const preview = note.body.replace(/\s+/g, " ").trim().slice(0, 180);
  return (
    <li className="group flex flex-col gap-2 rounded-md border border-border bg-card p-3 transition-colors hover:border-primary/40">
      <button
        type="button"
        onClick={onOpen}
        className="flex flex-col gap-1 text-left"
      >
        <div className="flex items-center gap-2">
          <NotebookPen size={14} className="text-muted-foreground" />
          <span className="text-sm font-medium">{note.title}</span>
          <ChevronRight
            size={14}
            className="ml-auto text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100"
          />
        </div>
        {preview && (
          <p className="line-clamp-3 text-xs text-muted-foreground">
            {preview}
            {note.body.length > 180 ? "…" : ""}
          </p>
        )}
      </button>
      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
        <time dateTime={note.updatedAt}>
          {new Date(note.updatedAt).toLocaleString()}
        </time>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="opacity-0 transition-opacity group-hover:opacity-100"
          onClick={onDelete}
          aria-label="Delete note"
        >
          <Trash2 />
        </Button>
      </div>
    </li>
  );
}

function EmptyNotes({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="flex max-w-3xl flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border p-12 text-center">
      <NotebookPen className="size-10 text-muted-foreground" />
      <h3 className="text-sm font-medium">No notes yet</h3>
      <p className="max-w-sm text-xs text-muted-foreground">
        Notes live outside the project hierarchy — use them for quick
        thoughts, references or one-off context.
      </p>
      <Button onClick={onAdd} size="sm">
        <Plus />
        New note
      </Button>
    </div>
  );
}

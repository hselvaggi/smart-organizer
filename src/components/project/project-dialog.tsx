import { useEffect, useState } from "react";
import { Plus, Save } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SplitEditor } from "@/components/editor/split-editor";
import {
  useCreateProject,
  useProjects,
  useUpdateProject,
} from "@/lib/queries/projects";
import type { Project, TextFormat } from "@/types/generated";

type Mode =
  | { kind: "create"; parentId?: string | null }
  | { kind: "edit"; project: Project };

export function ProjectDialog({
  open,
  onOpenChange,
  mode,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: Mode;
}) {
  const create = useCreateProject();
  const update = useUpdateProject();
  const { data: allProjects } = useProjects();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [descriptionFormat, setDescriptionFormat] =
    useState<TextFormat>("plaintext");
  const [parentId, setParentId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    if (mode.kind === "create") {
      setTitle("");
      setDescription("");
      setDescriptionFormat("plaintext");
      setParentId(mode.parentId ?? null);
    } else {
      const p = mode.project;
      setTitle(p.title);
      setDescription(p.description);
      setDescriptionFormat(p.descriptionFormat);
      setParentId(p.parentId);
    }
  }, [open, mode]);

  const isCreate = mode.kind === "create";
  const pending = isCreate ? create.isPending : update.isPending;
  const canSubmit = title.trim().length > 0 && !pending;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    if (isCreate) {
      await create.mutateAsync({
        title: title.trim(),
        description,
        descriptionFormat,
        parentId,
      });
    } else {
      await update.mutateAsync({
        id: mode.project.id,
        title: title.trim(),
        description,
        descriptionFormat,
        parentId,
      });
    }
    onOpenChange(false);
  };

  const parentOptions = (allProjects ?? []).filter(
    (p) => mode.kind !== "edit" || p.id !== mode.project.id,
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isCreate ? "New project" : "Edit project"}</DialogTitle>
          <DialogDescription>
            Projects group stories and tasks. Nest them under a parent if it
            helps organise your workspaces.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="flex flex-col gap-4" id="project-form">
          <Field label="Title">
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Project name"
              autoFocus
              required
            />
          </Field>

          <Field label="Parent project (optional)">
            <Select
              value={parentId ?? "__none__"}
              onValueChange={(v) => setParentId(v === "__none__" ? null : v)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">— top-level —</SelectItem>
                {parentOptions.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field label="Description">
            <SplitEditor
              value={description}
              onChange={setDescription}
              format={descriptionFormat}
              onFormatChange={setDescriptionFormat}
              placeholder="Goals, scope, references…"
            />
          </Field>
        </form>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" form="project-form" disabled={!canSubmit}>
            {isCreate ? <Plus /> : <Save />}
            {pending
              ? isCreate
                ? "Creating…"
                : "Saving…"
              : isCreate
                ? "Create"
                : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  trailing,
  children,
}: {
  label: string;
  trailing?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium">{label}</label>
        {trailing}
      </div>
      {children}
    </div>
  );
}

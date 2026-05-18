import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SplitEditor } from "@/components/editor/split-editor";
import {
  useComments,
  useCreateComment,
  useDeleteComment,
} from "@/lib/queries/comments";
import { renderField } from "@/lib/render";
import type { Comment, TextFormat } from "@/types/generated";

export function TaskComments({ taskId }: { taskId: string }) {
  const { t } = useTranslation();
  const { data: comments } = useComments(taskId);
  const create = useCreateComment(taskId);
  const remove = useDeleteComment(taskId);

  const [body, setBody] = useState("");
  const [format, setFormat] = useState<TextFormat>("plaintext");

  const canSubmit = body.trim().length > 0 && !create.isPending;

  const handleAdd = async () => {
    if (!canSubmit) return;
    await create.mutateAsync({
      taskId,
      body: body.trim(),
      bodyFormat: format,
    });
    setBody("");
  };

  return (
    <section className="flex flex-col gap-3 border-t border-border pt-4">
      <h3 className="text-sm font-semibold">{t("comments.heading")}</h3>

      {(comments ?? []).length === 0 ? (
        <p className="rounded-md border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
          {t("comments.empty")}
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {comments!.map((c) => (
            <CommentRow
              key={c.id}
              comment={c}
              onDelete={() => remove.mutate(c.id)}
            />
          ))}
        </ul>
      )}

      <div className="flex flex-col gap-2 rounded-md border border-border bg-card/40 p-3">
        <SplitEditor
          value={body}
          onChange={setBody}
          format={format}
          onFormatChange={setFormat}
          placeholder={t("comments.placeholder")}
          minHeight={120}
        />
        <div className="flex justify-end">
          <Button
            type="button"
            size="sm"
            onClick={handleAdd}
            disabled={!canSubmit}
          >
            <Plus />
            {t(create.isPending ? "comments.posting" : "comments.post")}
          </Button>
        </div>
      </div>
    </section>
  );
}

function CommentRow({
  comment,
  onDelete,
}: {
  comment: Comment;
  onDelete: () => void;
}) {
  const { t } = useTranslation();
  const html = renderField(comment.body, comment.bodyFormat);
  return (
    <li className="group rounded-md border border-border bg-background p-3">
      <header className="mb-1 flex items-center justify-between text-[11px] text-muted-foreground">
        <time dateTime={comment.createdAt}>
          {new Date(comment.createdAt).toLocaleString()}
        </time>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="opacity-0 transition-opacity group-hover:opacity-100"
          onClick={onDelete}
          aria-label={t("comments.deleteAria")}
        >
          <Trash2 />
        </Button>
      </header>
      <div
        className="prose-tasks"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </li>
  );
}

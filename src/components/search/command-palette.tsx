import { useEffect, useMemo, useState } from "react";
import { Command } from "cmdk";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import DOMPurify from "dompurify";
import {
  FolderKanban,
  ListTodo,
  MessageSquare,
  NotebookPen,
  Search as SearchIcon,
  StickyNote,
} from "lucide-react";
import type { SearchHit } from "@/types/generated";
import { useSearch } from "@/lib/queries/search";
import { useSearchStore } from "@/lib/store/search";
import { cn } from "@/lib/cn";

type Kind = SearchHit["kind"];

const KIND_ORDER: Kind[] = ["project", "story", "task", "note", "comment"];

const KIND_ICON: Record<Kind, JSX.Element> = {
  project: <FolderKanban size={14} />,
  story: <NotebookPen size={14} />,
  task: <ListTodo size={14} />,
  note: <StickyNote size={14} />,
  comment: <MessageSquare size={14} />,
};

function sanitizeSnippet(snippet: string): string {
  return DOMPurify.sanitize(snippet, {
    ALLOWED_TAGS: ["mark"],
    ALLOWED_ATTR: [],
  });
}

type SearchTarget =
  | { to: "/projects/$projectId"; params: { projectId: string } }
  | {
      to: "/projects/$projectId/stories/$storyId";
      params: { projectId: string; storyId: string };
    }
  | {
      to: "/projects/$projectId/stories/$storyId/tasks/$taskId";
      params: { projectId: string; storyId: string; taskId: string };
    }
  | { to: "/notes/$noteId"; params: { noteId: string } };

function routeFor(hit: SearchHit): SearchTarget | null {
  switch (hit.kind) {
    case "project":
      if (!hit.projectId) return null;
      return {
        to: "/projects/$projectId",
        params: { projectId: hit.projectId },
      };
    case "story":
      if (!hit.projectId || !hit.storyId) return null;
      return {
        to: "/projects/$projectId/stories/$storyId",
        params: { projectId: hit.projectId, storyId: hit.storyId },
      };
    case "task":
    case "comment":
      if (!hit.projectId || !hit.storyId || !hit.taskId) return null;
      return {
        to: "/projects/$projectId/stories/$storyId/tasks/$taskId",
        params: {
          projectId: hit.projectId,
          storyId: hit.storyId,
          taskId: hit.taskId,
        },
      };
    case "note":
      if (!hit.entityId) return null;
      return { to: "/notes/$noteId", params: { noteId: hit.entityId } };
    default:
      return null;
  }
}

export function CommandPalette() {
  const { t } = useTranslation();
  const open = useSearchStore((s) => s.open);
  const setOpen = useSearchStore((s) => s.setOpen);
  const navigate = useNavigate();
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  const { data, isFetching } = useSearch(query, open);

  const grouped = useMemo(() => {
    const out: Record<Kind, SearchHit[]> = {
      project: [],
      story: [],
      task: [],
      note: [],
      comment: [],
    };
    for (const hit of data ?? []) {
      if (hit.kind in out) out[hit.kind as Kind].push(hit);
    }
    return out;
  }, [data]);

  const totalHits = (data ?? []).length;

  function selectHit(hit: SearchHit) {
    const target = routeFor(hit);
    setOpen(false);
    if (!target) return;
    switch (target.to) {
      case "/projects/$projectId":
        navigate({ to: target.to, params: target.params });
        return;
      case "/projects/$projectId/stories/$storyId":
        navigate({ to: target.to, params: target.params });
        return;
      case "/projects/$projectId/stories/$storyId/tasks/$taskId":
        navigate({ to: target.to, params: target.params });
        return;
      case "/notes/$noteId":
        navigate({ to: target.to, params: target.params });
        return;
    }
  }

  return (
    <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0" />
        <DialogPrimitive.Content
          className={cn(
            "fixed left-1/2 top-[15%] z-50 w-full max-w-xl -translate-x-1/2",
            "rounded-lg border border-border bg-card shadow-2xl",
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0",
            "data-[state=open]:zoom-in-95 data-[state=closed]:zoom-out-95",
          )}
        >
          <DialogPrimitive.Title className="sr-only">
            {t("search.title")}
          </DialogPrimitive.Title>
          <DialogPrimitive.Description className="sr-only">
            {t("search.description")}
          </DialogPrimitive.Description>
          <Command
            shouldFilter={false}
            label={t("search.title")}
            className="flex flex-col"
          >
            <div className="flex items-center gap-2 border-b border-border px-3">
              <SearchIcon
                size={14}
                className="shrink-0 text-muted-foreground"
                aria-hidden
              />
              <Command.Input
                value={query}
                onValueChange={setQuery}
                placeholder={t("search.placeholder")}
                className="h-11 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                autoFocus
              />
            </div>
            <Command.List className="max-h-[60vh] overflow-y-auto p-2">
              {query.trim().length < 2 ? (
                <div className="px-3 py-6 text-center text-xs text-muted-foreground">
                  {t("search.hint")}
                </div>
              ) : totalHits === 0 && !isFetching ? (
                <Command.Empty className="px-3 py-6 text-center text-xs text-muted-foreground">
                  {t("search.noResults")}
                </Command.Empty>
              ) : (
                KIND_ORDER.map((kind) => {
                  const items = grouped[kind];
                  if (items.length === 0) return null;
                  return (
                    <Command.Group
                      key={kind}
                      heading={t(`search.groups.${kind}`)}
                      className="mb-1 text-xs text-muted-foreground [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5"
                    >
                      {items.map((hit) => (
                        <HitRow
                          key={`${hit.kind}:${hit.entityId}`}
                          hit={hit}
                          onSelect={() => selectHit(hit)}
                        />
                      ))}
                    </Command.Group>
                  );
                })
              )}
            </Command.List>
          </Command>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

function HitRow({ hit, onSelect }: { hit: SearchHit; onSelect: () => void }) {
  const { t } = useTranslation();
  const display =
    hit.title.trim().length > 0
      ? hit.title
      : t(`common.untitled${hit.kind === "comment" ? "" : ""}`);
  return (
    <Command.Item
      value={`${hit.kind}:${hit.entityId}`}
      onSelect={onSelect}
      className={cn(
        "flex cursor-pointer items-start gap-2 rounded-md px-2 py-1.5 text-sm",
        "data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground",
      )}
    >
      <span className="mt-0.5 shrink-0 text-muted-foreground">
        {KIND_ICON[hit.kind as Kind]}
      </span>
      <span className="min-w-0 flex-1">
        {hit.kind !== "comment" && (
          <span className="block truncate font-medium">{display}</span>
        )}
        {hit.snippet && (
          <span
            className={cn(
              "block truncate text-xs text-muted-foreground",
              "[&_mark]:bg-yellow-300/30 [&_mark]:text-foreground",
            )}
            dangerouslySetInnerHTML={{ __html: sanitizeSnippet(hit.snippet) }}
          />
        )}
      </span>
    </Command.Item>
  );
}

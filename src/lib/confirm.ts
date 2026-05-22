import { useTranslation } from "react-i18next";
import { create } from "zustand";

export type ConfirmVariant = "default" | "destructive";

export interface ConfirmOptions {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: ConfirmVariant;
}

interface ConfirmState {
  open: boolean;
  options: ConfirmOptions | null;
  resolve: ((value: boolean) => void) | null;
  ask: (options: ConfirmOptions) => Promise<boolean>;
  respond: (value: boolean) => void;
}

export const useConfirmStore = create<ConfirmState>((set, get) => ({
  open: false,
  options: null,
  resolve: null,
  ask: (options) =>
    new Promise<boolean>((resolve) => {
      // Cancel any in-flight prompt before replacing it, so its caller's
      // awaiting promise resolves (with `false`) instead of dangling forever.
      const previous = get().resolve;
      previous?.(false);
      set({ open: true, options, resolve });
    }),
  respond: (value) => {
    const resolve = get().resolve;
    set({ open: false, options: null, resolve: null });
    resolve?.(value);
  },
}));

/**
 * Imperative confirmation prompt. Returns a promise that resolves to `true`
 * when the user confirms and `false` on cancel / Escape / dismiss. The host
 * (`<ConfirmDialogHost />`) must be mounted in the tree for the prompt to
 * render — see `src/routes/__root.tsx`.
 */
export function requestConfirm(options: ConfirmOptions): Promise<boolean> {
  return useConfirmStore.getState().ask(options);
}

export type DeletableKind =
  | "project"
  | "story"
  | "task"
  | "subtask"
  | "note"
  | "comment";

/**
 * Convenience hook for delete confirmations: wraps `requestConfirm` with the
 * translated strings for a known entity kind. Use as
 * `if (!(await confirmDelete("project"))) return;` before the mutation.
 */
export function useConfirmDelete() {
  const { t } = useTranslation();
  return (kind: DeletableKind): Promise<boolean> =>
    requestConfirm({
      title: t(`confirm.delete.${kind}.title`),
      message: t(`confirm.delete.${kind}.message`),
      confirmLabel: t("confirm.delete.confirm"),
      cancelLabel: t("common.cancel"),
      variant: "destructive",
    });
}

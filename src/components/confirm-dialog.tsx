import { useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useConfirmStore } from "@/lib/confirm";

/**
 * Renders the confirmation dialog when `requestConfirm` is pending. Mount
 * once at the app root. Cancel is autofocused so Enter dismisses instead of
 * confirming — important for destructive prompts.
 */
export function ConfirmDialogHost() {
  const open = useConfirmStore((s) => s.open);
  const options = useConfirmStore((s) => s.options);
  const respond = useConfirmStore((s) => s.respond);

  const cancelRef = useRef<HTMLButtonElement>(null);

  // Radix's default autofocus picks the first focusable child (which would
  // be the close X). Pull focus to Cancel once the content mounts.
  useEffect(() => {
    if (open) {
      const id = window.setTimeout(() => cancelRef.current?.focus(), 0);
      return () => window.clearTimeout(id);
    }
  }, [open]);

  if (!options) return null;

  return (
    <Dialog open={open} onOpenChange={(next) => !next && respond(false)}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{options.title}</DialogTitle>
          {options.message && (
            <DialogDescription>{options.message}</DialogDescription>
          )}
        </DialogHeader>
        <DialogFooter>
          <Button
            ref={cancelRef}
            type="button"
            variant="outline"
            onClick={() => respond(false)}
          >
            {options.cancelLabel ?? "Cancel"}
          </Button>
          <Button
            type="button"
            variant={options.variant === "destructive" ? "destructive" : "default"}
            onClick={() => respond(true)}
          >
            {options.confirmLabel ?? "Confirm"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

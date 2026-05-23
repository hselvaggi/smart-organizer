import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { api } from "@/lib/tauri";
import type { PairingInit } from "@/types/generated";

const POLL_INTERVAL_MS = 1000;

type Phase =
  | { kind: "starting" }
  | { kind: "waiting"; init: PairingInit }
  | { kind: "rejected" }
  | { kind: "expired" }
  | { kind: "error"; message: string };

/**
 * Initiator-side pairing dialog. Drives the full flow:
 *   1. POST /pair/initiate on the peer (via Tauri command).
 *   2. Show the returned 4-digit code; ask the user to verify it matches
 *      the one on the peer's screen.
 *   3. Poll until the peer's user accepts/rejects or the session expires.
 *   4. On accept, call `onPaired(token)` so the parent autofills the
 *      Sync section's bearer field.
 */
export function PairingInitiator({
  url,
  open,
  onClose,
  onPaired,
}: {
  url: string;
  open: boolean;
  onClose: () => void;
  onPaired: (token: string) => void;
}) {
  const { t } = useTranslation();
  const [phase, setPhase] = useState<Phase>({ kind: "starting" });
  // Sticky session id across polls — we don't want the effect to re-run
  // every render and create a fresh session each time.
  const cancelledRef = useRef(false);

  useEffect(() => {
    if (!open) return;
    cancelledRef.current = false;
    setPhase({ kind: "starting" });

    let pollTimer: ReturnType<typeof setTimeout> | null = null;

    const run = async () => {
      let init: PairingInit;
      try {
        init = await api.pairing.start(url);
      } catch (e) {
        if (cancelledRef.current) return;
        setPhase({
          kind: "error",
          message: String((e as Error)?.message ?? e),
        });
        return;
      }
      if (cancelledRef.current) return;
      setPhase({ kind: "waiting", init });

      const poll = async () => {
        if (cancelledRef.current) return;
        try {
          const r = await api.pairing.poll(url, init.sessionId);
          if (cancelledRef.current) return;
          if (r.status === "accepted" && r.token) {
            onPaired(r.token);
            return;
          }
          if (r.status === "rejected") {
            setPhase({ kind: "rejected" });
            return;
          }
          if (r.status === "expired") {
            setPhase({ kind: "expired" });
            return;
          }
          pollTimer = setTimeout(poll, POLL_INTERVAL_MS);
        } catch (e) {
          if (cancelledRef.current) return;
          setPhase({
            kind: "error",
            message: String((e as Error)?.message ?? e),
          });
        }
      };
      pollTimer = setTimeout(poll, POLL_INTERVAL_MS);
    };

    void run();

    return () => {
      cancelledRef.current = true;
      if (pollTimer) clearTimeout(pollTimer);
    };
  }, [open, url, onPaired]);

  return (
    <Dialog open={open} onOpenChange={(o) => (!o ? onClose() : undefined)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("pairing.initiator.title")}</DialogTitle>
        </DialogHeader>

        {phase.kind === "starting" && (
          <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
            <Loader2 className="animate-spin" size={16} />
            {t("pairing.initiator.starting")}
          </div>
        )}

        {phase.kind === "waiting" && (
          <div className="flex flex-col gap-4 py-2">
            <p className="text-sm text-muted-foreground">
              {t("pairing.initiator.verifyCode")}
            </p>
            <div
              className="self-center font-mono text-5xl font-semibold tracking-[0.4em] tabular-nums"
              aria-label={t("pairing.initiator.codeAria")}
            >
              {phase.init.code}
            </div>
            <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="animate-spin" size={12} />
              {t("pairing.initiator.waiting")}
            </div>
          </div>
        )}

        {phase.kind === "rejected" && (
          <p className="py-4 text-sm text-destructive">
            {t("pairing.initiator.rejected")}
          </p>
        )}

        {phase.kind === "expired" && (
          <p className="py-4 text-sm text-muted-foreground">
            {t("pairing.initiator.expired")}
          </p>
        )}

        {phase.kind === "error" && (
          <p className="py-4 text-sm text-destructive">
            {t("pairing.initiator.error")}: {phase.message}
          </p>
        )}

        <div className="flex justify-end">
          <Button type="button" variant="ghost" onClick={onClose}>
            <X />
            {t("common.cancel")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

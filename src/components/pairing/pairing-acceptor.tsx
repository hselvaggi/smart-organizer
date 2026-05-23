import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { listen } from "@tauri-apps/api/event";
import { Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { api } from "@/lib/tauri";
import type { PairingSession } from "@/types/generated";

/**
 * Responder-side global listener. Mount once near the root; it subscribes
 * to the `pairing-requested` Tauri event and pops up an accept/reject
 * dialog with the 4-digit code when a peer wants to pair.
 *
 * Race notes:
 *  - If two requests arrive in quick succession the second replaces the
 *    first (the first session is still in `list_pending_pairings` but no
 *    longer has a modal).
 *  - Once the user accepts/rejects, the dialog closes; if more pending
 *    sessions exist on the backend they are not auto-displayed. The
 *    requesting peer's poll will time out at the 2-minute TTL.
 */
export function PairingAcceptor() {
  const { t } = useTranslation();
  const [request, setRequest] = useState<PairingSession | null>(null);

  useEffect(() => {
    const unlistenPromise = listen<PairingSession>(
      "pairing-requested",
      (event) => setRequest(event.payload),
    );
    return () => {
      void unlistenPromise.then((fn) => fn());
    };
  }, []);

  const handleAccept = async () => {
    if (!request) return;
    try {
      await api.pairing.accept(request.sessionId);
    } finally {
      setRequest(null);
    }
  };

  const handleReject = async () => {
    if (!request) return;
    try {
      await api.pairing.reject(request.sessionId);
    } finally {
      setRequest(null);
    }
  };

  if (!request) return null;

  return (
    <Dialog open onOpenChange={(o) => (!o ? setRequest(null) : undefined)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("pairing.acceptor.title")}</DialogTitle>
          <DialogDescription>
            {t("pairing.acceptor.subtitle", { device: request.requester })}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center gap-2 py-2">
          <span className="text-xs uppercase tracking-wide text-muted-foreground">
            {t("pairing.acceptor.codeLabel")}
          </span>
          <div
            className="font-mono text-5xl font-semibold tracking-[0.4em] tabular-nums"
            aria-label={t("pairing.acceptor.codeAria")}
          >
            {request.code}
          </div>
          <p className="text-center text-xs text-muted-foreground">
            {t("pairing.acceptor.verifyHint")}
          </p>
        </div>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={handleReject}>
            <X />
            {t("pairing.acceptor.reject")}
          </Button>
          <Button type="button" onClick={handleAccept}>
            <Check />
            {t("pairing.acceptor.accept")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

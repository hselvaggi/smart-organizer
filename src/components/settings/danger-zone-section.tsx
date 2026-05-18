import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { AlertTriangle, Check, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { api } from "@/lib/tauri";

export function DangerZoneSection() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [done, setDone] = useState(false);

  const reset = useMutation({
    mutationFn: api.system.reset,
    onSuccess: () => {
      qc.clear();
      setDone(true);
      setTimeout(() => {
        setOpen(false);
        setDone(false);
        setConfirmation("");
        navigate({ to: "/" });
      }, 1200);
    },
  });

  const canConfirm = confirmation === "RESET" && !reset.isPending;

  return (
    <section className="flex max-w-2xl flex-col gap-3 rounded-md border border-destructive/40 bg-destructive/5 p-4">
      <header className="flex items-center gap-2">
        <AlertTriangle size={16} className="text-destructive" />
        <h3 className="text-sm font-semibold">
          {t("settings.dangerZone.heading")}
        </h3>
      </header>
      <p className="text-xs text-muted-foreground">
        {t("settings.dangerZone.description")}
      </p>
      <div>
        <Button
          type="button"
          variant="destructive"
          onClick={() => setOpen(true)}
        >
          <Trash2 />
          {t("settings.dangerZone.resetButton")}
        </Button>
      </div>

      <Dialog open={open} onOpenChange={(o) => !reset.isPending && setOpen(o)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle size={16} className="text-destructive" />
              {t("settings.dangerZone.dialogTitle")}
            </DialogTitle>
            <DialogDescription>
              {t("settings.dangerZone.dialogDescription", {
                token: "RESET",
              })}
            </DialogDescription>
          </DialogHeader>

          {done ? (
            <div className="flex items-center gap-2 rounded-md border border-emerald-500/40 bg-emerald-500/10 p-3 text-sm text-emerald-300">
              <Check size={16} />
              {t("settings.dangerZone.done")}
            </div>
          ) : (
            <>
              <Input
                value={confirmation}
                onChange={(e) => setConfirmation(e.target.value)}
                placeholder={t("settings.dangerZone.confirmPlaceholder")}
                autoFocus
                disabled={reset.isPending}
              />
              {reset.error && (
                <p className="text-xs text-destructive">
                  {t("settings.dangerZone.failed")}: {String(reset.error)}
                </p>
              )}
            </>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setOpen(false)}
              disabled={reset.isPending}
            >
              {t("common.cancel")}
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => reset.mutate()}
              disabled={!canConfirm || done}
            >
              <Trash2 />
              {reset.isPending
                ? t("settings.dangerZone.wiping")
                : t("settings.dangerZone.confirmButton")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}

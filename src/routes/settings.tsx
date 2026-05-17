import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  return (
    <div className="p-8">
      <h2 className="text-lg font-semibold">Settings</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Device identity, paired peers and preferences will live here.
      </p>
    </div>
  );
}

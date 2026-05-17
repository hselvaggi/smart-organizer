import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/system-check")({
  component: SystemCheck,
});

function SystemCheck() {
  return (
    <div className="p-8">
      <h2 className="text-lg font-semibold">System check</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Detection of optional external tools (pdflatex, pandoc, graphviz...) will appear here.
      </p>
    </div>
  );
}

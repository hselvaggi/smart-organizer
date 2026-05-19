import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ListSectionProps<T> {
  title: string;
  addLabel: string;
  onAdd: () => void;
  items: T[];
  emptyLabel: string;
  renderItem: (item: T) => React.ReactNode;
}

export function ListSection<T>({
  title,
  addLabel,
  onAdd,
  items,
  emptyLabel,
  renderItem,
}: ListSectionProps<T>) {
  return (
    <section className="flex flex-col gap-2 border-t border-border pt-4">
      <header className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">{title}</h3>
        <Button type="button" size="sm" variant="outline" onClick={onAdd}>
          <Plus />
          {addLabel}
        </Button>
      </header>

      {items.length === 0 ? (
        <p className="rounded-md border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
          {emptyLabel}
        </p>
      ) : (
        <ul className="flex flex-col gap-1">{items.map(renderItem)}</ul>
      )}
    </section>
  );
}

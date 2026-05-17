import { Fragment } from "react";
import { Link, type LinkProps } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";

export type BreadcrumbItem = {
  label: string;
  to?: LinkProps["to"];
  params?: Record<string, string>;
};

export function Breadcrumb({ items }: { items: BreadcrumbItem[] }) {
  return (
    <nav className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
      {items.map((item, i) => {
        const isLast = i === items.length - 1;
        return (
          <Fragment key={i}>
            {i > 0 && <ChevronRight size={12} className="opacity-60" />}
            {isLast || !item.to ? (
              <span className="text-foreground font-medium">{item.label}</span>
            ) : (
              <Link
                to={item.to}
                params={item.params as never}
                className="rounded px-1 transition-colors hover:bg-muted hover:text-foreground"
              >
                {item.label}
              </Link>
            )}
          </Fragment>
        );
      })}
    </nav>
  );
}

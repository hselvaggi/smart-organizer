import { useEffect, useState } from "react";

export type Theme =
  | "system"
  | "light"
  | "sepia"
  | "dim"
  | "contrast"
  | "dark";
export type ResolvedTheme = Exclude<Theme, "system">;

export const THEMES: readonly Theme[] = [
  "system",
  "light",
  "sepia",
  "dim",
  "contrast",
  "dark",
] as const;

const STORAGE_KEY = "tasks-theme";
const DEFAULT_THEME: Theme = "system";

let cached: Theme | null = null;
const listeners = new Set<(t: Theme) => void>();

function read(): Theme {
  if (cached !== null) return cached;
  if (typeof localStorage === "undefined") {
    cached = DEFAULT_THEME;
    return cached;
  }
  const stored = localStorage.getItem(STORAGE_KEY);
  cached =
    stored && (THEMES as readonly string[]).includes(stored)
      ? (stored as Theme)
      : DEFAULT_THEME;
  return cached;
}

function write(t: Theme) {
  cached = t;
  if (typeof localStorage !== "undefined") {
    localStorage.setItem(STORAGE_KEY, t);
  }
  applyTheme(t);
  listeners.forEach((l) => l(t));
}

function systemPrefersDark(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-color-scheme: dark)").matches === true
  );
}

export function resolveTheme(t: Theme): ResolvedTheme {
  return t === "system" ? (systemPrefersDark() ? "dark" : "light") : t;
}

export function applyTheme(t: Theme): void {
  if (typeof document === "undefined") return;
  const resolved = resolveTheme(t);
  const html = document.documentElement;
  html.classList.remove("sepia", "dim", "contrast", "dark");
  if (resolved !== "light") html.classList.add(resolved);
}

// React to OS-level theme changes while "system" is selected.
if (typeof window !== "undefined" && window.matchMedia) {
  window
    .matchMedia("(prefers-color-scheme: dark)")
    .addEventListener("change", () => {
      if (read() === "system") applyTheme("system");
    });
}

// Converge with the inline boot script in index.html — that script applied a
// best-guess class before paint; this re-asserts it from the same source.
applyTheme(read());

export function useTheme(): [Theme, (t: Theme) => void] {
  const [value, setValue] = useState<Theme>(read);
  useEffect(() => {
    const listener = (t: Theme) => setValue(t);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);
  return [value, write];
}

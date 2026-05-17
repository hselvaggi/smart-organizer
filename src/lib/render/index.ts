import { renderMarkdown } from "./markdown";
import { renderLatex } from "./latex";
import { renderHtml } from "./html";
import type { TextFormat } from "@/types/generated";

function escapePlain(s: string): string {
  const escaped = s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return `<div class="whitespace-pre-wrap break-words">${escaped}</div>`;
}

export function renderField(value: string, format: TextFormat): string {
  if (!value.trim()) return "";
  switch (format) {
    case "markdown":
      return renderMarkdown(value);
    case "latex":
      return renderLatex(value);
    case "html":
      return renderHtml(value);
    case "plaintext":
      return escapePlain(value);
  }
}

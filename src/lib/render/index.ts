import { renderMarkdown } from "./markdown";
import { renderLatex } from "./latex";
import { renderHtml } from "./html";
import type { TextFormat } from "@/types/generated";

function escapePlain(s: string): string {
  const escaped = s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return `<pre class="whitespace-pre-wrap break-words font-sans text-sm leading-relaxed">${escaped}</pre>`;
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

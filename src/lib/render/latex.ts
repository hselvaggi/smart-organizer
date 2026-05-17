import katex from "katex";

const DISPLAY_BLOCK_RE = /\\\[([\s\S]+?)\\\]/g;
const INLINE_DOLLAR_RE = /(?<!\$)\$(?!\$)([^\n$]+?)(?<!\$)\$(?!\$)/g;
const DISPLAY_DOLLAR_RE = /\$\$([\s\S]+?)\$\$/g;

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function render(expr: string, displayMode: boolean): string {
  try {
    return katex.renderToString(expr, {
      displayMode,
      throwOnError: false,
      output: "html",
    });
  } catch {
    return `<code>${escapeHtml(expr)}</code>`;
  }
}

export function renderLatex(source: string): string {
  let html = escapeHtml(source);
  html = html.replace(/\n\n+/g, "</p><p>");
  html = `<p>${html}</p>`;

  // Order matters: do display modes first to avoid inline picking up $$...$$
  html = html.replace(DISPLAY_DOLLAR_RE, (_, expr) => render(expr, true));
  html = html.replace(DISPLAY_BLOCK_RE, (_, expr) => render(expr, true));
  html = html.replace(INLINE_DOLLAR_RE, (_, expr) => render(expr, false));

  return html;
}

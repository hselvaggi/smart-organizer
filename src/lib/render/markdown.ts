import MarkdownIt from "markdown-it";
import katex from "@vscode/markdown-it-katex";
import taskLists from "markdown-it-task-lists";
import DOMPurify from "dompurify";

const md = new MarkdownIt({
  html: false,
  linkify: true,
  breaks: false,
  typographer: true,
})
  .use(katex, { throwOnError: false, errorColor: "hsl(var(--destructive))" })
  .use(taskLists, { enabled: false });

export function renderMarkdown(source: string): string {
  const html = md.render(source);
  return DOMPurify.sanitize(html, {
    ADD_ATTR: ["target", "rel"],
  });
}

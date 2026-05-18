# Organizer

A simple desktop tool that helps organize tasks, projects and keeps track of
things with notes. Local-first, single-user, with an opt-in MCP server so AI
agents can read and update your data.

## Stack

Tauri 2 · Rust · React · TypeScript · SQLite · TanStack Router · Tailwind ·
CodeMirror · KaTeX · @dnd-kit · Axum (MCP server)

## Hierarchy

```
Project ─┬─ Notes
         └─ Story ─┬─ Task ─┬─ Subtask (recursive)
                  │        └─ Comments
                  └─ ...

Notes (standalone)
```

Every node (project, story, task, subtask, note) is its own page with its own
URL. Stories and tasks have a status (todo/in_progress/done/blocked/cancelled),
a `started_at`/`completed_at` timeline that auto-fills on status transitions,
and an optional `due_date` that drives a coloured border on cards.

## Features

- Hierarchical project / story / task / subtask tree with breadcrumb navigation
- Rich text descriptions with read-by-default preview and a per-field
  Markdown / Plaintext / HTML / LaTeX editor with split view
- Kanban board per project with drag-and-drop status updates
- Notes attached to a project or fully standalone
- Comments on tasks
- System tray icon with a Show / Quit menu; close minimises to tray
- Configurable deadline warning window (yellow band size)
- Optional MCP server (off / read-only / full) exposing 24 tools over
  `http://127.0.0.1:3737/mcp`
- System capability probe page (`pdflatex`, `pandoc`, `dot`, `mmdc`, …)

## Development

Requirements: Rust ≥ 1.77, Node ≥ 20, pnpm.

```bash
pnpm install
pnpm tauri:dev
```

To regenerate the TypeScript types after editing the Rust domain structs:

```bash
pnpm types
```

## Build

```bash
pnpm tauri:build
```

Bundles AppImage / `.deb` on Linux, DMG on macOS, NSIS on Windows.

## License

Released under the **PolyForm Noncommercial License 1.0.0** — see
[`LICENSE`](./LICENSE). Personal, hobby, educational and other
noncommercial use is free. Any commercial use (selling, embedding in a
product or service, internal use within a for-profit organization, etc.)
requires a separate license.

For commercial licensing inquiries, contact **Harold Selvaggi** at
[harold.selvaggi@gmail.com](mailto:harold.selvaggi@gmail.com).

# Split Gantt Library from Demo Code

> **Superseded paths:** This document predates a later `src/`/`demo/` restructuring (commit `c83a41f`) that moved the `js/gantt/*.js` layout produced by this spec to `src/*.js`, and `js/main.js`/`index.html` to `demo/main.js`/`demo/index.html`. `css/style.css` (untouched by this spec) now lives at `src/style.css`.

## Motivation

`js/main.js` currently holds everything: the reusable library classes
(`DateHelper`, `GuidHelper`, `Modal`, `Task`, `AnimationController`,
`GanttChart`) and the demo-specific code (sample task data, the
`DOMContentLoaded` bootstrap, and the `#event-log` wiring), all as
global-scope classes in one file. There's no boundary between "library" and
"the page that happens to use it," and no per-component file to look at in
isolation.

This is a pure structural refactor: split the library into one file per
component under `js/gantt/`, using real ES modules, and leave `js/main.js` as
the demo-only entry point. No behavior, CSS, or sample-data content changes.

## File layout

```
js/gantt/utils.js               — DateHelper, GuidHelper
js/gantt/modal.js                — Modal
js/gantt/task.js                 — Task
js/gantt/animation-controller.js — AnimationController
js/gantt/gantt-chart.js          — GanttChart
js/gantt/index.js                — barrel: export { GanttChart } from './gantt-chart.js'
js/main.js                       — demo only: sample task data, bootstrap, event-log wiring
```

- `DateHelper` and `GuidHelper` share `utils.js` rather than getting one file
  each — they're small, stateless helpers, not components with their own
  behavior/state like `Task` or `GanttChart`.
- `js/gantt/index.js` is the library's single public entry point. `main.js`
  imports `{ GanttChart }` from it, not from `gantt-chart.js` directly, so
  internal file names can change later without touching the demo (or any
  future consumer).

## Module system

Real ES modules (`import`/`export`), not global-scope classes loaded via
ordered `<script>` tags. Vite (already the dev server here) supports this
natively with no config changes. Each file explicitly declares what it needs
— no implicit dependency on script tag order in `index.html`.

`index.html` changes in exactly one place:

```diff
- <script src='js/main.js'></script>
+ <script type='module' src='js/main.js'></script>
```

## Dependency graph

A clean DAG, no cycles:

- `gantt-chart.js` imports from `task.js`, `animation-controller.js`,
  `modal.js`, and `utils.js`.
- `task.js` imports `DateHelper` from `utils.js`.
- `animation-controller.js` imports `DateHelper` from `utils.js`.
- `modal.js` has no internal dependencies.
- `index.js` imports only from `gantt-chart.js`.
- `main.js` imports only `{ GanttChart }` from `gantt/index.js`.

## What doesn't change

- No behavior differences — this is a structural move only.
- `css/style.css` is untouched (already split out in an earlier commit).
- Sample task data content is untouched, just relocated into `main.js`
  alongside the bootstrap code that already used it.

## Forward compatibility note

The upcoming rollup/summary-bar feature
(`2026-07-27-rollup-summary-bar-design.md`) will add a new
`SummaryTask extends Task` class. Under this layout it lands naturally at
`js/gantt/summary-task.js`, importing `Task` from `./task.js` — no rework of
this split is needed to accommodate it.

## Testing / verification

No test framework exists in this project, so verification is manual, in the
browser, after the split:

- Page loads with no console errors (import paths resolve correctly).
- Add / edit / delete a task still works.
- Dragging and resizing a task bar still works.
- Dependency arrows still render correctly.
- Animation playback (play/pause/stop/next/prev) still works, and the
  `#event-log` still logs `task-active` events as before.

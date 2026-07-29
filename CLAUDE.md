# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm install     # install dependencies (vite is the only devDependency)
npm run dev     # start the Vite dev server, fixed at http://localhost:5174 (see vite.config.js)
```

There is no build, lint, or test script configured — `package.json` only defines `dev`. There is no test suite in this repo; verify UI changes by driving the dev server in a browser (e.g. Playwright) rather than assuming type-checking or tests would catch a regression.

When using Playwright MCP tools (`browser_click`, `browser_hover`, `browser_drag`, etc.), the element parameter is `target` (the ref string from `browser_snapshot`, e.g. `"e14"`) — not `ref`.

Default to asking the user to run `npm run dev` themselves and working against the instance they start, rather than starting it yourself in the background. This machine has previously hit `EPERM` errors binding to port 5174 (both in-sandbox and in the user's own shell) that were traced to a host-level setting, not a Vite/sandbox limitation — if that recurs, it's worth diagnosing rather than assuming the dev server can't be started programmatically. A project PreToolUse hook also restricts Playwright navigation to `http://localhost:5174/`.

## Architecture

Vanilla ES modules, no framework. The library source lives in `src/`; the sample app lives in `demo/` and is the Vite dev-server root (`vite.config.js` sets `root: 'demo'`). `demo/index.html` loads `demo/main.js` as a `<script type="module">`, which imports `GanttChart` from `../src/index.js` (the only public export) and instantiates it against sample data.

Any new asset outside `demo/` (CSS, images, etc.) must be referenced via a JS `import` in `main.js`, not a plain HTML `<link>`/`<script src>` — Vite only auto-resolves cross-root paths for JS imports; an HTML tag pointing outside `root` silently falls back to serving `index.html` (200 OK, wrong content, no error).

### Render model: full rebuild, not incremental

`GanttChart` (`src/gantt-chart.js`) keeps `rawTasks` (plain data objects) as the source of truth. Every mutation (`updateTask`, `deleteTask`, `addTask`/`editTask` via the modal, drag-and-drop reparenting) ends by calling `this.render()`, which tears down and rebuilds the entire DOM subtree from scratch — there is no diffing or patching. `render()`'s pipeline:

1. `calculateDateRange()` — derives `chartStartDate`/`chartEndDate` from the min/max task dates, padded 5 days before / 10 days after.
2. `createLayout()` — rebuilds the static chrome (sidebar, grid, header, SVG dependency layer) into a fresh `.gantt-chart-root` container.
3. `renderTimeline()` — builds the year/month/day header rows.
4. Derive `summaryIds` — the `Set` of task ids that appear as *someone else's* `parentId`. This is recomputed every render, never stored as a flag on the task data.
5. Instantiate a `SummaryTask` for every id in `summaryIds`, otherwise a plain `Task`; call `recomputeFromChildren()` on each summary task.
6. `task.render(index, visible)` per task, where `visible` comes from `isHiddenTask()` (see collapse/expand below).
7. `renderUnparentDropZone()`, `renderGridLines()`, `renderDependencies()`, then re-render the `AnimationController`.

### Summary (rollup) tasks

A task becomes a `SummaryTask` (`src/summary-task.js`) purely by being referenced as another task's `parentId` — there's no explicit "is summary" field. `SummaryTask.recomputeFromChildren()` derives `start`/`end` as the min/max of its children's dates and `progress` as a duration-weighted average, recomputed on every render. Nesting is single-level only: `canReparent()` in `gantt-chart.js` refuses to make a summary task a child of anything, and refuses to give a child to a task that already has a parent. `SummaryTask` overrides bar rendering (adds `.summary-bar`, disables per-bar drag via a no-op `addDragListeners()`, supplies the collapse/expand chevron via `getSidebarPrefixElement()`) and no-ops the animation-progress hooks, since rollups don't participate in the play/pause timeline animation or the `task-active` event.

### Collapse/expand and drag-and-drop reparenting

`collapsedIds` (a `Set` of parent task ids) drives `isHiddenTask()`. Hidden tasks are still instantiated and given a `render(index, visible=false)` call — so their bar geometry (`left`/`width`/`y`) exists for dependency-arrow routing — but their DOM elements are never appended to the sidebar/task area.

Sidebar rows are native HTML5 `draggable` elements; `gantt.dragState` tracks the currently-dragged task id. Drop handlers (on other sidebar rows, and on the "drop here to remove from phase" strip rendered by `renderUnparentDropZone()`) call `canReparent(draggedId, targetId)` before calling `updateTask(draggedId, { parentId: targetId })`. This is a separate drag mechanism from bar dragging: task bars are moved/resized via manual `mousedown`/`mousemove`/`mouseup` listeners in `Task.addDragListeners()`, not native DnD.

### Dependency arrows

Rendered as SVG paths into `svg#dependency-layer`. Arrows between a task and its own parent/child are suppressed (`renderDependencies()` skips when `p.id === t.parentId || t.id === p.parentId`), and dependencies where either endpoint is currently hidden (collapsed) are skipped too. When the successor bar starts too close to the predecessor's end for a plain elbow, the path detours through a nearby row gap instead of cutting through a bar/label.

### Styling scope

CSS custom properties (`--primary-color`, `--border-color`, etc.) and shared rules (`font-family`, `user-select: none`) live under `.gantt-chart-root` — the class applied to the chart's own root element — rather than `:root`/`body`. The stylesheet (`src/style.css`) is meant to be embeddable alongside other page content without leaking global styles onto the host page. For the same reason, the add/edit-task modal (`src/modal.js`) mounts inside `.gantt-chart-root` (passed explicitly by the caller) rather than `document.body`.

`package.json` (`main`/`module` → `src/index.js`, `files` whitelist) is set up for npm/unpkg distribution as ESM — `style.css` is intentionally never bundled into the JS entry; consumers always load it separately via `<link>`, since a plain `<script type="module">` in a browser can't `import` `.css` without a bundler.

### Public API

```js
import { GanttChart } from './src/index.js';
new GanttChart(containerId, tasks, options);
```

- `tasks`: array of `{ id?, name, start, end, progress, dependencies: [ids], parentId? }`. Missing `id` is auto-generated (`GuidHelper.generateGuid()`); a task becomes a summary/rollup row automatically if any other task's `parentId` points at it.
- `options`: `{ dayWidth = 30, rowHeight = 32 }`.
- Events: `chart.addEventListener('task-active', ({ task, currentTime, ganttChart }) => {})`, fired during animation playback for whichever non-summary task `currentTime` falls inside.

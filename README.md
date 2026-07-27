# gantt.js

A dependency-free vanilla JavaScript Gantt chart library. Renders an interactive project timeline with a sidebar task list and a scrollable chart grid, driven by plain task objects — no framework required.

## Features

- Draggable task bars with live start/end date and progress updates
- Task dependency arrows, with automatic date-shifting when a dependency moves
- Summary (rollup) tasks: a parent bar spans and reflects the duration/progress of its children
- Collapse/expand summary rows, with drag-and-drop re-parenting in the sidebar
- Animated "today" progress line and a `task-active` event for building external listeners (e.g. an activity log)
- Add/edit/delete tasks through a built-in modal

## Getting started

```bash
npm install
npm run dev
```

Then open the URL Vite prints (defaults to `http://localhost:5174/`).

## Usage

```js
import { GanttChart } from './src/index.js';

const tasks = [
  { id: '1', name: 'Design', start: '2026-08-01', end: '2026-08-07', progress: 100, dependencies: [] },
  { id: '2', name: 'Build', start: '2026-08-08', end: '2026-08-20', progress: 30, dependencies: ['1'] },
];

const chart = new GanttChart('app-container', tasks, { dayWidth: 30, rowHeight: 32 });

chart.addEventListener('task-active', ({ task, currentTime }) => {
  console.log('Active task:', task.name, currentTime);
});
```

`GanttChart` takes a container element ID, an array of task objects (`id`, `name`, `start`, `end`, `progress`, `dependencies`, and an optional `parentId` for summary/child relationships), and an options object (`dayWidth`, `rowHeight`).

### Via CDN (no build step)

The library is plain ES modules, so it can be loaded directly from a CDN like [jsDelivr's GitHub CDN](https://www.jsdelivr.com/?docs=gh) — no npm publish and no bundler required, just a public GitHub repo:

```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/yiskang/gantt.js@v1.0.0/src/style.css">
<div id="app-container"></div>
<script type="module">
  import { GanttChart } from 'https://cdn.jsdelivr.net/gh/yiskang/gantt.js@v1.0.0/src/index.js';

  const chart = new GanttChart('app-container', [
    { id: '1', name: 'Design', start: '2026-08-01', end: '2026-08-07', progress: 100, dependencies: [] },
  ]);
</script>
```

Unlike npm-backed CDNs, jsDelivr's GitHub mode doesn't read `package.json`'s `main`/`module` fields — always link the full path (`src/index.js`, `src/style.css`). Pin a git tag (`@v1.0.0`) rather than `@main`, since jsDelivr caches branch references for a while and won't immediately reflect new commits. This only works if the GitHub repo is public — jsDelivr's GitHub mode fetches from `raw.githubusercontent.com`, which returns 401 for private repos.

## Project structure

```
src/                    library source
  index.js               public entry point (exports GanttChart)
  gantt-chart.js          core chart: rendering, drag/drop, events
  task.js                 Task model + row/bar rendering
  summary-task.js         SummaryTask (rollup) model
  animation-controller.js "today" progress-line animation
  modal.js                add/edit task modal
  utils.js                date and GUID helpers
  style.css               chart styling
demo/                   sample app (Vite root)
  index.html
  main.js                sample data + app bootstrap
```

## License

MIT License — see [`LICENSE`](./LICENSE).

## Written By

Eason Kang [in/eason-kang-b4398492](https://www.linkedin.com/in/eason-kang-b4398492)
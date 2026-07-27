# Rollup / Summary Bar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the summary/rollup task type from `docs/superpowers/specs/2026-07-27-rollup-summary-bar-design.md` — a task whose start/end/progress are derived from its `parentId`-linked children, rendered as a distinct bracket bar, excluded from dependency arrows with its own children, collapsible in the sidebar, and re-parentable via drag-and-drop.

**Architecture:** A new `SummaryTask` class (`js/gantt/summary-task.js`) extends `Task`, overriding only what differs (rollup computation, bar CSS class, no-op drag/animation, sidebar chevron). `GanttChart` gains a derived `summaryIds` set (computed each render from `rawTasks[].parentId`), a persistent `collapsedIds` set, and a persistent `dragState` field, and its `render()`/`renderDependencies()`/`getTaskFormElement()`/`deleteTask()` methods are extended to use them. `Task.render()` gains a `visible` parameter and a `getSidebarPrefixElement()` hook so `SummaryTask` can suppress DOM attachment (collapse) and inject a chevron without duplicating the DOM-building code.

**Tech Stack:** Vanilla JS, ES modules, Vite dev server (`npm run dev`, configured for port 5174 in `vite.config.js` — confirm the actual URL Vite prints, since another process may already hold that port). No test framework; pure-logic pieces get a Node smoke test, everything DOM-dependent is verified manually via Playwright MCP tools against the running dev server.

**Dev server:** Several tasks below need the dev server running for Playwright verification. **Ask the user to start it themselves** (`npm run dev` in a terminal) before those steps — don't start it in the background yourself. If it's already running, ask them to confirm the URL.

## Global Constraints

- Single-level nesting only — a phase directly containing leaf tasks, no phase-of-phases (spec: "Scope").
- A task is a summary *iff* some other task's `parentId` references it — this is derived (`summaryIds`), never a stored flag (spec: "§1 Data model").
- `dependencies` (sequencing) and `parentId` (hierarchy) are orthogonal — a task can have both, independently (spec: "§1 Data model").
- `SummaryTask` reuses `Task.render()`'s DOM-building code — no new element types, only an added CSS class, hidden/no-op handles, and CSS-only label repositioning (spec: "§3 Rendering").
- No "create summary" flow — a task becomes a summary purely by another task pointing `parentId` at it, via the edit modal's Parent field or sidebar drag-and-drop (spec: "§4 Interaction & CRUD").
- Default collapse state is expanded, matching current first-load behavior (spec: "§5 Collapse/expand").
- Drag-and-drop re-parenting single-level invariant: a drop is valid only if the dragged task currently has no children of its own AND the target currently has no `parentId` (spec: "§6 Drag-and-drop").
- No test framework exists in this project; verification is manual (spec: "§9 Testing / verification").

## File Structure

- **Create** `js/gantt/summary-task.js` — `SummaryTask extends Task`: rollup computation, `summary-bar` CSS class, sidebar chevron, no-op drag/animation overrides. Built incrementally across Tasks 1, 3, 4, 5, 8.
- **Modify** `js/gantt/gantt-chart.js` — `summaryIds`/`collapsedIds`/`dragState` state, 3-step render pipeline, collapse-aware row rendering, dependency guard rails, Parent form field, delete cleanup, un-parent drop zone, animation exclusion. Touched in Tasks 2, 4, 5, 6, 7, 8.
- **Modify** `js/gantt/task.js` — `render()` gains a `visible` param and a `getSidebarPrefixElement()` hook; sidebar rows become draggable. Touched in Tasks 5 and 7.
- **Modify** `js/main.js` — sample data gains `parentId` on "Backend Development" and "Frontend Development", the real test case from the spec. Touched in Task 2.
- **Modify** `css/style.css` — summary bar shape, chevron, drag-highlight, drop-zone strip. Touched in Tasks 3, 5, 7.

---

### Task 1: `SummaryTask` core — rollup computation

**Files:**
- Create: `js/gantt/summary-task.js`

**Interfaces:**
- Consumes: `Task` from `./task.js`, `DateHelper` from `./utils.js`.
- Produces: `SummaryTask extends Task` with `recomputeFromChildren(allTasks)` — a named export, used by `gantt-chart.js` in Task 2.

- [ ] **Step 1: Create the file**

```js
// js/gantt/summary-task.js
import { Task } from './task.js';
import { DateHelper } from './utils.js';

export class SummaryTask extends Task {
    recomputeFromChildren(allTasks) {
        const children = allTasks.filter(t => t.parentId === this.id);
        if (children.length === 0) return;

        this.start = children.reduce((earliest, c) => c.start < earliest ? c.start : earliest, children[0].start);
        this.end = children.reduce((latest, c) => c.end > latest ? c.end : latest, children[0].end);

        const totalDuration = children.reduce((sum, c) => sum + DateHelper.daysBetween(c.start, c.end), 0);
        this.progress = totalDuration === 0
            ? 0
            : children.reduce((sum, c) => sum + DateHelper.daysBetween(c.start, c.end) * c.progress, 0) / totalDuration;
    }
}
```

- [ ] **Step 2: Smoke-test it with plain Node (no DOM dependency — `Task`'s constructor never touches the DOM, only `render()` does)**

Run from the project root (`/Users/kangea/Documents/Workspace/Codes/gantt.js`):

```bash
TZ=UTC node --input-type=module -e "
import { SummaryTask } from './js/gantt/summary-task.js';
import { Task } from './js/gantt/task.js';

const backend = new Task(null, { id: 'b', name: 'Backend', start: '2025-08-25', end: '2025-09-15', progress: 40, parentId: 'p' });
const frontend = new Task(null, { id: 'f', name: 'Frontend', start: '2025-09-01', end: '2025-09-25', progress: 10, parentId: 'p' });
const phase = new SummaryTask(null, { id: 'p', name: 'Phase 3', start: '2025-08-25', end: '2025-10-01', progress: 0 });

phase.recomputeFromChildren([backend, frontend, phase]);

console.assert(phase.start.toISOString().startsWith('2025-08-25'), 'start should be earliest child start: ' + phase.start.toISOString());
console.assert(phase.end.toISOString().startsWith('2025-09-25'), 'end should be latest child end: ' + phase.end.toISOString());

// backend: 21 days at 40%, frontend: 24 days at 10% -> (21*40 + 24*10) / 45
const expectedProgress = (21 * 40 + 24 * 10) / 45;
console.assert(Math.abs(phase.progress - expectedProgress) < 0.001, 'weighted progress mismatch: ' + phase.progress);

const noChildren = new SummaryTask(null, { id: 'q', name: 'Lonely Phase', start: '2025-01-01', end: '2025-01-05', progress: 50 });
noChildren.recomputeFromChildren([noChildren]);
console.assert(noChildren.progress === 50, 'no-children fallback should leave own fields untouched: ' + noChildren.progress);

console.log('summary-task.js smoke test passed');
"
```

Expected output: `summary-task.js smoke test passed`, no `console.assert` failure messages printed above it.

- [ ] **Step 3: Commit**

```bash
git add js/gantt/summary-task.js
git commit -m "Add SummaryTask with duration-weighted rollup computation"
```

---

### Task 2: Wire the rollup pipeline into `GanttChart.render()`

**Files:**
- Modify: `js/gantt/gantt-chart.js:1-5` (imports), `js/gantt/gantt-chart.js:42-62` (`render()`)
- Modify: `js/main.js` (sample data)

**Interfaces:**
- Consumes: `SummaryTask` from `./summary-task.js` (Task 1).
- Produces: `GanttChart.summaryIds` (a `Set<string>` of task ids that currently have children, recomputed every `render()`), consumed by Tasks 4, 5, 6, 8.

- [ ] **Step 1: Import `SummaryTask`**

```diff
 // js/gantt/gantt-chart.js
 import { DateHelper, GuidHelper } from './utils.js';
 import { Task } from './task.js';
 import { AnimationController } from './animation-controller.js';
 import { Modal } from './modal.js';
+import { SummaryTask } from './summary-task.js';
```

- [ ] **Step 2: Replace the single-pass task loop in `render()` with the 3-step pipeline**

```diff
     render() {
         const scrollLeft = this.gridContainer ? this.gridContainer.scrollLeft : 0;

         this.appContainer.innerHTML = '';
         this.calculateDateRange();
         this.createLayout();
         this.renderTimeline();
         this.renderGridLines();

-        this.tasks = [];
-        this.rawTasks.forEach((taskData, index) => {
-            const task = new Task(this, taskData);
-            this.tasks.push(task);
-            task.render(index);
-        });
+        this.summaryIds = new Set(this.rawTasks.map(t => t.parentId).filter(Boolean));
+
+        this.tasks = this.rawTasks.map(taskData =>
+            this.summaryIds.has(taskData.id) ? new SummaryTask(this, taskData) : new Task(this, taskData)
+        );
+        this.tasks.forEach(task => {
+            if (task instanceof SummaryTask) task.recomputeFromChildren(this.tasks);
+        });
+        this.tasks.forEach((task, index) => task.render(index));

         this.renderDependencies();
         this.animationController = new AnimationController(this, this.animationControls);
         this.animationController.render();
         this.gridContainer.scrollLeft = scrollLeft;
     }
```

- [ ] **Step 3: Add `parentId` to the sample data's real test case**

```diff
-        { id: '550e8400-e29b-41d4-a716-446655440006', name: 'Backend Development', start: '2025-08-25', end: '2025-09-15', progress: 0, dependencies: ['550e8400-e29b-41d4-a716-446655440004'] },
-        { id: '550e8400-e29b-41d4-a716-446655440007', name: 'Frontend Development', start: '2025-09-01', end: '2025-09-25', progress: 0, dependencies: ['550e8400-e29b-41d4-a716-446655440006'] },
+        { id: '550e8400-e29b-41d4-a716-446655440006', name: 'Backend Development', start: '2025-08-25', end: '2025-09-15', progress: 0, dependencies: ['550e8400-e29b-41d4-a716-446655440004'], parentId: '550e8400-e29b-41d4-a716-446655440005' },
+        { id: '550e8400-e29b-41d4-a716-446655440007', name: 'Frontend Development', start: '2025-09-01', end: '2025-09-25', progress: 0, dependencies: ['550e8400-e29b-41d4-a716-446655440006'], parentId: '550e8400-e29b-41d4-a716-446655440005' },
```

- [ ] **Step 4: Verify via the dev server**

Ask the user to start the dev server if it isn't already running (`npm run dev`), then confirm the URL to navigate to. Using Playwright MCP:

1. `mcp__playwright__browser_navigate` to the dev server URL.
2. `mcp__playwright__browser_evaluate`:

```js
() => {
    const rows = [...document.querySelectorAll('.gantt-sidebar-row .task-name')];
    const phase3Index = rows.findIndex(r => r.textContent === 'Phase 3: Development');
    const bar = document.querySelectorAll('.gantt-task-bar')[phase3Index];
    return {
        left: bar.style.left,
        width: bar.style.width,
        progressWidth: bar.querySelector('.gantt-task-progress-actual').style.width
    };
}
```

Expected: `left: "870px"`, `width: "930px"`, `progressWidth: "0%"`. (`chartStartDate` is 2025-07-27 — 5 days before Phase 1's Aug 1 start; Backend starts Aug 25, which is 29 days later, `29 * 30 = 870`. Backend Aug 25 → Frontend end Sep 25 is 31 days, `31 * 30 = 930`. Both children have 0% progress in the sample data, so the weighted average is 0% — this doesn't exercise the weighting math, which Task 1's Node test already covers with non-zero values.) Before this change, width would have been `1110px` (Phase 3's own Aug 25 → Oct 1 span), so a `930px` result confirms the rollup is live. The bar looks identical to a normal task bar at this point — no visual distinction yet, that's Task 3.

- [ ] **Step 5: Commit**

```bash
git add js/gantt/gantt-chart.js js/main.js
git commit -m "Wire SummaryTask rollup into GanttChart.render()"
```

---

### Task 3: Summary bar visual styling

**Files:**
- Modify: `js/gantt/summary-task.js`
- Modify: `css/style.css` (insert after the `.gantt-task-handle-right` block, around line 318)

**Interfaces:**
- Consumes: `.summary-bar` CSS class (new).
- Produces: `SummaryTask.render(index)` override — a visually distinct bar. No new interfaces for later tasks.

- [ ] **Step 1: Add the `render()` override**

```diff
 // js/gantt/summary-task.js
 import { Task } from './task.js';
 import { DateHelper } from './utils.js';

 export class SummaryTask extends Task {
+    render(index) {
+        super.render(index);
+        this.barElement.classList.add('summary-bar');
+    }
+
     recomputeFromChildren(allTasks) {
```

- [ ] **Step 2: Add the CSS**

Insert after `css/style.css:318` (the closing `}` of `.gantt-task-handle-right`):

```css
.gantt-task-bar.summary-bar {
    top: 6px;
    height: 8px;
    background-color: #37474f;
    border: none;
    border-radius: 0;
}

.gantt-task-bar.summary-bar::before,
.gantt-task-bar.summary-bar::after {
    content: '';
    position: absolute;
    top: 100%;
    width: 0;
    height: 0;
    border-top: 6px solid #37474f;
}

.gantt-task-bar.summary-bar::before {
    left: 0;
    border-left: 6px solid transparent;
}

.gantt-task-bar.summary-bar::after {
    right: 0;
    border-right: 6px solid transparent;
}

.gantt-task-bar.summary-bar .gantt-task-progress-actual,
.gantt-task-bar.summary-bar .gantt-task-progress-animation {
    background-color: var(--primary-color);
}

.gantt-task-bar.summary-bar .gantt-task-label {
    top: 10px;
    transform: translateY(-50%);
    color: #37474f;
    font-weight: 600;
}

.gantt-task-bar.summary-bar .gantt-task-handle {
    display: none;
}
```

(`top: 10px; transform: translateY(-50%)` on the label: the bar itself is the label's positioning context, top-anchored at row-offset `6px`. Row center is at `16px` (half of the 32px `--row-height`), which in the bar's local coordinates is `16 - 6 = 10px`. `translateY(-50%)` then centers the label — regardless of its own height — around that point, landing it on the row's center rather than the 8px bar's center.)

- [ ] **Step 3: Verify via the dev server**

Ask the user to confirm the dev server is running, then using Playwright MCP:

1. `mcp__playwright__browser_navigate` to the dev server URL (or re-navigate if a session is already open — Vite HMR should have already applied the change).
2. `mcp__playwright__browser_evaluate`:

```js
() => {
    const rows = [...document.querySelectorAll('.gantt-sidebar-row .task-name')];
    const phase3Index = rows.findIndex(r => r.textContent === 'Phase 3: Development');
    const bar = document.querySelectorAll('.gantt-task-bar')[phase3Index];
    const style = getComputedStyle(bar);
    return { height: style.height, background: style.backgroundColor, handleDisplay: getComputedStyle(bar.querySelector('.gantt-task-handle-left')).display };
}
```

Expected: `height: "8px"`, `background` resolves to `rgb(55, 71, 79)` (i.e. `#37474f`), `handleDisplay: "none"`.

3. `mcp__playwright__browser_take_screenshot` and visually confirm: Phase 3's bar is a thin dark bracket shape with downward triangles at both ends, its label is readable and vertically centered on the full row (not clipped), and all other task bars are unchanged.

- [ ] **Step 4: Commit**

```bash
git add js/gantt/summary-task.js css/style.css
git commit -m "Style SummaryTask as a bracket-shaped bar"
```

---

### Task 4: Interaction & CRUD — no-op drag, Parent field, delete cleanup

**Files:**
- Modify: `js/gantt/summary-task.js`
- Modify: `js/gantt/gantt-chart.js` (`getTaskFormElement()`, `deleteTask()`)

**Interfaces:**
- Consumes: `this.summaryIds` (Task 2).
- Produces: `SummaryTask.addDragListeners()` no-op override; `getTaskFormElement()` gains a `parentId`-backed Parent field and hides Start/End Date for a task that is currently a summary. No new interfaces for later tasks — `addTask()`/`editTask()` need no changes, since `Modal.handleSave()` already collects every `input, select` in the form generically, so the new Parent field's value flows through `data.parentId` automatically.

- [ ] **Step 1: No-op drag on summary bars**

```diff
 export class SummaryTask extends Task {
     render(index) {
         super.render(index);
         this.barElement.classList.add('summary-bar');
     }

+    addDragListeners() {
+        // Summary bars are derived, not draggable/resizable.
+    }
+
     recomputeFromChildren(allTasks) {
```

- [ ] **Step 2: Add the Parent field and hide Start/End for a summary task**

In `getTaskFormElement(task = {})`, insert after the End Date field block (after `endGroup.appendChild(endInput);`) and before the Dependencies field block:

```diff
         endGroup.appendChild(endLabel);
         endGroup.appendChild(endInput);

+        // Parent field
+        const parentGroup = document.createElement('div');
+        parentGroup.className = 'form-group';
+
+        const parentLabel = document.createElement('label');
+        parentLabel.setAttribute('for', 'parentId');
+        parentLabel.textContent = 'Parent';
+
+        const parentSelect = document.createElement('select');
+        parentSelect.name = 'parentId';
+
+        const noneOption = document.createElement('option');
+        noneOption.value = '';
+        noneOption.textContent = 'None';
+        parentSelect.appendChild(noneOption);
+
+        this.rawTasks.filter(t => t.id !== task.id).forEach(t => {
+            const option = document.createElement('option');
+            option.value = t.id;
+            option.textContent = t.name;
+            option.selected = task.parentId === t.id;
+            parentSelect.appendChild(option);
+        });
+
+        parentGroup.appendChild(parentLabel);
+        parentGroup.appendChild(parentSelect);
+
+        const isSummary = this.summaryIds && this.summaryIds.has(task.id);
+        if (isSummary) {
+            startGroup.style.display = 'none';
+            endGroup.style.display = 'none';
+        }
+
         // Dependencies field
         const depsGroup = document.createElement('div');
```

And add `parentGroup` to the final assembly:

```diff
         // Assemble container
         container.appendChild(nameGroup);
         container.appendChild(startGroup);
         container.appendChild(endGroup);
+        container.appendChild(parentGroup);
         container.appendChild(depsGroup);

         return container;
```

(Hidden Start/End inputs still get read by `Modal.handleSave()` — harmless, since they still hold the task's own stored fallback values (`editTask()` reads from `this.rawTasks`, never from the rolled-up `Task`/`SummaryTask` instances), and those values become live again automatically the moment the task stops being a summary. No extra clearing logic needed.

Note: the spec also calls for hiding a "Progress" input, but `getTaskFormElement()` doesn't currently have one — progress is only ever set programmatically (`0` on creation, or derived by rollup), never user-edited. There's nothing to hide.)

- [ ] **Step 3: Clear `parentId` on children when their phase is deleted**

```diff
     deleteTask(t) {
         this.rawTasks = this.rawTasks.filter(e => e.id !== t);
         this.rawTasks.forEach(e => {
             if (e.dependencies)
-                e.dependencies = e.dependencies.filter(d => d !== t)
+                e.dependencies = e.dependencies.filter(d => d !== t);
+            if (e.parentId === t)
+                e.parentId = null;
         });

         this.render()
     }
```

- [ ] **Step 4: Verify via the dev server**

Ask the user to confirm the dev server is running. Using Playwright MCP:

1. Navigate to the dev server URL.
2. Simulate a drag on Phase 3's bar (`.gantt-task-bar.summary-bar`): read `barElement.style.left` before, dispatch `mousedown`/`mousemove`/`mouseup` (or use `mcp__playwright__browser_evaluate` to read the style, since no listener is attached the drag has no handler to intercept at all), read `style.left` after. Expected: unchanged.
3. Double-click "Phase 3: Development" in the sidebar to open the edit modal. Expected: the Start Date and End Date form groups are hidden (`display: none`); a "Parent" select is visible with "None" selected (Phase 3 has no `parentId` of its own); Name and Dependencies stay visible/editable.
4. Close that modal. Double-click "Backend Development". Expected: Start Date/End Date are visible (Backend isn't a summary); the Parent select shows "Phase 3: Development" selected.
5. Hover the "Phase 3: Development" sidebar row, click its delete icon. Use `mcp__playwright__browser_handle_dialog` to accept the resulting `confirm()`.
6. Double-click "Backend Development" again. Expected: Start Date/End Date are now visible with Backend's own Aug 25 – Sep 15 dates (it reverted to a plain leaf task since its former parent is gone), and the Parent select shows "None".

- [ ] **Step 5: Commit**

```bash
git add js/gantt/summary-task.js js/gantt/gantt-chart.js
git commit -m "Add no-op drag, Parent form field, and delete cleanup for summary tasks"
```

---

### Task 5: Collapse/expand in the sidebar

**Files:**
- Modify: `js/gantt/task.js` (`render()` signature, new `getSidebarPrefixElement()` hook)
- Modify: `js/gantt/summary-task.js` (chevron, `render()` passthrough)
- Modify: `js/gantt/gantt-chart.js` (`constructor`, `render()`, `renderGridLines()`)
- Modify: `css/style.css` (insert after the `.gantt-sidebar-row:hover .delete-task-btn` block, around line 158)

**Interfaces:**
- Consumes: `this.gantt.collapsedIds` (new, `Set<string>`).
- Produces: `Task.render(index, visible = true)` (the `visible` param — Task 7 also builds on this signature); `Task.getSidebarPrefixElement()` hook (returns `null` in `Task`, a chevron in `SummaryTask`); `GanttChart.visibleRowCount` (used by `renderGridLines()`).

- [ ] **Step 1: `Task.render()` gains a `visible` param and a sidebar-prefix hook**

```diff
-    render(index) {
+    render(index, visible = true) {
         this.y = index * this.gantt.options.rowHeight + this.gantt.options.rowHeight / 2;

         // Create sidebar element using DOM API
         this.sidebarElement = document.createElement('div');
         this.sidebarElement.className = 'gantt-sidebar-row';

+        const prefixElement = this.getSidebarPrefixElement();
+
         const taskNameSpan = document.createElement('span');
         taskNameSpan.className = 'task-name';
         taskNameSpan.title = 'Double-click to edit';
         taskNameSpan.textContent = this.name;

         const deleteBtn = document.createElement('span');
         deleteBtn.className = 'delete-task-btn';
         deleteBtn.title = 'Delete Task';
         deleteBtn.innerHTML = '&#128465;';

+        if (prefixElement) this.sidebarElement.appendChild(prefixElement);
         this.sidebarElement.appendChild(taskNameSpan);
         this.sidebarElement.appendChild(deleteBtn);

         taskNameSpan.addEventListener('dblclick', () => this.gantt.editTask(this.id));
         deleteBtn.addEventListener('click', () => {
             if (confirm(`Delete task '${this.name}'?`)) this.gantt.deleteTask(this.id);
         });

-        this.gantt.sidebar.appendChild(this.sidebarElement);
+        if (visible) this.gantt.sidebar.appendChild(this.sidebarElement);

         this.taskRowElement = document.createElement('div');
         this.taskRowElement.className = 'gantt-task-row';
```

```diff
         this.taskRowElement.appendChild(this.barElement);
-        this.gantt.taskArea.appendChild(this.taskRowElement);
+        if (visible) this.gantt.taskArea.appendChild(this.taskRowElement);

         this.updatePosition();
         this.addDragListeners();
     }
```

Add the hook method after `addDragListeners()`, still inside the `Task` class:

```js
    getSidebarPrefixElement() {
        return null;
    }
```

- [ ] **Step 2: `SummaryTask` forwards `visible` and adds a chevron**

```diff
 export class SummaryTask extends Task {
-    render(index) {
-        super.render(index);
+    render(index, visible = true) {
+        super.render(index, visible);
         this.barElement.classList.add('summary-bar');
     }

     addDragListeners() {
         // Summary bars are derived, not draggable/resizable.
     }

+    getSidebarPrefixElement() {
+        const chevron = document.createElement('span');
+        chevron.className = 'gantt-summary-chevron';
+        if (this.gantt.collapsedIds.has(this.id)) chevron.classList.add('collapsed');
+        chevron.addEventListener('click', (e) => {
+            e.stopPropagation();
+            if (this.gantt.collapsedIds.has(this.id)) {
+                this.gantt.collapsedIds.delete(this.id);
+            } else {
+                this.gantt.collapsedIds.add(this.id);
+            }
+            this.gantt.render();
+        });
+        return chevron;
+    }
+
     recomputeFromChildren(allTasks) {
```

- [ ] **Step 3: `GanttChart` persists collapse state and filters visibility on render**

```diff
     constructor(containerId, tasks, options) {
         this.appContainer = document.getElementById(containerId);
         this.rawTasks = tasks.map(t => ({ ...t, id: t.id ?? GuidHelper.generateGuid() }));
         this.options = { dayWidth: 30, rowHeight: 32, ...options };
         this.tasks = [];
         this.eventListeners = {};
+        this.collapsedIds = new Set();

         this.render();
     }
```

```diff
     render() {
         const scrollLeft = this.gridContainer ? this.gridContainer.scrollLeft : 0;

         this.appContainer.innerHTML = '';
         this.calculateDateRange();
         this.createLayout();
         this.renderTimeline();
-        this.renderGridLines();

         this.summaryIds = new Set(this.rawTasks.map(t => t.parentId).filter(Boolean));

         this.tasks = this.rawTasks.map(taskData =>
             this.summaryIds.has(taskData.id) ? new SummaryTask(this, taskData) : new Task(this, taskData)
         );
         this.tasks.forEach(task => {
             if (task instanceof SummaryTask) task.recomputeFromChildren(this.tasks);
         });
-        this.tasks.forEach((task, index) => task.render(index));
+
+        let visibleRowIndex = 0;
+        this.visibleRowCount = 0;
+        this.tasks.forEach(task => {
+            const isHidden = task.parentId && this.collapsedIds.has(task.parentId);
+            task.render(visibleRowIndex, !isHidden);
+            if (!isHidden) {
+                visibleRowIndex++;
+                this.visibleRowCount++;
+            }
+        });
+
+        this.renderGridLines();

         this.renderDependencies();
         this.animationController = new AnimationController(this, this.animationControls);
         this.animationController.render();
         this.gridContainer.scrollLeft = scrollLeft;
     }
```

(`renderGridLines()` moves after the task loop because it now needs the visible row count, which is only known once the loop has run. Hidden tasks still get a full `render()` call — so their bar/label/progress elements exist and stay valid targets for animation updates later — they're just never appended to `sidebar`/`taskArea`, so they occupy no layout space and rows below them shift up naturally through normal document flow.)

```diff
     renderGridLines() {
-        const t = DateHelper.daysBetween(this.chartStartDate, this.chartEndDate) + 1, e = this.rawTasks.length, s = t * this.options.dayWidth, n = e * this.options.rowHeight;
+        const t = DateHelper.daysBetween(this.chartStartDate, this.chartEndDate) + 1, e = this.visibleRowCount, s = t * this.options.dayWidth, n = e * this.options.rowHeight;
```

- [ ] **Step 4: Add the chevron CSS**

Insert after `css/style.css:158` (the closing `}` of `.gantt-sidebar-row:hover .delete-task-btn`):

```css
.gantt-summary-chevron {
    display: inline-block;
    width: 12px;
    margin-right: 4px;
    cursor: pointer;
    transition: transform 0.15s ease;
}

.gantt-summary-chevron::before {
    content: '\25BC';
    font-size: 9px;
}

.gantt-summary-chevron.collapsed {
    transform: rotate(-90deg);
}
```

- [ ] **Step 5: Verify via the dev server**

Ask the user to confirm the dev server is running. Using Playwright MCP:

1. Navigate to the dev server URL.
2. `mcp__playwright__browser_evaluate`: count sidebar rows (`document.querySelectorAll('.gantt-sidebar-row').length`) — expect 9 (all sample tasks, nothing collapsed by default).
3. Click the chevron on "Phase 3: Development"'s sidebar row.
4. Re-count sidebar rows and grid rows (`document.querySelectorAll('.gantt-task-row').length`). Expected: 7 (Backend Development and Frontend Development no longer have rows).
5. Confirm the row immediately after where Frontend Development used to be ("Phase 4: Testing & Deploy") has moved up — e.g. compare its `getBoundingClientRect().top` against Phase 3's row, and confirm it's the very next row height down.
6. Click the same chevron again. Expected: row count returns to 9, in original order.

- [ ] **Step 6: Commit**

```bash
git add js/gantt/task.js js/gantt/summary-task.js js/gantt/gantt-chart.js css/style.css
git commit -m "Add collapse/expand for summary tasks in the sidebar"
```

---

### Task 6: Dependency-arrow guard rails

**Files:**
- Modify: `js/gantt/gantt-chart.js` (`renderDependencies()`, new `isHiddenTask()` helper, `render()`)

**Interfaces:**
- Consumes: `this.collapsedIds` (Task 5).
- Produces: `GanttChart.isHiddenTask(task)` helper, used only internally.

- [ ] **Step 1: Add the helper and use it in `render()`'s visibility check**

```diff
+    isHiddenTask(task) {
+        return Boolean(task.parentId && this.collapsedIds.has(task.parentId));
+    }
+
     addEventListener(eventType, callback) {
```

```diff
         let visibleRowIndex = 0;
         this.visibleRowCount = 0;
         this.tasks.forEach(task => {
-            const isHidden = task.parentId && this.collapsedIds.has(task.parentId);
+            const isHidden = this.isHiddenTask(task);
             task.render(visibleRowIndex, !isHidden);
```

- [ ] **Step 2: Skip parent/child and hidden-endpoint edges in `renderDependencies()`**

```diff
             t.dependencies.forEach(d => {
                 const p = this.tasks.find(t => t.id === d);
                 if (!p) return;

+                if (p.id === t.parentId || t.id === p.parentId) return;
+                if (this.isHiddenTask(t) || this.isHiddenTask(p)) return;
+
                 const sX = p.left + p.width, sY = p.y, eX = t.left, eY = t.y, a = document.createElementNS('http://www.w3.org/2000/svg', 'path');
```

- [ ] **Step 3: Verify via the dev server**

Ask the user to confirm the dev server is running. Using Playwright MCP:

1. Navigate to the dev server URL, with nothing collapsed.
2. `mcp__playwright__browser_evaluate`: `() => document.querySelectorAll('.dependency-line').length`. Expected: `8` (one per sample task with a non-empty `dependencies` array — none of the 8 existing edges are parent/child pairs, so this task's guard rail doesn't remove any of them; this confirms no regression).
3. **Parent/child guard rail:** temporarily edit `js/main.js` to add Phase 3's own id to Backend Development's `dependencies` array (the exact shape of the bug described in the spec's Motivation section):

```diff
-        { id: '550e8400-e29b-41d4-a716-446655440006', name: 'Backend Development', start: '2025-08-25', end: '2025-09-15', progress: 0, dependencies: ['550e8400-e29b-41d4-a716-446655440004'], parentId: '550e8400-e29b-41d4-a716-446655440005' },
+        { id: '550e8400-e29b-41d4-a716-446655440006', name: 'Backend Development', start: '2025-08-25', end: '2025-09-15', progress: 0, dependencies: ['550e8400-e29b-41d4-a716-446655440004', '550e8400-e29b-41d4-a716-446655440005'], parentId: '550e8400-e29b-41d4-a716-446655440005' },
```

Save, wait for Vite HMR (or re-navigate), re-run the same `.dependency-line` count. Expected: still `8` — the new edge is suppressed, no arrow is drawn, and no console error appears (`mcp__playwright__browser_console_messages`).

4. Discard the temporary edit: `git checkout -- js/main.js`.
5. **Collapsed-endpoint guard rail:** re-navigate to pick up the discarded edit, click the chevron on "Phase 3: Development" to collapse it, re-run the `.dependency-line` count. Expected: `5` (the 3 edges touching the now-hidden Backend/Frontend rows — "Backend → UI/UX Mockups", "Frontend → Backend", "Phase 4 → Frontend" — are gone). Click the chevron again to expand; count returns to `8`.

- [ ] **Step 4: Commit**

```bash
git add js/gantt/gantt-chart.js
git commit -m "Add dependency-arrow guard rails for parent/child pairs and collapsed rows"
```

---

### Task 7: Drag-and-drop re-parenting in the sidebar

**Files:**
- Modify: `js/gantt/task.js` (`render()` — draggable sidebar rows)
- Modify: `js/gantt/gantt-chart.js` (`constructor`, new `renderUnparentDropZone()`, `render()`)
- Modify: `css/style.css` (insert after the `.gantt-summary-chevron.collapsed` block from Task 5)

**Interfaces:**
- Consumes: `this.gantt.summaryIds` (Task 2), `this.gantt.updateTask()` (existing).
- Produces: `GanttChart.dragState` (`string | null`, the currently-dragged task's id — plain JS state, since `dataTransfer.getData()` isn't readable during `dragover` in any browser); `GanttChart.renderUnparentDropZone()`.

- [ ] **Step 1: Make sidebar rows draggable, with a dragover validity check**

Add inside `Task.render()`, right after the existing `deleteBtn.addEventListener('click', ...)` block and before `if (visible) this.gantt.sidebar.appendChild(this.sidebarElement);`:

```diff
         deleteBtn.addEventListener('click', () => {
             if (confirm(`Delete task '${this.name}'?`)) this.gantt.deleteTask(this.id);
         });

+        this.sidebarElement.draggable = true;
+
+        this.sidebarElement.addEventListener('dragstart', (e) => {
+            this.gantt.dragState = this.id;
+            e.dataTransfer.setData('text/plain', this.id);
+        });
+
+        this.sidebarElement.addEventListener('dragend', () => {
+            this.gantt.dragState = null;
+        });
+
+        this.sidebarElement.addEventListener('dragover', (e) => {
+            const draggedId = this.gantt.dragState;
+            if (!draggedId || draggedId === this.id) return;
+            const draggedIsSummary = this.gantt.summaryIds.has(draggedId);
+            const targetHasParent = Boolean(this.parentId);
+            if (draggedIsSummary || targetHasParent) return;
+
+            e.preventDefault();
+            this.sidebarElement.classList.add('drop-target-valid');
+        });
+
+        this.sidebarElement.addEventListener('dragleave', () => {
+            this.sidebarElement.classList.remove('drop-target-valid');
+        });
+
+        this.sidebarElement.addEventListener('drop', (e) => {
+            e.preventDefault();
+            this.sidebarElement.classList.remove('drop-target-valid');
+            this.gantt.updateTask(this.gantt.dragState, { parentId: this.id });
+        });
+
         if (visible) this.gantt.sidebar.appendChild(this.sidebarElement);
```

(Calling `e.preventDefault()` only inside the valid branch is what marks a target as drop-accepting per the HTML5 DnD spec — the invalid branch returns without it, so the browser rejects the drop there with no extra code needed.)

- [ ] **Step 2: `GanttChart` tracks `dragState` and renders the un-parent drop zone**

```diff
         this.tasks = [];
         this.eventListeners = {};
         this.collapsedIds = new Set();
+        this.dragState = null;

         this.render();
```

```diff
             if (!isHidden) {
                 visibleRowIndex++;
                 this.visibleRowCount++;
             }
         });

+        this.renderUnparentDropZone();
+
         this.renderGridLines();
```

Add the new method near `renderGridLines()`:

```js
    renderUnparentDropZone() {
        const strip = document.createElement('div');
        strip.className = 'gantt-unparent-dropzone';
        strip.textContent = 'Drop here to remove from phase';

        strip.addEventListener('dragover', (e) => {
            const draggedTask = this.tasks.find(t => t.id === this.dragState);
            if (!draggedTask || !draggedTask.parentId) return;

            e.preventDefault();
            strip.classList.add('drop-target-valid');
        });

        strip.addEventListener('dragleave', () => {
            strip.classList.remove('drop-target-valid');
        });

        strip.addEventListener('drop', (e) => {
            e.preventDefault();
            strip.classList.remove('drop-target-valid');
            this.updateTask(this.dragState, { parentId: null });
        });

        this.sidebar.appendChild(strip);
    }
```

- [ ] **Step 3: Add CSS for the highlight and the drop-zone strip**

Append after the `.gantt-summary-chevron.collapsed` block added in Task 5:

```css
.gantt-unparent-dropzone {
    padding: 8px 10px;
    font-size: 11px;
    color: #999;
    text-align: center;
    border-top: 1px dashed var(--border-color);
}

.gantt-sidebar-row.drop-target-valid,
.gantt-unparent-dropzone.drop-target-valid {
    background-color: var(--primary-color-light);
}
```

- [ ] **Step 4: Verify via the dev server**

Ask the user to confirm the dev server is running. Using Playwright MCP, drive the drag-and-drop with dispatched `DragEvent`s (Playwright's high-level drag gesture isn't reliable for custom HTML5 DnD, so use `browser_evaluate` for determinism):

1. Navigate to the dev server URL.
2. Valid re-parent — drag "UI/UX Mockups" onto "Phase 4: Testing & Deploy":

```js
() => {
    const dt = new DataTransfer();
    function fire(el, type, opts = {}) {
        el.dispatchEvent(new DragEvent(type, { bubbles: true, cancelable: true, dataTransfer: dt, ...opts }));
    }
    const rows = [...document.querySelectorAll('.gantt-sidebar-row')];
    const source = rows.find(r => r.querySelector('.task-name').textContent === 'UI/UX Mockups');
    const target = rows.find(r => r.querySelector('.task-name').textContent === 'Phase 4: Testing & Deploy');
    fire(source, 'dragstart');
    fire(target, 'dragover');
    fire(target, 'drop');
    fire(source, 'dragend');
    return document.querySelector('.gantt-summary-chevron') !== null;
}
```

Expected: `true` — "Phase 4: Testing & Deploy" now has a chevron (it's a summary, since UI/UX Mockups now has `parentId` pointing at it).

3. Invalid drop — drag "Phase 3: Development" (already a summary, has children) onto "New Year Prep", using the same `fire()` pattern with those two rows. Expected: no new chevron appears anywhere else, and "Phase 3: Development" keeps its own children (Backend/Frontend still nested under it, unaffected).
4. Un-parent — drag "UI/UX Mockups" (now parented under Phase 4) onto `.gantt-unparent-dropzone` using the same pattern (`fire(source, 'dragstart')`, `fire(dropzone, 'dragover')`, `fire(dropzone, 'drop')`, `fire(source, 'dragend')`). Expected: "Phase 4: Testing & Deploy" no longer has a chevron (it had only that one child).
5. Reload the page (discards the in-memory re-parenting, since nothing here persists past a reload) to leave the app in its original sample-data state for the next task.

- [ ] **Step 5: Commit**

```bash
git add js/gantt/task.js js/gantt/gantt-chart.js css/style.css
git commit -m "Add drag-and-drop re-parenting in the sidebar"
```

---

### Task 8: Animation & event exclusion, plus full regression pass

**Files:**
- Modify: `js/gantt/summary-task.js` (animation no-ops)
- Modify: `js/gantt/gantt-chart.js` (`updateAnimation()`)

**Interfaces:**
- Consumes: `this.summaryIds` (Task 2).
- Produces: nothing further — this is the last task in the plan.

- [ ] **Step 1: No-op animation overrides on `SummaryTask`**

```diff
     addDragListeners() {
         // Summary bars are derived, not draggable/resizable.
     }

+    updateAnimationProgress() {
+        // Summary bars never show an animation-progress fill.
+    }
+
+    enterAnimationMode() {}
+
+    exitAnimationMode() {}
+
     getSidebarPrefixElement() {
```

(`AnimationController.play()`/`stop()`/`nextFrame()`/`prevFrame()` call `task.enterAnimationMode()`/`exitAnimationMode()` on every task in `this.gantt.tasks` — no change needed in `animation-controller.js` itself, since those calls now resolve to these no-ops automatically for `SummaryTask` instances through normal polymorphism.)

- [ ] **Step 2: Skip `task-active` dispatch for summary tasks**

```diff
     updateAnimation(currentTime) {
         // Update animation progress for all tasks
         this.tasks.forEach(task => {
             task.updateAnimationProgress(currentTime);

-            // Check if the task is active and dispatch an event
-            if (currentTime >= task.start && currentTime < task.end) {
+            // Check if the task is active and dispatch an event (summary tasks never fire this)
+            if (!this.summaryIds.has(task.id) && currentTime >= task.start && currentTime < task.end) {
                 this.dispatchEvent('task-active', {
```

- [ ] **Step 3: Verify animation exclusion via the dev server**

Ask the user to confirm the dev server is running. Using Playwright MCP:

1. Navigate to the dev server URL.
2. Click `#btn-play`. Poll `document.querySelector('.summary-bar .gantt-task-progress-animation').style.width` a few times over ~2 seconds (e.g. via repeated `browser_evaluate` calls). Expected: stays `'0%'` throughout, while sibling leaf tasks' animation fills change.
3. Check `#event-log`'s text content (`browser_evaluate` reading `textContent`). Expected: contains `Backend Development` and/or `Frontend Development` active-task lines, never `Phase 3: Development`.
4. Click `#btn-stop`.

- [ ] **Step 4: Full regression pass against spec §9's checklist**

Ask the user to confirm the dev server is running, on a fresh reload (unmodified sample data — undo any leftover state from earlier tasks' manual testing). Using Playwright MCP, walk through each of the following and confirm the stated outcome (all of this exercises code already written in Tasks 1–8; no further code changes expected — if any of these fail, fix the relevant earlier task before proceeding):

- Phase 3's bar renders with the bracket shape (Task 3), spans Aug 25 – Sep 25 (`left: 870px`, `width: 930px` per Task 2's math), 0% progress fill.
- Dragging or resizing Phase 3's bar has no effect; its handles exist in the DOM (`display:none` via CSS) (Tasks 3–4).
- Deleting the last remaining child of a phase reverts it to a normal, editable leaf task using its own stored dates (Task 4).
- Deleting a phase clears `parentId` on its former children (Task 4).
- The edit modal for Phase 3 hides Start/End Date and shows the Parent field; a leaf task's modal shows Start/End Date normally (Task 4).
- "Phase 3: Development → UI/UX Mockups" (a real cross-phase dependency, not parent/child) still renders an arrow (Task 6).
- A deliberately reintroduced "Backend Development → Phase 3" dependency draws no arrow and produces no console error (Task 6).
- During animation playback, Phase 3's progress fill never appears and it never fires `task-active`, even while Backend/Frontend do (Task 8, Step 3).
- Collapsing Phase 3 hides Backend/Frontend's sidebar and grid rows (rows below shift up) and hides the 3 dependency arrows touching them; expanding restores all of it (Tasks 5–6).
- Dragging a leaf task onto a top-level task sets its `parentId`; dragging an existing summary, or dropping onto a task that already has a `parentId`, is rejected with no highlight and no-op on drop (Task 7).
- Dragging a task that has a `parentId` onto the bottom drop-zone strip clears it; the strip only highlights while such a task is being dragged (Task 7).

- [ ] **Step 5: Commit**

```bash
git add js/gantt/summary-task.js js/gantt/gantt-chart.js
git commit -m "Exclude summary tasks from animation progress and task-active events"
```

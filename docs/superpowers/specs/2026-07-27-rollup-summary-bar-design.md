# Rollup / Summary Bar Design

## Motivation

"Phase 3: Development" is conceptually a rollup over "Backend Development" and
"Frontend Development", but today it's rendered identically to a normal leaf
task: draggable, resizable, its own manually-set dates and progress. That
mismatch is what caused a real bug — Backend Development listed Phase 3 as a
`dependencies` entry, and since Phase 3's own end date is far later than
Backend's start date (Phase 3 spans the whole combined phase), the dependency
arrow was forced into a long backward loop across the entire bar.

This spec defines an explicit summary/rollup task type: a task whose
start/end/progress are derived from its children, rendered with a distinct
bracket/trapezoid shape, and excluded from participating in dependency arrows
with its own children.

Scope: single-level nesting only (a phase directly containing leaf tasks, no
phase-of-phases). This matches the current sample data and keeps rollup
computation a simple single pass.

## 1. Data model

Each task may declare an optional `parentId` pointing at another task's `id`:

```js
{ id: '...006', name: 'Backend Development', ..., parentId: '...005' }
{ id: '...007', name: 'Frontend Development', ..., parentId: '...005' }
```

A task is a **summary** iff some other task's `parentId` references it — this
is derived, not stored as a flag. `GanttChart` computes the summary id set
once per render:

```js
const summaryIds = new Set(this.rawTasks.map(t => t.parentId).filter(Boolean));
```

`dependencies` keeps its existing meaning (real cross-task ordering, e.g.
"Phase 3" → "UI/UX Mockups"). `parentId` is an orthogonal relationship
(hierarchy, not sequencing) — a task can have both a `parentId` and its own
independent `dependencies`.

Because nesting is single-level, a summary task is never itself expected to
carry a `parentId`; nothing enforces this beyond convention, since deeper
nesting isn't a supported scenario.

## 2. Rollup computation

`GanttChart.render()` currently does one pass over `rawTasks`: construct a
`Task`, push it, render it, in list order. That breaks if a summary appears
before its children in the list (it does — "Phase 3" is listed before
"Backend"/"Frontend"). It becomes a 3-step pipeline instead:

1. **Instantiate** every task — `SummaryTask` if its id is in `summaryIds`,
   otherwise `Task` — with no DOM work yet.
2. **Roll up**: for each `SummaryTask`, call
   `recomputeFromChildren(allTasks)`, which finds children by `parentId` and
   sets:
   - `start` = earliest child `start`
   - `end` = latest child `end`
   - `progress` = duration-weighted average of children's progress
     (`sum(childDurationDays * childProgress) / sum(childDurationDays)`, so a
     short task at low progress doesn't outweigh a long task at higher
     progress)
3. **Render** all tasks (in original list order, for stable row indices) —
   by now every task's `start`/`end`/`progress` is final.

A summary task's own `start`/`end`/`progress` fields in the raw data become
inert once it has children — they're a fallback only: if every child is
later deleted, it reverts to being a normal leaf task using its own stored
values. No migration or cleanup is needed for that fallback to work; it falls
out naturally from `summaryIds` no longer containing that id.

## 3. Rendering

`SummaryTask` extends `Task` and reuses the same DOM `Task.render()` already
builds (bar, progress divs, label, handles) — no new element types. It adds a
`summary-bar` class to `barElement`; CSS does the rest:

- **Shape**: the bar becomes a thin flat rectangle (~8px, anchored near the
  top of the row) in a distinct dark color, not one of the normal task
  colors. Two small triangles are added via `::before`/`::after`
  pseudo-elements at the left and right edges, pointing downward — the
  classic bracket/trapezoid look, built with plain CSS border-triangles
  rather than a hand-tuned `clip-path` polygon.
- **Progress fill**: the existing `.gantt-task-progress-actual` div is reused
  inside the thin bar, sized by the rolled-up progress from section 2 — same
  mechanism as a normal task bar, just visually smaller.
- **Label**: at 8px the bar is too thin to vertically center 12px text
  inside it, so the label is repositioned (CSS-only) to center on the full
  row height instead of the bar's own height.
- **Handles**: `leftHandle`/`rightHandle` are still created by the shared
  `Task.render()` DOM-building code (no special-casing there) but hidden via
  `.summary-bar .gantt-task-handle { display: none }`, since
  `SummaryTask.addDragListeners()` is a no-op override anyway.

## 4. Interaction & CRUD

- **Drag/resize**: `SummaryTask.addDragListeners()` is a no-op override — no
  mousedown handler is ever attached, so a summary bar doesn't respond to
  drag.
- **Edit modal** (`getTaskFormElement`): gains a new "Parent" single-select
  (lists other tasks, "None" as default), so any task can be assigned a
  `parentId`. When editing a task that currently has children (is a
  summary), the Start Date, End Date, and Progress inputs are hidden/disabled
  — they're derived and would just be overwritten on the next render. Name,
  Dependencies, and the new Parent field stay editable.
- **No separate "create summary" flow**: since being a summary is purely
  derived, you make one by setting an existing (or new) task's Parent field
  to point at it. Nothing new is needed in `addTask()`.
- **Delete cleanup**: `deleteTask()` already strips a deleted id out of every
  other task's `dependencies` array. It gains one more line to also clear
  `parentId` on any child that pointed at the deleted task, so children of a
  deleted phase become ordinary top-level tasks instead of pointing at a
  dangling id.

## 5. Dependency-arrow handling

Two mechanisms, both kept, addressing different layers:

1. **Existing routing fix** (already shipped, unrelated to this feature): the
   detour logic in `renderDependencies()` keeps any dependency arrow from
   overlapping a task bar or label, even in a "successor starts before
   predecessor ends" case. This isn't changed by this design.
2. **New guard rail**: in `renderDependencies()`, right after resolving the
   predecessor `p` for a given successor `t`'s dependency entry, skip drawing
   the edge if `p.id === t.parentId || t.id === p.parentId` — i.e. one side
   is the other's parent. This is the exact shape of the original bug (a
   child listing its own phase as a dependency); the guard means that
   specific mistake can no longer even attempt to draw an arrow, rather than
   relying on the routing fix to make it look tolerable. Real cross-phase
   dependencies (e.g. "Phase 3" → "UI/UX Mockups") aren't parent/child, so
   they render exactly as before.

## 6. Animation & event dispatch

A summary bar isn't independent work — it's "active" for its entire derived
span, which is the union of all its children's spans. If it participated in
`GanttChart.updateAnimation()` like a normal task, it would fire a
`task-active` event simultaneously with whichever child is genuinely active
for the whole time the phase is running, and its animation-progress fill
would just be a blended restatement of progress already visible in its
children's own rows. Both are redundant signals for any listener, so
`SummaryTask` excludes itself from both:

- `SummaryTask.updateAnimationProgress()`, `enterAnimationMode()`, and
  `exitAnimationMode()` are no-op overrides — a summary bar's
  animation-progress fill never appears, regardless of playback state.
- `GanttChart.updateAnimation()`'s active-task loop (the one that calls
  `dispatchEvent('task-active', ...)`) skips any task that is a summary —
  only genuine leaf tasks can be "active."

A consumer that wants "is anything in this phase active right now" can
already derive it by combining the `task-active` events of the phase's
children; that composition isn't provided out of the box.

## 7. Testing / verification

No test framework exists in this project (Vite + a single `js/main.js`), so
verification is manual, in the browser, using the current sample data plus
one added `parentId` (re-attach "Phase 3: Development" as parent of "Backend
Development" and "Frontend Development" as the real test case):

- Summary bar renders with the bracket shape, spans the full child range, and
  shows the correct weighted-average progress fill.
- Dragging or resizing the summary bar has no effect (handles present in the
  DOM but inert/hidden).
- Deleting the last remaining child reverts the phase to a normal, editable
  task using its own stored dates.
- Deleting a phase clears `parentId` on its former children.
- The edit modal for a summary task hides Start/End/Progress and shows the
  new Parent field.
- A real cross-phase dependency (e.g. Phase 3 → UI/UX Mockups) still renders
  normally.
- A deliberately reintroduced child → own-parent dependency does not draw an
  arrow at all (guard rail), and doesn't error.
- During animation playback, a summary bar's progress fill never appears and
  no `task-active` event fires for it, even while its children are actively
  animating and dispatching their own `task-active` events.

## Out of scope

- Multi-level nesting (phase-of-phases).
- Collapsing/expanding a phase's children in the sidebar.
- Automatic re-parenting via drag-and-drop in the sidebar.

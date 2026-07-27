// src/summary-task.js
import { Task } from './task.js';
import { DateHelper } from './utils.js';

export class SummaryTask extends Task {
    render(index, visible = true) {
        super.render(index, visible);
        this.barElement.classList.add('summary-bar');
    }

    addDragListeners() {
        // Summary bars are derived, not draggable/resizable.
    }

    updateAnimationProgress() {
        // Summary bars never show an animation-progress fill.
    }

    enterAnimationMode() {}

    exitAnimationMode() {}

    getSidebarPrefixElement() {
        const chevron = document.createElement('span');
        chevron.className = 'gantt-summary-chevron';
        if (this.gantt.collapsedIds.has(this.id)) chevron.classList.add('collapsed');
        chevron.addEventListener('click', (e) => {
            e.stopPropagation();
            if (this.gantt.collapsedIds.has(this.id)) {
                this.gantt.collapsedIds.delete(this.id);
            } else {
                this.gantt.collapsedIds.add(this.id);
            }
            this.gantt.render();
        });
        return chevron;
    }

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

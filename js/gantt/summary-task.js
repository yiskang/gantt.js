// js/gantt/summary-task.js
import { Task } from './task.js';
import { DateHelper } from './utils.js';

export class SummaryTask extends Task {
    render(index) {
        super.render(index);
        this.barElement.classList.add('summary-bar');
    }

    addDragListeners() {
        // Summary bars are derived, not draggable/resizable.
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

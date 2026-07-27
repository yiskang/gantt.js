// js/gantt/task.js
import { DateHelper } from './utils.js';

export class Task {
    constructor(gantt, data) {
        this.gantt = gantt;
        Object.assign(this, data);
        this.start = new Date(data.start);
        this.end = new Date(data.end);
        this.dependencies = data.dependencies || [];
    }

    render(index, visible = true) {
        this.y = index * this.gantt.options.rowHeight + this.gantt.options.rowHeight / 2;

        // Create sidebar element using DOM API
        this.sidebarElement = document.createElement('div');
        this.sidebarElement.className = 'gantt-sidebar-row';

        const prefixElement = this.getSidebarPrefixElement();

        const taskNameSpan = document.createElement('span');
        taskNameSpan.className = 'task-name';
        taskNameSpan.title = 'Double-click to edit';
        taskNameSpan.textContent = this.name;

        const deleteBtn = document.createElement('span');
        deleteBtn.className = 'delete-task-btn';
        deleteBtn.title = 'Delete Task';
        deleteBtn.innerHTML = '&#128465;';

        if (prefixElement) this.sidebarElement.appendChild(prefixElement);
        this.sidebarElement.appendChild(taskNameSpan);
        this.sidebarElement.appendChild(deleteBtn);

        taskNameSpan.addEventListener('dblclick', () => this.gantt.editTask(this.id));
        deleteBtn.addEventListener('click', () => {
            if (confirm(`Delete task '${this.name}'?`)) this.gantt.deleteTask(this.id);
        });

        this.sidebarElement.draggable = true;

        this.sidebarElement.addEventListener('dragstart', (e) => {
            this.gantt.dragState = this.id;
            e.dataTransfer.setData('text/plain', this.id);
        });

        this.sidebarElement.addEventListener('dragend', () => {
            this.gantt.dragState = null;
        });

        this.sidebarElement.addEventListener('dragover', (e) => {
            const draggedId = this.gantt.dragState;
            if (!this.gantt.canReparent(draggedId, this.id)) return;

            e.preventDefault();
            this.sidebarElement.classList.add('drop-target-valid');
        });

        this.sidebarElement.addEventListener('dragleave', () => {
            this.sidebarElement.classList.remove('drop-target-valid');
        });

        this.sidebarElement.addEventListener('drop', (e) => {
            e.preventDefault();
            this.sidebarElement.classList.remove('drop-target-valid');
            if (!this.gantt.canReparent(this.gantt.dragState, this.id)) return;
            this.gantt.updateTask(this.gantt.dragState, { parentId: this.id });
        });

        if (visible) this.gantt.sidebar.appendChild(this.sidebarElement);

        this.taskRowElement = document.createElement('div');
        this.taskRowElement.className = 'gantt-task-row';

        // Create task bar using DOM API
        this.barElement = document.createElement('div');
        this.barElement.className = 'gantt-task-bar';

        // Updated progress structure with two progress bars
        const progressContainer = document.createElement('div');
        progressContainer.className = 'gantt-task-progress';

        const actualProgressDiv = document.createElement('div');
        actualProgressDiv.className = 'gantt-task-progress-actual';

        const animationProgressDiv = document.createElement('div');
        animationProgressDiv.className = 'gantt-task-progress-animation';

        const labelSpan = document.createElement('span');
        labelSpan.className = 'gantt-task-label';

        const leftHandle = document.createElement('div');
        leftHandle.className = 'gantt-task-handle gantt-task-handle-left';

        const rightHandle = document.createElement('div');
        rightHandle.className = 'gantt-task-handle gantt-task-handle-right';

        progressContainer.appendChild(actualProgressDiv);
        progressContainer.appendChild(animationProgressDiv);

        this.barElement.appendChild(progressContainer);
        this.barElement.appendChild(labelSpan);
        this.barElement.appendChild(leftHandle);
        this.barElement.appendChild(rightHandle);

        // Store references to both progress elements
        this.actualProgressElement = actualProgressDiv;
        this.animationProgressElement = animationProgressDiv;
        this.labelElement = labelSpan;

        this.taskRowElement.appendChild(this.barElement);
        if (visible) this.gantt.taskArea.appendChild(this.taskRowElement);

        this.updatePosition();
        this.addDragListeners();
    }

    updatePosition() {
        const dayWidth = this.gantt.options.dayWidth;
        const durationDays = DateHelper.daysBetween(this.start, this.end);

        this.left = DateHelper.daysBetween(this.gantt.chartStartDate, this.start) * dayWidth;
        this.width = durationDays * dayWidth;

        this.barElement.style.left = `${this.left}px`;
        this.barElement.style.width = `${this.width}px`;

        // Set actual progress from task data
        this.actualProgressElement.style.width = `${this.progress}%`;

        this.labelElement.textContent = this.name;
        this.sidebarElement.querySelector('.task-name').textContent = this.name;
    }

    updateAnimationProgress(currentDate) {
        let progressPercent;
        if (currentDate < this.start) {
            progressPercent = 0;
        } else if (currentDate >= this.end) {
            progressPercent = 100;
        } else {
            progressPercent = ((currentDate - this.start) / (this.end - this.start)) * 100;
        }
        this.animationProgressElement.style.width = `${progressPercent}%`;
    }

    enterAnimationMode() {
        this.barElement.classList.add('animation-mode');
    }

    exitAnimationMode() {
        this.barElement.classList.remove('animation-mode');
        // Reset animation progress
        this.animationProgressElement.style.width = '0%';
    }

    addDragListeners() {
        let startX, startLeft, startWidth;
        let dragMode = null;

        const onMouseDown = (e) => {
            e.preventDefault();
            dragMode = 'move';

            if (e.target.classList.contains('gantt-task-handle-left')) dragMode = 'resize-left';
            if (e.target.classList.contains('gantt-task-handle-right')) dragMode = 'resize-right';

            startX = e.clientX;
            startLeft = this.barElement.offsetLeft;
            startWidth = this.barElement.offsetWidth;
            this.initialStart = new Date(this.start);
            this.initialEnd = new Date(this.end);

            this.barElement.classList.add('dragging');
            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
        };

        const onMouseMove = (e) => {
            if (!dragMode) return;
            const deltaX = e.clientX - startX;

            if (dragMode === 'move') {
                this.barElement.style.left = `${startLeft + deltaX}px`;
            } else if (dragMode === 'resize-right') {
                const newWidth = startWidth + deltaX;
                if (newWidth > this.gantt.options.dayWidth) {
                    this.barElement.style.width = `${newWidth}px`;
                }
            } else if (dragMode === 'resize-left') {
                const newWidth = startWidth - deltaX;
                if (newWidth > this.gantt.options.dayWidth) {
                    this.barElement.style.left = `${startLeft + deltaX}px`;
                    this.barElement.style.width = `${newWidth}px`;
                }
            }
        };

        const onMouseUp = (e) => {
            this.barElement.classList.remove('dragging');
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);

            const deltaX = e.clientX - startX;
            const deltaDays = Math.round(deltaX / this.gantt.options.dayWidth);

            let newStart = this.initialStart, newEnd = this.initialEnd;

            if (dragMode === 'move') {
                newStart = DateHelper.addDays(this.initialStart, deltaDays);
                newEnd = DateHelper.addDays(this.initialEnd, deltaDays);
            } else if (dragMode === 'resize-right') {
                newEnd = DateHelper.addDays(this.initialEnd, deltaDays);
                if (newEnd <= newStart) newEnd = DateHelper.addDays(newStart, 1);
            } else if (dragMode === 'resize-left') {
                newStart = DateHelper.addDays(this.initialStart, deltaDays);
                if (newStart >= newEnd) newStart = DateHelper.addDays(newEnd, -1);
            }

            this.gantt.updateTask(this.id, { start: newStart, end: newEnd });
        };

        this.barElement.addEventListener('mousedown', onMouseDown);
    }

    getSidebarPrefixElement() {
        return null;
    }
}

// js/gantt/gantt-chart.js
import { DateHelper, GuidHelper } from './utils.js';
import { Task } from './task.js';
import { AnimationController } from './animation-controller.js';
import { Modal } from './modal.js';
import { SummaryTask } from './summary-task.js';

export class GanttChart {
    constructor(containerId, tasks, options) {
        this.appContainer = document.getElementById(containerId);
        this.rawTasks = tasks.map(t => ({ ...t, id: t.id ?? GuidHelper.generateGuid() }));
        this.options = { dayWidth: 30, rowHeight: 32, ...options };
        this.tasks = [];
        this.eventListeners = {};

        this.render();
    }

    addEventListener(eventType, callback) {
        if (!this.eventListeners[eventType]) {
            this.eventListeners[eventType] = [];
        }
        this.eventListeners[eventType].push(callback);
    }

    removeEventListener(eventType, callback) {
        if (!this.eventListeners[eventType]) return;

        const index = this.eventListeners[eventType].indexOf(callback);
        if (index > -1) {
            this.eventListeners[eventType].splice(index, 1);
        }
    }

    dispatchEvent(eventType, eventData) {
        if (!this.eventListeners[eventType]) return;

        this.eventListeners[eventType].forEach(callback => {
            callback(eventData);
        });
    }

    render() {
        const scrollLeft = this.gridContainer ? this.gridContainer.scrollLeft : 0;

        this.appContainer.innerHTML = '';
        this.calculateDateRange();
        this.createLayout();
        this.renderTimeline();
        this.renderGridLines();

        this.summaryIds = new Set(this.rawTasks.map(t => t.parentId).filter(Boolean));

        this.tasks = this.rawTasks.map(taskData =>
            this.summaryIds.has(taskData.id) ? new SummaryTask(this, taskData) : new Task(this, taskData)
        );
        this.tasks.forEach(task => {
            if (task instanceof SummaryTask) task.recomputeFromChildren(this.tasks);
        });
        this.tasks.forEach((task, index) => task.render(index));

        this.renderDependencies();
        this.animationController = new AnimationController(this, this.animationControls);
        this.animationController.render();
        this.gridContainer.scrollLeft = scrollLeft;
    }

    createLayout() {
        // Clear container
        this.appContainer.innerHTML = '';

        // Create main gantt container
        const ganttContainer = document.createElement('div');
        ganttContainer.id = 'gantt-container';

        // Create animation controls
        const animationControls = document.createElement('div');
        animationControls.id = 'animation-controls';

        // Create main section
        const ganttMain = document.createElement('div');
        ganttMain.className = 'gantt-main';

        // Create sidebar
        const ganttSidebar = document.createElement('div');
        ganttSidebar.className = 'gantt-sidebar';

        const sidebarHeader = document.createElement('div');
        sidebarHeader.className = 'gantt-sidebar-header';

        const tasksSpan = document.createElement('span');
        tasksSpan.textContent = 'Tasks';

        const addTaskBtn = document.createElement('button');
        addTaskBtn.id = 'add-task-btn';
        addTaskBtn.title = 'Add New Task';
        addTaskBtn.textContent = '+';

        sidebarHeader.appendChild(tasksSpan);
        sidebarHeader.appendChild(addTaskBtn);
        ganttSidebar.appendChild(sidebarHeader);

        // Create grid container
        const gridContainer = document.createElement('div');
        gridContainer.className = 'gantt-grid-container';

        const ganttHeader = document.createElement('div');
        ganttHeader.className = 'gantt-header';

        const ganttGrid = document.createElement('div');
        ganttGrid.className = 'gantt-grid';

        // Create SVG for dependencies
        const dependencyLayer = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        dependencyLayer.id = 'dependency-layer';

        const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
        const marker = document.createElementNS('http://www.w3.org/2000/svg', 'marker');
        marker.id = 'arrow';
        marker.setAttribute('viewBox', '0 0 10 10');
        marker.setAttribute('refX', '8');
        marker.setAttribute('refY', '5');
        marker.setAttribute('markerWidth', '6');
        marker.setAttribute('markerHeight', '6');
        marker.setAttribute('orient', 'auto-start-reverse');

        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', 'M 0 0 L 10 5 L 0 10 z');
        path.setAttribute('class', 'dependency-arrow');

        marker.appendChild(path);
        defs.appendChild(marker);
        dependencyLayer.appendChild(defs);

        const gridLines = document.createElement('div');
        gridLines.className = 'grid-lines';

        const taskArea = document.createElement('div');
        taskArea.className = 'gantt-task-area';

        const progressLine = document.createElement('div');
        progressLine.id = 'animation-progress-line';

        // Assemble grid
        ganttGrid.appendChild(dependencyLayer);
        ganttGrid.appendChild(gridLines);
        ganttGrid.appendChild(taskArea);
        ganttGrid.appendChild(progressLine);

        // Assemble grid container
        gridContainer.appendChild(ganttHeader);
        gridContainer.appendChild(ganttGrid);

        // Assemble main
        ganttMain.appendChild(ganttSidebar);
        ganttMain.appendChild(gridContainer);

        // Assemble container
        ganttContainer.appendChild(animationControls);
        ganttContainer.appendChild(ganttMain);

        // Add to app container
        this.appContainer.appendChild(ganttContainer);

        // Cache elements
        Object.assign(this, {
            animationControls: animationControls,
            sidebar: ganttSidebar,
            gridContainer: gridContainer,
            timelineHeader: ganttHeader,
            grid: ganttGrid,
            gridLines: gridLines,
            taskArea: taskArea,
            dependencyLayer: dependencyLayer,
            animationProgressLine: progressLine
        });

        addTaskBtn.addEventListener('click', () => this.addTask());
    }

    renderTimeline() {
        this.timelineHeader.innerHTML = '';

        const dates = [];
        const currentDate = new Date(this.chartStartDate);
        while (currentDate <= this.chartEndDate) {
            dates.push(new Date(currentDate));
            currentDate.setDate(currentDate.getDate() + 1);
        }

        const totalWidth = dates.length * this.options.dayWidth;

        // Create year row
        const yearRow = document.createElement('div');
        yearRow.className = 'gantt-header-row';
        yearRow.style.width = `${totalWidth}px`;
        yearRow.style.height = '25px'; // Explicit height
        yearRow.style.position = 'relative';

        // Create month row  
        const monthRow = document.createElement('div');
        monthRow.className = 'gantt-header-row';
        monthRow.style.width = `${totalWidth}px`;
        monthRow.style.height = '25px'; // Explicit height
        monthRow.style.position = 'relative';

        // Create day row
        const dayRow = document.createElement('div');
        dayRow.className = 'gantt-days';
        dayRow.style.width = `${totalWidth}px`;
        dayRow.style.height = '25px'; // Explicit height
        dayRow.style.position = 'relative';

        // Track spans for years and months
        let currentYear = null;
        let currentMonth = null;
        let yearSpan = { start: 0, count: 0 };
        let monthSpan = { start: 0, count: 0 };

        dates.forEach((date, index) => {
            const year = date.getFullYear();
            const month = date.getMonth();

            // Handle year transitions
            if (year !== currentYear) {
                // Complete previous year
                if (currentYear !== null) {
                    const yearEl = document.createElement('div');
                    yearEl.className = 'gantt-year';
                    yearEl.textContent = currentYear;
                    yearEl.style.position = 'absolute';
                    yearEl.style.left = `${yearSpan.start * this.options.dayWidth}px`;
                    yearEl.style.width = `${yearSpan.count * this.options.dayWidth}px`;
                    yearEl.style.top = '0px'; // Explicit top position
                    yearRow.appendChild(yearEl);
                }

                currentYear = year;
                yearSpan = { start: index, count: 0 };
            }
            yearSpan.count++;

            // Handle month transitions
            if (month !== currentMonth || year !== dates[Math.max(0, index - 1)].getFullYear()) {
                // Complete previous month
                if (currentMonth !== null && index > 0) {
                    const monthEl = document.createElement('div');
                    monthEl.className = 'gantt-month';
                    monthEl.textContent = new Date(dates[monthSpan.start].getFullYear(), currentMonth, 1).toLocaleString('default', { month: 'short' });
                    monthEl.style.position = 'absolute';
                    monthEl.style.left = `${monthSpan.start * this.options.dayWidth}px`;
                    monthEl.style.width = `${monthSpan.count * this.options.dayWidth}px`;
                    monthEl.style.top = '0px'; // Explicit top position
                    monthRow.appendChild(monthEl);
                }

                currentMonth = month;
                monthSpan = { start: index, count: 0 };
            }
            monthSpan.count++;

            // Create day element
            const dayEl = document.createElement('div');
            dayEl.className = 'gantt-day';
            if (DateHelper.isWeekend(date)) {
                dayEl.classList.add('weekend');
            }
            dayEl.textContent = date.getDate();
            dayEl.style.position = 'absolute';
            dayEl.style.left = `${index * this.options.dayWidth}px`;
            dayEl.style.width = `${this.options.dayWidth}px`;
            dayEl.style.top = '0px'; // Explicit top position
            dayRow.appendChild(dayEl);

            // Handle last elements
            if (index === dates.length - 1) {
                // Complete last year
                const yearEl = document.createElement('div');
                yearEl.className = 'gantt-year';
                yearEl.textContent = currentYear;
                yearEl.style.position = 'absolute';
                yearEl.style.left = `${yearSpan.start * this.options.dayWidth}px`;
                yearEl.style.width = `${yearSpan.count * this.options.dayWidth}px`;
                yearEl.style.top = '0px'; // Explicit top position
                yearRow.appendChild(yearEl);

                // Complete last month
                const monthEl = document.createElement('div');
                monthEl.className = 'gantt-month';
                monthEl.textContent = new Date(year, month, 1).toLocaleString('default', { month: 'short' });
                monthEl.style.position = 'absolute';
                monthEl.style.left = `${monthSpan.start * this.options.dayWidth}px`;
                monthEl.style.width = `${monthSpan.count * this.options.dayWidth}px`;
                monthEl.style.top = '0px'; // Explicit top position
                monthRow.appendChild(monthEl);
            }
        });

        this.timelineHeader.appendChild(yearRow);
        this.timelineHeader.appendChild(monthRow);
        this.timelineHeader.appendChild(dayRow);
    }

    updateAnimation(currentTime) {
        // Update animation progress for all tasks
        this.tasks.forEach(task => {
            task.updateAnimationProgress(currentTime);

            // Check if the task is active and dispatch an event
            if (currentTime >= task.start && currentTime < task.end) {
                this.dispatchEvent('task-active', {
                    task: task,
                    currentTime: currentTime,
                    ganttChart: this
                });
            }
        });

        // Update progress line
        const offsetDays = DateHelper.daysBetween(this.chartStartDate, currentTime);
        const progressLineX = offsetDays * this.options.dayWidth;
        this.animationProgressLine.style.left = progressLineX >= 0 ? `${progressLineX}px` : '-10px';
    }

    // --- Other GanttChart Methods (CRUD, Dependencies, etc. - Unchanged and minified) ---
    renderDependencies() {
        this.dependencyLayer.innerHTML = this.dependencyLayer.querySelector('defs').outerHTML;
        const offset = 20;

        this.tasks.forEach(t => {
            if (!t.dependencies) return;

            t.dependencies.forEach(d => {
                const p = this.tasks.find(t => t.id === d);
                if (!p) return;

                const sX = p.left + p.width, sY = p.y, eX = t.left, eY = t.y, a = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                let h;

                if (eX >= sX + offset) {
                    // Enough room between the bars: simple elbow that never crosses a task bar.
                    h = `M ${sX} ${sY} L ${sX + offset} ${sY} L ${sX + offset} ${eY} L ${eX} ${eY}`;
                } else {
                    // Successor starts before the predecessor ends (+ buffer): a direct elbow
                    // would cut straight through the bar and its label, so detour through a row
                    // gap instead. The raw midpoint only lands in a gap when the two rows are
                    // adjacent; when a row sits between them, snap to the nearest row boundary
                    // so the detour never lands on another row's bar/label.
                    const rowHeight = this.options.rowHeight;
                    const detourY = Math.round((sY + eY) / 2 / rowHeight) * rowHeight;

                    h = `M ${sX} ${sY} L ${sX + offset} ${sY} L ${sX + offset} ${detourY} L ${eX - offset} ${detourY} L ${eX - offset} ${eY} L ${eX} ${eY}`;
                }

                a.setAttribute('d', h);
                a.setAttribute('class', 'dependency-line');
                a.setAttribute('marker-end', 'url(#arrow)');
                this.dependencyLayer.appendChild(a);
            })
        });
    }

    getTaskFormElement(task = {}) {
        const container = document.createElement('div');

        // Name field
        const nameGroup = document.createElement('div');
        nameGroup.className = 'form-group';

        const nameLabel = document.createElement('label');
        nameLabel.setAttribute('for', 'name');
        nameLabel.textContent = 'Task Name';

        const nameInput = document.createElement('input');
        nameInput.type = 'text';
        nameInput.name = 'name';
        nameInput.value = task.name || '';
        nameInput.required = true;

        nameGroup.appendChild(nameLabel);
        nameGroup.appendChild(nameInput);

        // Start date field
        const startGroup = document.createElement('div');
        startGroup.className = 'form-group';

        const startLabel = document.createElement('label');
        startLabel.setAttribute('for', 'start');
        startLabel.textContent = 'Start Date';

        const startInput = document.createElement('input');
        startInput.type = 'date';
        startInput.name = 'start';
        startInput.value = task.start ? DateHelper.formatDate(new Date(task.start)) : '';
        startInput.required = true;

        startGroup.appendChild(startLabel);
        startGroup.appendChild(startInput);

        // End date field
        const endGroup = document.createElement('div');
        endGroup.className = 'form-group';

        const endLabel = document.createElement('label');
        endLabel.setAttribute('for', 'end');
        endLabel.textContent = 'End Date';

        const endInput = document.createElement('input');
        endInput.type = 'date';
        endInput.name = 'end';
        endInput.value = task.end ? DateHelper.formatDate(new Date(task.end)) : '';
        endInput.required = true;

        endGroup.appendChild(endLabel);
        endGroup.appendChild(endInput);

        // Parent field
        const parentGroup = document.createElement('div');
        parentGroup.className = 'form-group';

        const parentLabel = document.createElement('label');
        parentLabel.setAttribute('for', 'parentId');
        parentLabel.textContent = 'Parent';

        const parentSelect = document.createElement('select');
        parentSelect.name = 'parentId';

        const noneOption = document.createElement('option');
        noneOption.value = '';
        noneOption.textContent = 'None';
        parentSelect.appendChild(noneOption);

        this.rawTasks.filter(t => t.id !== task.id).forEach(t => {
            const option = document.createElement('option');
            option.value = t.id;
            option.textContent = t.name;
            option.selected = task.parentId === t.id;
            parentSelect.appendChild(option);
        });

        parentGroup.appendChild(parentLabel);
        parentGroup.appendChild(parentSelect);

        const isSummary = this.summaryIds && this.summaryIds.has(task.id);
        if (isSummary) {
            startGroup.style.display = 'none';
            endGroup.style.display = 'none';
        }

        // Dependencies field
        const depsGroup = document.createElement('div');
        depsGroup.className = 'form-group';

        const depsLabel = document.createElement('label');
        depsLabel.setAttribute('for', 'dependencies');
        depsLabel.textContent = 'Dependencies';

        const depsSelect = document.createElement('select');
        depsSelect.name = 'dependencies';
        depsSelect.multiple = true;
        depsSelect.style.height = '100px';

        const dependencies = task.dependencies || [];
        this.rawTasks.filter(t => t.id !== task.id).forEach(t => {
            const option = document.createElement('option');
            option.value = t.id;
            option.textContent = t.name;
            option.selected = dependencies.includes(t.id);
            depsSelect.appendChild(option);
        });

        depsGroup.appendChild(depsLabel);
        depsGroup.appendChild(depsSelect);

        // Assemble container
        container.appendChild(nameGroup);
        container.appendChild(startGroup);
        container.appendChild(endGroup);
        container.appendChild(parentGroup);
        container.appendChild(depsGroup);

        return container;
    }

    addTask() {
        const formElement = this.getTaskFormElement();
        const modal = new Modal('Add New Task', formElement, data => {
            if (!data.name || !data.start || !data.end) {
                alert('Name, Start Date, and End Date are required.');
                return false;
            }
            this.rawTasks.push({
                ...data,
                id: GuidHelper.generateGuid(),
                progress: 0,
                dependencies: data.dependencies.map(Number)
            });
            this.render();
            return true;
        });
        modal.show();
    }

    editTask(taskId) {
        const task = this.rawTasks.find(t => t.id === taskId);
        const formElement = this.getTaskFormElement(task);
        const modal = new Modal('Edit Task', formElement, data => {
            this.updateTask(taskId, {
                ...data,
                dependencies: data.dependencies || []
            });
            return true;
        });
        modal.show();
    }

    deleteTask(t) {
        this.rawTasks = this.rawTasks.filter(e => e.id !== t);
        this.rawTasks.forEach(e => {
            if (e.dependencies)
                e.dependencies = e.dependencies.filter(d => d !== t);
            if (e.parentId === t)
                e.parentId = null;
        });

        this.render()
    }

    updateTask(t, e) {
        const s = this.rawTasks.findIndex(n => n.id === t);
        if (s > -1) {
            const n = this.rawTasks[s];
            if (e.start && typeof e.start !== 'string')
                e.start = DateHelper.formatDate(e.start);

            if (e.end && typeof e.end !== 'string')
                e.end = DateHelper.formatDate(e.end);

            this.rawTasks[s] = { ...n, ...e }
        }

        this.render();
    }

    calculateDateRange() {
        if (this.rawTasks.length === 0) {
            this.chartStartDate = new Date;
            this.chartEndDate = DateHelper.addDays(new Date, 30);
            return
        }

        let m = new Date(this.rawTasks[0].start), x = new Date(this.rawTasks[0].end);
        this.rawTasks.forEach(t => {
            const s = new Date(t.start), e = new Date(t.end); if (s < m) m = s;
            if (e > x)
                x = e;
        });
        this.chartStartDate = DateHelper.addDays(m, -5);
        this.chartEndDate = DateHelper.addDays(x, 10);
    }

    renderGridLines() {
        const t = DateHelper.daysBetween(this.chartStartDate, this.chartEndDate) + 1, e = this.rawTasks.length, s = t * this.options.dayWidth, n = e * this.options.rowHeight;
        this.grid.style.width = `${s}px`;
        this.grid.style.height = `${n}px`;
        this.dependencyLayer.setAttribute('width', s);
        this.dependencyLayer.setAttribute('height', n);

        for (let i = 0; i <= t; i++) {
            const r = document.createElement('div');
            r.className = 'grid-line-vertical';
            r.style.left = `${i * this.options.dayWidth}px`;
            this.gridLines.appendChild(r);
        }

        for (let i = 0; i < e; i++) {
            const r = document.createElement('div');
            r.className = 'grid-line-horizontal';
            r.style.top = `${(i + 1) * this.options.rowHeight}px`;
            this.gridLines.appendChild(r)
        }
    }
}

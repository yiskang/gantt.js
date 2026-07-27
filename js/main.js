        // --- Helper Functions ---
        const DateHelper = {
            addDays: (date, days) => {
                const result = new Date(date);
                result.setDate(result.getDate() + days);
                return result;
            },
            daysBetween: (date1, date2) => {
                const startDate = new Date(date1.getFullYear(), date1.getMonth(), date1.getDate());
                const endDate = new Date(date2.getFullYear(), date2.getMonth(), date2.getDate());
                return Math.round((endDate - startDate) / (1000 * 60 * 60 * 24));
            },
            formatDate: date => date.toISOString().split('T')[0],
            isWeekend: date => {
                const day = date.getDay();
                return day === 0 || day === 6; // Sunday or Saturday
            }
        };

        const GuidHelper = {
            generateGuid: () => {
                return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
                    const r = Math.random() * 16 | 0;
                    const v = c == 'x' ? r : (r & 0x3 | 0x8);
                    return v.toString(16);
                });
            }
        };

        // --- Modal Class ---
        class Modal {
            constructor(title, formElement, onSave) {
                this.title = title;
                this.formElement = formElement;
                this.onSave = onSave;
                this.create();
            }

            create() {
                this.overlay = document.createElement('div');
                this.overlay.className = 'modal-overlay';
                this.overlay.addEventListener('click', (e) => {
                    if (e.target === this.overlay) this.hide();
                });

                const container = document.createElement('div');
                container.className = 'modal-container';

                // Create header using DOM API
                const header = document.createElement('div');
                header.className = 'modal-header';

                const headerTitle = document.createElement('h2');
                headerTitle.textContent = this.title;

                const closeBtn = document.createElement('button');
                closeBtn.className = 'modal-close-btn';
                closeBtn.innerHTML = '&times;';

                header.appendChild(headerTitle);
                header.appendChild(closeBtn);

                const content = document.createElement('div');
                content.className = 'modal-content';
                content.appendChild(this.formElement);
                this.form = content;

                // Create footer using DOM API
                const footer = document.createElement('div');
                footer.className = 'modal-footer';

                const cancelBtn = document.createElement('button');
                cancelBtn.className = 'modal-cancel-btn';
                cancelBtn.textContent = 'Cancel';

                const saveBtn = document.createElement('button');
                saveBtn.className = 'modal-save-btn';
                saveBtn.textContent = 'Save';

                footer.appendChild(cancelBtn);
                footer.appendChild(saveBtn);

                container.append(header, content, footer);
                this.overlay.appendChild(container);

                closeBtn.addEventListener('click', () => this.hide());
                cancelBtn.addEventListener('click', () => this.hide());
                saveBtn.addEventListener('click', () => this.handleSave());
            }

            handleSave() {
                const data = {};
                this.form.querySelectorAll('input, select').forEach(input => {
                    if (input.type === 'select-multiple') {
                        data[input.name] = Array.from(input.selectedOptions).map(option => option.value);
                    } else {
                        data[input.name] = input.value;
                    }
                });
                if (this.onSave(data)) this.hide();
            }

            show() { document.body.appendChild(this.overlay); }
            hide() { document.body.removeChild(this.overlay); }
        }

        // --- Task Class ---
        class Task {
            constructor(gantt, data) {
                this.gantt = gantt;
                Object.assign(this, data);
                this.start = new Date(data.start);
                this.end = new Date(data.end);
                this.dependencies = data.dependencies || [];
            }

            render(index) {
                this.y = index * this.gantt.options.rowHeight + this.gantt.options.rowHeight / 2;

                // Create sidebar element using DOM API
                this.sidebarElement = document.createElement('div');
                this.sidebarElement.className = 'gantt-sidebar-row';

                const taskNameSpan = document.createElement('span');
                taskNameSpan.className = 'task-name';
                taskNameSpan.title = 'Double-click to edit';
                taskNameSpan.textContent = this.name;

                const deleteBtn = document.createElement('span');
                deleteBtn.className = 'delete-task-btn';
                deleteBtn.title = 'Delete Task';
                deleteBtn.innerHTML = '&#128465;';

                this.sidebarElement.appendChild(taskNameSpan);
                this.sidebarElement.appendChild(deleteBtn);

                taskNameSpan.addEventListener('dblclick', () => this.gantt.editTask(this.id));
                deleteBtn.addEventListener('click', () => {
                    if (confirm(`Delete task '${this.name}'?`)) this.gantt.deleteTask(this.id);
                });

                this.gantt.sidebar.appendChild(this.sidebarElement);

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
                this.gantt.taskArea.appendChild(this.taskRowElement);

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

            updateProgress(currentDate) {
                let progressPercent;
                if (currentDate < this.start) {
                    progressPercent = 0;
                } else if (currentDate >= this.end) {
                    progressPercent = 100;
                } else {
                    progressPercent = ((currentDate - this.start) / (this.end - this.start)) * 100;
                }
                this.progressElement.style.width = `${progressPercent}%`;
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
        }

        // --- Animation Controller ---
        class AnimationController {
            constructor(gantt, container) {
                this.gantt = gantt;
                this.container = container;
                this.isPlaying = false;
                this.animationFrameId = null;
                this.speed = 1000 / 24; // 24 FPS
                this.lastUpdateTime = 0;
                this.currentTime = new Date(gantt.chartStartDate);
            }

            render() {
                const buttons = [
                    { id: 'prev', title: 'Previous Day' },
                    { id: 'play', title: 'Play' },
                    { id: 'pause', title: 'Pause' },
                    { id: 'stop', title: 'Stop' },
                    { id: 'next', title: 'Next Day' }
                ];

                buttons.forEach(btn => {
                    const button = document.createElement('button');
                    button.id = `btn-${btn.id}`;
                    button.title = btn.title;
                    this.container.appendChild(button);
                });

                this.addEventListeners();
                this.gantt.updateAnimation(this.currentTime);
            }

            addEventListeners() {
                document.getElementById('btn-play').addEventListener('click', () => this.play());
                document.getElementById('btn-pause').addEventListener('click', () => this.pause());
                document.getElementById('btn-stop').addEventListener('click', () => this.stop());
                document.getElementById('btn-next').addEventListener('click', () => this.nextFrame());
                document.getElementById('btn-prev').addEventListener('click', () => this.prevFrame());
            }

            play() {
                if (this.isPlaying) return;
                this.isPlaying = true;

                // Enter animation mode for all tasks
                this.gantt.tasks.forEach(task => task.enterAnimationMode());

                this.lastUpdateTime = performance.now();
                this.animate();
            }

            pause() {
                this.isPlaying = false;
                if (this.animationFrameId) cancelAnimationFrame(this.animationFrameId);
            }

            stop() {
                this.pause();

                // Exit animation mode for all tasks
                this.gantt.tasks.forEach(task => task.exitAnimationMode());

                this.currentTime = new Date(this.gantt.chartStartDate);
                this.gantt.updateAnimation(this.currentTime);
            }

            nextFrame() {
                this.pause();

                // Ensure animation mode is active
                this.gantt.tasks.forEach(task => task.enterAnimationMode());

                this.currentTime = DateHelper.addDays(this.currentTime, 1);
                if (this.currentTime > this.gantt.chartEndDate) {
                    this.currentTime = new Date(this.gantt.chartEndDate);
                }
                this.gantt.updateAnimation(this.currentTime);
            }

            prevFrame() {
                this.pause();

                // Ensure animation mode is active
                this.gantt.tasks.forEach(task => task.enterAnimationMode());

                this.currentTime = DateHelper.addDays(this.currentTime, -1);
                if (this.currentTime < this.gantt.chartStartDate) {
                    this.currentTime = new Date(this.gantt.chartStartDate);
                }
                this.gantt.updateAnimation(this.currentTime);
            }


            reset() {
                this.stop();
                this.gantt.animationProgressLine.classList.remove('show');
            }

            animate(timestamp) {
                if (!this.isPlaying) return;

                this.gantt.animationProgressLine.classList.add('show');

                const elapsed = timestamp - this.lastUpdateTime;
                if (elapsed >= this.speed) {
                    this.currentTime = DateHelper.addDays(this.currentTime, 1);
                    this.gantt.updateAnimation(this.currentTime);
                    this.lastUpdateTime = timestamp;
                }

                if (this.currentTime > this.gantt.chartEndDate) {
                    this.pause();
                } else {
                    this.animationFrameId = requestAnimationFrame(this.animate.bind(this));
                }
            }
        }

        // --- Gantt Chart Class ---
        class GanttChart {
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

                this.tasks = [];
                this.rawTasks.forEach((taskData, index) => {
                    const task = new Task(this, taskData);
                    this.tasks.push(task);
                    task.render(index);
                });

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
                        e.dependencies = e.dependencies.filter(d => d !== t)
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

        // --- Sample Data & Initialization ---
        document.addEventListener('DOMContentLoaded', () => {
            const sampleTasks = [
                { id: '550e8400-e29b-41d4-a716-446655440001', name: 'Phase 1: Planning', start: '2025-08-01', end: '2025-08-07', progress: 100, dependencies: [] },
                { id: '550e8400-e29b-41d4-a716-446655440002', name: 'Market Research', start: '2025-08-04', end: '2025-08-12', progress: 50, dependencies: ['550e8400-e29b-41d4-a716-446655440001'] },
                { id: '550e8400-e29b-41d4-a716-446655440003', name: 'Phase 2: Design', start: '2025-08-13', end: '2025-08-18', progress: 20, dependencies: ['550e8400-e29b-41d4-a716-446655440002'] },
                { id: '550e8400-e29b-41d4-a716-446655440004', name: 'UI/UX Mockups', start: '2025-08-15', end: '2025-08-22', progress: 0, dependencies: ['550e8400-e29b-41d4-a716-446655440003'] },
                { id: '550e8400-e29b-41d4-a716-446655440005', name: 'Phase 3: Development', start: '2025-08-25', end: '2025-10-01', progress: 0, dependencies: ['550e8400-e29b-41d4-a716-446655440004'] },
                { id: '550e8400-e29b-41d4-a716-446655440006', name: 'Backend Development', start: '2025-08-25', end: '2025-09-15', progress: 0, dependencies: ['550e8400-e29b-41d4-a716-446655440004'] },
                { id: '550e8400-e29b-41d4-a716-446655440007', name: 'Frontend Development', start: '2025-09-01', end: '2025-09-25', progress: 0, dependencies: ['550e8400-e29b-41d4-a716-446655440006'] },
                { id: '550e8400-e29b-41d4-a716-446655440008', name: 'Phase 4: Testing & Deploy', start: '2025-10-02', end: '2025-10-15', progress: 0, dependencies: ['550e8400-e29b-41d4-a716-446655440007'] },
                { id: '550e8400-e29b-41d4-a716-446655440009', name: 'New Year Prep', start: '2025-12-28', end: '2026-01-05', progress: 0, dependencies: ['550e8400-e29b-41d4-a716-446655440008'] },
            ];

            const ganttChart = new GanttChart('app-container', sampleTasks);

            // --- **NEW**: Example of a 'Third Party' listener ---
            const eventLog = document.getElementById('event-log');
            let lastLoggedId = null;
            ganttChart.addEventListener('task-active', (eventData) => {
                const activeTask = eventData.task;
                // Only log when the active task changes to avoid flooding the console
                if (activeTask.id !== lastLoggedId) {
                    const logEntry = document.createElement('div');
                    logEntry.textContent = `> Task Active: [${activeTask.id}] ${activeTask.name}`;
                    eventLog.appendChild(logEntry);
                    eventLog.scrollTop = eventLog.scrollHeight; // Auto-scroll
                    lastLoggedId = activeTask.id;
                }
            });

            // Example of adding multiple event listeners
            ganttChart.addEventListener('task-active', (eventData) => {
                console.log('Another listener - Active task:', eventData.task.name, 'at time:', eventData.currentTime);
            });
        });

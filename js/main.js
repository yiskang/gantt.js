// js/main.js
import { GanttChart } from './gantt/index.js';

document.addEventListener('DOMContentLoaded', () => {
    const sampleTasks = [
        { id: '550e8400-e29b-41d4-a716-446655440001', name: 'Phase 1: Planning', start: '2026-07-01', end: '2026-07-07', progress: 100, dependencies: [] },
        { id: '550e8400-e29b-41d4-a716-446655440002', name: 'Market Research', start: '2026-07-04', end: '2026-07-12', progress: 50, dependencies: ['550e8400-e29b-41d4-a716-446655440001'] },
        { id: '550e8400-e29b-41d4-a716-446655440003', name: 'Phase 2: Design', start: '2026-07-13', end: '2026-07-18', progress: 20, dependencies: ['550e8400-e29b-41d4-a716-446655440002'] },
        { id: '550e8400-e29b-41d4-a716-446655440004', name: 'UI/UX Mockups', start: '2026-07-15', end: '2026-07-22', progress: 0, dependencies: ['550e8400-e29b-41d4-a716-446655440003'] },
        { id: '550e8400-e29b-41d4-a716-446655440005', name: 'Phase 3: Development', start: '2026-07-25', end: '2026-08-31', progress: 0, dependencies: ['550e8400-e29b-41d4-a716-446655440004'] },
        { id: '550e8400-e29b-41d4-a716-446655440006', name: 'Backend Development', start: '2026-07-25', end: '2026-08-15', progress: 0, dependencies: ['550e8400-e29b-41d4-a716-446655440004'], parentId: '550e8400-e29b-41d4-a716-446655440005' },
        { id: '550e8400-e29b-41d4-a716-446655440007', name: 'Frontend Development', start: '2026-08-01', end: '2026-08-25', progress: 0, dependencies: ['550e8400-e29b-41d4-a716-446655440006'], parentId: '550e8400-e29b-41d4-a716-446655440005' },
        { id: '550e8400-e29b-41d4-a716-446655440008', name: 'Phase 4: Testing & Deploy', start: '2026-09-01', end: '2026-09-14', progress: 0, dependencies: ['550e8400-e29b-41d4-a716-446655440007'] },
        { id: '550e8400-e29b-41d4-a716-446655440009', name: 'Post-Launch Monitoring', start: '2026-12-28', end: '2027-01-05', progress: 0, dependencies: ['550e8400-e29b-41d4-a716-446655440008'] },
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

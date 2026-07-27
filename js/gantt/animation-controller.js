// js/gantt/animation-controller.js
import { DateHelper } from './utils.js';

export class AnimationController {
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

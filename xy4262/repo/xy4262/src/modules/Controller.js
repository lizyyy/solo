export class Controller {
  constructor(app) {
    this.app = app;
    this.simulation = null;
    
    this.timeline = null;
    this.timelineProgress = null;
    this.timelineMarker = null;
    this.isDragging = false;
    
    this.init();
  }

  init() {
    this.timeline = document.getElementById('timeline');
    this.timelineProgress = document.getElementById('timeline-progress');
    this.timelineMarker = document.getElementById('timeline-marker');
    
    this.setupTimelineEvents();
  }

  setSimulation(simulation) {
    this.simulation = simulation;
    this.updateTimeline();
  }

  setupTimelineEvents() {
    this.timeline.addEventListener('mousedown', (e) => this.onTimelineMouseDown(e));
    document.addEventListener('mousemove', (e) => this.onMouseMove(e));
    document.addEventListener('mouseup', () => this.onMouseUp());
    
    this.timeline.addEventListener('touchstart', (e) => this.onTimelineTouchStart(e), { passive: false });
    document.addEventListener('touchmove', (e) => this.onTouchMove(e), { passive: false });
    document.addEventListener('touchend', () => this.onMouseUp());
  }

  onTimelineMouseDown(e) {
    if (!this.simulation) return;
    
    this.isDragging = true;
    this.simulation.pause();
    this.updateTimelineFromEvent(e);
  }

  onTimelineTouchStart(e) {
    e.preventDefault();
    if (!this.simulation) return;
    
    this.isDragging = true;
    this.simulation.pause();
    this.updateTimelineFromTouch(e.touches[0]);
  }

  onMouseMove(e) {
    if (!this.isDragging) return;
    this.updateTimelineFromEvent(e);
  }

  onTouchMove(e) {
    if (!this.isDragging) return;
    e.preventDefault();
    this.updateTimelineFromTouch(e.touches[0]);
  }

  onMouseUp() {
    this.isDragging = false;
  }

  updateTimelineFromEvent(e) {
    if (!this.simulation || !this.timeline) return;

    const rect = this.timeline.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = Math.max(0, Math.min(1, x / rect.width));
    
    const time = percentage * this.simulation.totalTime;
    this.simulation.seekTo(time);
    this.updateTimeline();
  }

  updateTimelineFromTouch(touch) {
    if (!this.simulation || !this.timeline) return;

    const rect = this.timeline.getBoundingClientRect();
    const x = touch.clientX - rect.left;
    const percentage = Math.max(0, Math.min(1, x / rect.width));
    
    const time = percentage * this.simulation.totalTime;
    this.simulation.seekTo(time);
    this.updateTimeline();
  }

  updateTimeline() {
    if (!this.simulation || this.isDragging) return;

    const percentage = this.simulation.totalTime > 0 
      ? (this.simulation.currentTime / this.simulation.totalTime) * 100 
      : 0;

    if (this.timelineProgress) {
      this.timelineProgress.style.width = `${percentage}%`;
    }

    if (this.timelineMarker) {
      this.timelineMarker.style.left = `${percentage}%`;
    }

    this.updateTimeDisplay();
  }

  updateTimeDisplay() {
    if (!this.simulation) return;

    const currentTime = this.formatTime(this.simulation.currentTime);
    const totalTime = this.formatTime(this.simulation.totalTime);

    const currentEl = document.getElementById('current-time');
    const totalEl = document.getElementById('total-time');
    
    if (currentEl) currentEl.textContent = currentTime;
    if (totalEl) totalEl.textContent = totalTime;
    
    const statCurrentEl = document.getElementById('stat-current-time');
    const statTotalEl = document.getElementById('stat-total-time');
    
    if (statCurrentEl) statCurrentEl.textContent = currentTime;
    if (statTotalEl) statTotalEl.textContent = totalTime;
  }

  formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 1000);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
  }
}

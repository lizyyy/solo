export class TimelineController {
  constructor(options = {}) {
    this.startTime = options.startTime ?? 0;
    this.endTime = options.endTime ?? 10000;
    this.duration = this.endTime - this.startTime;
    
    this.currentTime = this.startTime;
    this.isPlaying = false;
    this.playbackSpeed = options.playbackSpeed ?? 1;
    this.realTimeFactor = options.realTimeFactor ?? 1000;
    
    this.lastFrameTime = 0;
    this.animationFrameId = null;
    
    this.onTimeUpdate = null;
    this.onPlayStateChange = null;
    this.onSpeedChange = null;
  }

  setTimeRange(startTime, endTime) {
    this.startTime = startTime;
    this.endTime = endTime;
    this.duration = endTime - startTime;
    
    if (this.currentTime < startTime) {
      this.currentTime = startTime;
    } else if (this.currentTime > endTime) {
      this.currentTime = endTime;
    }
    
    this.notifyTimeUpdate();
  }

  setCurrentTime(timestamp) {
    const clampedTime = Math.max(this.startTime, Math.min(this.endTime, timestamp));
    
    if (this.currentTime !== clampedTime) {
      this.currentTime = clampedTime;
      this.notifyTimeUpdate();
    }
  }

  setProgress(progress) {
    const timestamp = this.startTime + progress * this.duration;
    this.setCurrentTime(timestamp);
  }

  getProgress() {
    if (this.duration <= 0) return 0;
    return (this.currentTime - this.startTime) / this.duration;
  }

  play() {
    if (this.isPlaying) return;
    
    this.isPlaying = true;
    this.lastFrameTime = performance.now();
    this.startAnimationLoop();
    
    if (this.onPlayStateChange) {
      this.onPlayStateChange(true);
    }
  }

  pause() {
    if (!this.isPlaying) return;
    
    this.isPlaying = false;
    this.stopAnimationLoop();
    
    if (this.onPlayStateChange) {
      this.onPlayStateChange(false);
    }
  }

  toggle() {
    if (this.isPlaying) {
      this.pause();
    } else {
      this.play();
    }
  }

  stop() {
    this.pause();
    this.setCurrentTime(this.startTime);
  }

  setPlaybackSpeed(speed) {
    this.playbackSpeed = Math.max(0.1, Math.min(100, speed));
    
    if (this.onSpeedChange) {
      this.onSpeedChange(this.playbackSpeed);
    }
  }

  stepForward(seconds = 1) {
    const timestamp = this.currentTime + seconds * 1000;
    this.setCurrentTime(timestamp);
  }

  stepBackward(seconds = 1) {
    const timestamp = this.currentTime - seconds * 1000;
    this.setCurrentTime(timestamp);
  }

  goToStart() {
    this.setCurrentTime(this.startTime);
  }

  goToEnd() {
    this.setCurrentTime(this.endTime);
  }

  goToEvent(event) {
    if (event && event.timestamp !== undefined) {
      this.setCurrentTime(event.timestamp);
    }
  }

  startAnimationLoop() {
    const loop = () => {
      if (!this.isPlaying) return;
      
      const currentFrameTime = performance.now();
      const deltaTime = (currentFrameTime - this.lastFrameTime) * this.playbackSpeed * this.realTimeFactor;
      
      this.lastFrameTime = currentFrameTime;
      
      let newTime = this.currentTime + deltaTime;
      
      if (newTime >= this.endTime) {
        newTime = this.endTime;
        this.pause();
      }
      
      this.currentTime = newTime;
      this.notifyTimeUpdate();
      
      this.animationFrameId = requestAnimationFrame(loop);
    };
    
    this.animationFrameId = requestAnimationFrame(loop);
  }

  stopAnimationLoop() {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  notifyTimeUpdate() {
    if (this.onTimeUpdate) {
      this.onTimeUpdate(this.currentTime, this.getProgress());
    }
  }

  formatTimestamp(timestamp) {
    const relativeTime = timestamp - this.startTime;
    const seconds = Math.floor(relativeTime / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    const h = String(hours).padStart(2, '0');
    const m = String(minutes % 60).padStart(2, '0');
    const s = String(seconds % 60).padStart(2, '0');
    
    return `${h}:${m}:${s}`;
  }

  formatAbsoluteTimestamp(timestamp) {
    const date = new Date(timestamp);
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    const ms = String(date.getMilliseconds()).padStart(3, '0');
    
    return `${hours}:${minutes}:${seconds}.${ms}`;
  }

  getState() {
    return {
      startTime: this.startTime,
      endTime: this.endTime,
      duration: this.duration,
      currentTime: this.currentTime,
      progress: this.getProgress(),
      isPlaying: this.isPlaying,
      playbackSpeed: this.playbackSpeed
    };
  }

  setState(state) {
    if (state.startTime !== undefined && state.endTime !== undefined) {
      this.setTimeRange(state.startTime, state.endTime);
    }
    if (state.currentTime !== undefined) {
      this.setCurrentTime(state.currentTime);
    }
    if (state.playbackSpeed !== undefined) {
      this.setPlaybackSpeed(state.playbackSpeed);
    }
    if (state.isPlaying) {
      this.play();
    } else {
      this.pause();
    }
  }

  dispose() {
    this.stopAnimationLoop();
    this.onTimeUpdate = null;
    this.onPlayStateChange = null;
    this.onSpeedChange = null;
  }
}

export default TimelineController;

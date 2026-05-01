export class TimelineController {
  constructor(config = {}) {
    this.startTime = config.startTime || 0;
    this.endTime = config.endTime || 300;
    this.currentTime = config.startTime || 0;
    this.isPlaying = false;
    this.playbackSpeed = config.playbackSpeed || 1;
    this.loop = config.loop || false;
    
    this.callbacks = {
      onTimeChange: [],
      onPlay: [],
      onPause: [],
      onStart: [],
      onEnd: [],
      onSpeedChange: []
    };
    
    this.lastFrameTime = null;
    this.animationId = null;
  }

  setTimeRange(startTime, endTime) {
    this.startTime = startTime;
    this.endTime = endTime;
    if (this.currentTime < this.startTime) {
      this.currentTime = this.startTime;
      this.notifyTimeChange();
    }
    if (this.currentTime > this.endTime) {
      this.currentTime = this.endTime;
      this.notifyTimeChange();
    }
  }

  setCurrentTime(time) {
    const clampedTime = Math.max(this.startTime, Math.min(this.endTime, time));
    if (this.currentTime !== clampedTime) {
      this.currentTime = clampedTime;
      this.notifyTimeChange();
    }
  }

  getCurrentTime() {
    return this.currentTime;
  }

  getProgress() {
    const duration = this.endTime - this.startTime;
    if (duration <= 0) return 0;
    return (this.currentTime - this.startTime) / duration;
  }

  setProgress(progress) {
    const clampedProgress = Math.max(0, Math.min(1, progress));
    const newTime = this.startTime + clampedProgress * (this.endTime - this.startTime);
    this.setCurrentTime(newTime);
  }

  play() {
    if (this.isPlaying) return;
    this.isPlaying = true;
    this.lastFrameTime = performance.now();
    this.notifyPlay();
    this.startAnimationLoop();
  }

  pause() {
    if (!this.isPlaying) return;
    this.isPlaying = false;
    this.notifyPause();
    this.stopAnimationLoop();
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
    this.notifyStart();
  }

  goToEnd() {
    this.setCurrentTime(this.endTime);
    this.notifyEnd();
  }

  stepForward(seconds = 1) {
    this.setCurrentTime(this.currentTime + seconds);
  }

  stepBackward(seconds = 1) {
    this.setCurrentTime(this.currentTime - seconds);
  }

  setSpeed(speed) {
    this.playbackSpeed = Math.max(0.1, speed);
    this.notifySpeedChange();
  }

  getSpeed() {
    return this.playbackSpeed;
  }

  setLoop(loop) {
    this.loop = loop;
  }

  getDuration() {
    return this.endTime - this.startTime;
  }

  on(eventName, callback) {
    if (this.callbacks[eventName]) {
      this.callbacks[eventName].push(callback);
    }
  }

  off(eventName, callback) {
    if (this.callbacks[eventName]) {
      const index = this.callbacks[eventName].indexOf(callback);
      if (index > -1) {
        this.callbacks[eventName].splice(index, 1);
      }
    }
  }

  notifyTimeChange() {
    for (const callback of this.callbacks.onTimeChange) {
      callback(this.currentTime, this.getProgress());
    }
  }

  notifyPlay() {
    for (const callback of this.callbacks.onPlay) {
      callback();
    }
  }

  notifyPause() {
    for (const callback of this.callbacks.onPause) {
      callback();
    }
  }

  notifyStart() {
    for (const callback of this.callbacks.onStart) {
      callback();
    }
  }

  notifyEnd() {
    for (const callback of this.callbacks.onEnd) {
      callback();
    }
  }

  notifySpeedChange() {
    for (const callback of this.callbacks.onSpeedChange) {
      callback(this.playbackSpeed);
    }
  }

  startAnimationLoop() {
    const animate = (currentTime) => {
      if (!this.isPlaying) return;
      
      if (this.lastFrameTime === null) {
        this.lastFrameTime = currentTime;
      }
      
      const deltaTime = (currentTime - this.lastFrameTime) / 1000;
      this.lastFrameTime = currentTime;
      
      const newTime = this.currentTime + deltaTime * this.playbackSpeed;
      
      if (newTime >= this.endTime) {
        if (this.loop) {
          this.setCurrentTime(this.startTime);
          this.lastFrameTime = currentTime;
        } else {
          this.setCurrentTime(this.endTime);
          this.pause();
          this.notifyEnd();
          return;
        }
      } else {
        this.setCurrentTime(newTime);
      }
      
      this.animationId = requestAnimationFrame(animate);
    };
    
    this.animationId = requestAnimationFrame(animate);
  }

  stopAnimationLoop() {
    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
    this.lastFrameTime = null;
  }

  destroy() {
    this.stopAnimationLoop();
    this.callbacks = {
      onTimeChange: [],
      onPlay: [],
      onPause: [],
      onStart: [],
      onEnd: [],
      onSpeedChange: []
    };
  }
}

export default TimelineController;

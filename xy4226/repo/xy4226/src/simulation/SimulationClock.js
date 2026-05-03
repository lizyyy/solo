class SimulationClock {
  constructor() {
    this.startTime = 0;
    this.elapsedTime = 0;
    this.lastUpdateTime = 0;
    this.isRunning = false;
    this.speedMultiplier = 1.0;
    this.pausedTime = 0;
  }

  start() {
    if (this.isRunning) {
      return;
    }
    
    this.isRunning = true;
    this.startTime = performance.now() - (this.elapsedTime * 1000) / this.speedMultiplier;
    this.lastUpdateTime = performance.now();
  }

  pause() {
    if (!this.isRunning) {
      return;
    }
    
    this.isRunning = false;
    this.pausedTime = performance.now();
  }

  resume() {
    if (this.isRunning) {
      return;
    }
    
    const pausedDuration = performance.now() - this.pausedTime;
    this.startTime += pausedDuration;
    this.isRunning = true;
  }

  update(deltaTime) {
    if (!this.isRunning) {
      return;
    }
    
    const now = performance.now();
    const realDelta = (now - this.lastUpdateTime) / 1000;
    
    this.elapsedTime += realDelta * this.speedMultiplier;
    this.lastUpdateTime = now;
  }

  getElapsedTime() {
    return this.elapsedTime;
  }

  getElapsedTimeFormatted() {
    const totalSeconds = Math.floor(this.elapsedTime);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    const milliseconds = Math.floor((this.elapsedTime % 1) * 100);
    
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${milliseconds.toString().padStart(2, '0')}`;
  }

  setTime(timeInSeconds) {
    this.elapsedTime = timeInSeconds;
    if (this.isRunning) {
      this.startTime = performance.now() - (this.elapsedTime * 1000) / this.speedMultiplier;
    }
  }

  setSpeed(multiplier) {
    const wasRunning = this.isRunning;
    
    if (wasRunning) {
      this.pause();
    }
    
    this.speedMultiplier = multiplier;
    
    if (wasRunning) {
      this.resume();
    }
  }

  getSpeed() {
    return this.speedMultiplier;
  }

  reset() {
    this.elapsedTime = 0;
    this.isRunning = false;
    this.speedMultiplier = 1.0;
    this.startTime = 0;
    this.lastUpdateTime = 0;
    this.pausedTime = 0;
  }

  isActive() {
    return this.isRunning;
  }

  getRealTime() {
    return performance.now() / 1000;
  }

  calculateETA(targetTime) {
    if (this.speedMultiplier <= 0) {
      return Infinity;
    }
    
    const remainingTime = targetTime - this.elapsedTime;
    if (remainingTime <= 0) {
      return 0;
    }
    
    return remainingTime / this.speedMultiplier;
  }
}

export default SimulationClock;

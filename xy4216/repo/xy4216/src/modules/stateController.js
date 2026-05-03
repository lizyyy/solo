export class StateController {
  constructor(options = {}) {
    this.isPlaying = false;
    this.playbackSpeed = options.playbackSpeed || 1.0;
    this.currentTime = 0;
    this.startTime = 0;
    this.endTime = 10;
    this.duration = 10;
    
    this.data = {
      forklift: null,
      pedestrian: null,
      warehouse: null,
      riskPoints: []
    };
    
    this.ruleChecker = options.ruleChecker;
    
    this.callbacks = {
      onTimeUpdate: [],
      onPlayStateChange: [],
      onSpeedChange: [],
      onDataLoaded: []
    };
    
    this.animationFrameId = null;
    this.lastUpdateTime = null;
  }

  setData(data) {
    this.data = data;
    
    if (data.forklift && data.forklift.length > 0 && data.pedestrian && data.pedestrian.length > 0) {
      const forkliftTimes = data.forklift.map(d => d.timestamp).sort((a, b) => a - b);
      const pedestrianTimes = data.pedestrian.map(d => d.timestamp).sort((a, b) => a - b);
      
      this.startTime = Math.min(forkliftTimes[0], pedestrianTimes[0]);
      this.endTime = Math.max(forkliftTimes[forkliftTimes.length - 1], pedestrianTimes[pedestrianTimes.length - 1]);
      this.duration = this.endTime - this.startTime;
      this.currentTime = this.startTime;
    }
    
    this._triggerCallbacks('onDataLoaded', this.data);
  }

  play() {
    if (this.isPlaying) return;
    
    this.isPlaying = true;
    this.lastUpdateTime = performance.now();
    this._triggerCallbacks('onPlayStateChange', this.isPlaying);
    this._animate();
  }

  pause() {
    if (!this.isPlaying) return;
    
    this.isPlaying = false;
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    this._triggerCallbacks('onPlayStateChange', this.isPlaying);
  }

  togglePlay() {
    if (this.isPlaying) {
      this.pause();
    } else {
      this.play();
    }
  }

  _animate() {
    if (!this.isPlaying) return;
    
    this.animationFrameId = requestAnimationFrame(() => this._animate());
    
    const now = performance.now();
    const delta = (now - this.lastUpdateTime) / 1000;
    this.lastUpdateTime = now;
    
    const timeIncrement = delta * this.playbackSpeed;
    this.currentTime += timeIncrement;
    
    if (this.currentTime >= this.endTime) {
      this.currentTime = this.endTime;
      this.pause();
    }
    
    this._triggerCallbacks('onTimeUpdate', this.currentTime);
  }

  setTime(time) {
    const clampedTime = Math.max(this.startTime, Math.min(this.endTime, time));
    this.currentTime = clampedTime;
    this._triggerCallbacks('onTimeUpdate', this.currentTime);
  }

  seekTo(time) {
    this.setTime(time);
  }

  rewindToStart() {
    this.setTime(this.startTime);
  }

  forwardToEnd() {
    this.setTime(this.endTime);
  }

  previousFrame() {
    const frameTime = 0.05;
    this.setTime(this.currentTime - frameTime);
  }

  nextFrame() {
    const frameTime = 0.05;
    this.setTime(this.currentTime + frameTime);
  }

  setSpeed(speed) {
    this.playbackSpeed = speed;
    this._triggerCallbacks('onSpeedChange', this.playbackSpeed);
  }

  getPlaybackState() {
    return {
      isPlaying: this.isPlaying,
      currentTime: this.currentTime,
      startTime: this.startTime,
      endTime: this.endTime,
      duration: this.duration,
      speed: this.playbackSpeed,
      progress: this.duration > 0 ? (this.currentTime - this.startTime) / this.duration : 0
    };
  }

  getCurrentPositions() {
    if (!this.ruleChecker) return { forklift: null, pedestrian: null };
    
    const forkliftPoint = this.data.forklift 
      ? this.ruleChecker.getPositionAtTime(this.data.forklift, this.currentTime)
      : null;
    
    const pedestrianPoint = this.data.pedestrian
      ? this.ruleChecker.getPositionAtTime(this.data.pedestrian, this.currentTime)
      : null;
    
    return {
      forklift: forkliftPoint,
      pedestrian: pedestrianPoint
    };
  }

  getDistance() {
    const positions = this.getCurrentPositions();
    if (!positions.forklift || !positions.pedestrian) return null;
    
    return Math.sqrt(
      Math.pow(positions.forklift.x - positions.pedestrian.x, 2) +
      Math.pow(positions.forklift.z - positions.pedestrian.z, 2)
    );
  }

  getCurrentRiskPoints() {
    return this.data.riskPoints.filter(risk => 
      this.currentTime >= risk.startTime && this.currentTime <= risk.endTime
    );
  }

  on(event, callback) {
    if (this.callbacks[event]) {
      this.callbacks[event].push(callback);
    }
  }

  off(event, callback) {
    if (this.callbacks[event]) {
      this.callbacks[event] = this.callbacks[event].filter(cb => cb !== callback);
    }
  }

  _triggerCallbacks(event, data) {
    if (this.callbacks[event]) {
      this.callbacks[event].forEach(callback => callback(data));
    }
  }

  dispose() {
    this.pause();
    this.callbacks = {
      onTimeUpdate: [],
      onPlayStateChange: [],
      onSpeedChange: [],
      onDataLoaded: []
    };
  }
}

export default StateController;

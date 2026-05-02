export class ReplayStateMachine {
  constructor() {
    this.state = {
      status: 'idle',
      currentTime: 0,
      currentIndex: 0,
      speed: 1,
      startTime: null,
      endTime: null,
      duration: 0
    };
    
    this.trackPoints = null;
    this.listeners = new Map();
    this.animationFrameId = null;
    this.lastTimestamp = null;
  }

  initialize(trackPoints) {
    if (!trackPoints || trackPoints.length === 0) {
      throw new Error('轨迹数据不能为空');
    }
    
    this.trackPoints = [...trackPoints];
    this.trackPoints.sort((a, b) => a.timestamp - b.timestamp);
    
    this.state.startTime = this.trackPoints[0].timestamp;
    this.state.endTime = this.trackPoints[this.trackPoints.length - 1].timestamp;
    this.state.duration = this.state.endTime - this.state.startTime;
    this.state.currentTime = this.state.startTime;
    this.state.currentIndex = 0;
    this.state.status = 'ready';
    
    this.emit('initialized', {
      startTime: this.state.startTime,
      endTime: this.state.endTime,
      duration: this.state.duration,
      pointCount: this.trackPoints.length
    });
    
    return this.getState();
  }

  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(callback);
  }

  off(event, callback) {
    if (!this.listeners.has(event)) return;
    
    const callbacks = this.listeners.get(event);
    const index = callbacks.indexOf(callback);
    if (index > -1) {
      callbacks.splice(index, 1);
    }
  }

  emit(event, data) {
    if (!this.listeners.has(event)) return;
    
    for (const callback of this.listeners.get(event)) {
      try {
        callback(data);
      } catch (error) {
        console.error(`Error in ${event} listener:`, error);
      }
    }
  }

  play() {
    if (this.state.status === 'playing') return;
    
    if (this.state.status === 'finished') {
      this.state.currentTime = this.state.startTime;
      this.state.currentIndex = 0;
    }
    
    this.state.status = 'playing';
    this.lastTimestamp = performance.now();
    
    this.emit('play', {
      currentTime: this.state.currentTime,
      currentIndex: this.state.currentIndex
    });
    
    this.startAnimationLoop();
    
    return this.getState();
  }

  pause() {
    if (this.state.status !== 'playing') return;
    
    this.state.status = 'paused';
    
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    
    this.emit('pause', {
      currentTime: this.state.currentTime,
      currentIndex: this.state.currentIndex
    });
    
    return this.getState();
  }

  toggle() {
    if (this.state.status === 'playing') {
      return this.pause();
    } else {
      return this.play();
    }
  }

  seek(time) {
    if (this.state.status === 'idle') return;
    
    const newTime = Math.max(this.state.startTime, Math.min(this.state.endTime, time));
    
    if (newTime === this.state.currentTime) return;
    
    this.state.currentTime = newTime;
    this.state.currentIndex = this.findIndexAtTime(newTime);
    
    this.emit('seek', {
      currentTime: this.state.currentTime,
      currentIndex: this.state.currentIndex,
      currentPoint: this.getCurrentPoint()
    });
    
    return this.getState();
  }

  seekToIndex(index) {
    if (!this.trackPoints || index < 0 || index >= this.trackPoints.length) {
      return;
    }
    
    const point = this.trackPoints[index];
    this.state.currentIndex = index;
    this.state.currentTime = point.timestamp;
    
    if (this.state.status === 'finished') {
      this.state.status = 'ready';
    }
    
    this.emit('seek', {
      currentTime: this.state.currentTime,
      currentIndex: this.state.currentIndex,
      currentPoint: point
    });
    
    return this.getState();
  }

  seekToProgress(progress) {
    if (this.state.duration === 0) return;
    
    const targetTime = this.state.startTime + progress * this.state.duration;
    return this.seek(targetTime);
  }

  setSpeed(speed) {
    if (speed <= 0) {
      throw new Error('播放速度必须大于0');
    }
    
    this.state.speed = speed;
    this.emit('speedChange', { speed: this.state.speed });
    
    return this.getState();
  }

  stepForward(steps = 1) {
    if (!this.trackPoints) return;
    
    const newIndex = Math.min(
      this.trackPoints.length - 1,
      this.state.currentIndex + steps
    );
    
    return this.seekToIndex(newIndex);
  }

  stepBackward(steps = 1) {
    const newIndex = Math.max(0, this.state.currentIndex - steps);
    return this.seekToIndex(newIndex);
  }

  goToStart() {
    return this.seek(this.state.startTime);
  }

  goToEnd() {
    return this.seek(this.state.endTime);
  }

  startAnimationLoop() {
    const loop = (timestamp) => {
      if (this.state.status !== 'playing') return;
      
      if (this.lastTimestamp !== null) {
        const deltaMs = (timestamp - this.lastTimestamp) * this.state.speed;
        const newTime = this.state.currentTime + deltaMs;
        
        if (newTime >= this.state.endTime) {
          this.state.currentTime = this.state.endTime;
          this.state.currentIndex = this.trackPoints.length - 1;
          this.state.status = 'finished';
          
          this.emit('finished', {
            currentTime: this.state.currentTime,
            currentIndex: this.state.currentIndex
          });
          
          return;
        }
        
        this.state.currentTime = newTime;
        this.state.currentIndex = this.findIndexAtTime(newTime);
        
        this.emit('update', {
          currentTime: this.state.currentTime,
          currentIndex: this.state.currentIndex,
          currentPoint: this.getCurrentPoint(),
          progress: this.getProgress()
        });
      }
      
      this.lastTimestamp = timestamp;
      this.animationFrameId = requestAnimationFrame(loop);
    };
    
    this.animationFrameId = requestAnimationFrame(loop);
  }

  findIndexAtTime(targetTime) {
    if (!this.trackPoints || this.trackPoints.length === 0) return 0;
    
    if (targetTime <= this.trackPoints[0].timestamp) return 0;
    if (targetTime >= this.trackPoints[this.trackPoints.length - 1].timestamp) {
      return this.trackPoints.length - 1;
    }
    
    let low = 0;
    let high = this.trackPoints.length - 1;
    
    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      const midTime = this.trackPoints[mid].timestamp;
      
      if (midTime === targetTime) {
        return mid;
      } else if (midTime < targetTime) {
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }
    
    return Math.max(0, high);
  }

  getCurrentPoint() {
    if (!this.trackPoints || this.trackPoints.length === 0) {
      return null;
    }
    
    if (this.state.currentIndex >= this.trackPoints.length - 1) {
      return this.trackPoints[this.trackPoints.length - 1];
    }
    
    const point1 = this.trackPoints[this.state.currentIndex];
    const point2 = this.trackPoints[this.state.currentIndex + 1];
    
    if (point1.timestamp === point2.timestamp) {
      return point1;
    }
    
    const progress = (this.state.currentTime - point1.timestamp) / (point2.timestamp - point1.timestamp);
    const clampedProgress = Math.max(0, Math.min(1, progress));
    
    return this.interpolatePoint(point1, point2, clampedProgress);
  }

  interpolatePoint(point1, point2, progress) {
    const t = progress;
    
    return {
      timestamp: this.lerp(point1.timestamp, point2.timestamp, t),
      latitude: this.lerp(point1.latitude, point2.latitude, t),
      longitude: this.lerp(point1.longitude, point2.longitude, t),
      altitude: this.lerp(point1.altitude, point2.altitude, t),
      speed: this.lerp(point1.speed, point2.speed, t),
      heading: this.lerpAngle(point1.heading, point2.heading, t),
      gimbalPitch: this.lerp(point1.gimbalPitch, point2.gimbalPitch, t),
      gimbalYaw: this.lerpAngle(point1.gimbalYaw, point2.gimbalYaw, t),
      roll: this.lerp(point1.roll, point2.roll, t),
      pitch: this.lerp(point1.pitch, point2.pitch, t),
      isInterpolated: t > 0 && t < 1
    };
  }

  lerp(a, b, t) {
    return a + (b - a) * t;
  }

  lerpAngle(a, b, t) {
    const diff = ((b - a + 180) % 360) - 180;
    return (a + diff * t + 360) % 360;
  }

  getProgress() {
    if (this.state.duration === 0) return 0;
    return (this.state.currentTime - this.state.startTime) / this.state.duration;
  }

  getState() {
    return {
      ...this.state,
      progress: this.getProgress(),
      currentPoint: this.getCurrentPoint()
    };
  }

  isInitialized() {
    return this.state.status !== 'idle';
  }

  isPlaying() {
    return this.state.status === 'playing';
  }

  isPaused() {
    return this.state.status === 'paused';
  }

  isFinished() {
    return this.state.status === 'finished';
  }

  reset() {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    
    this.trackPoints = null;
    this.state = {
      status: 'idle',
      currentTime: 0,
      currentIndex: 0,
      speed: 1,
      startTime: null,
      endTime: null,
      duration: 0
    };
    this.lastTimestamp = null;
    
    this.emit('reset', {});
    
    return this.getState();
  }

  destroy() {
    this.reset();
    this.listeners.clear();
  }
}

export default ReplayStateMachine;

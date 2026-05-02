export class TimelineController {
  constructor(dataLoader) {
    this.dataLoader = dataLoader;
    this.isPlaying = false;
    this.currentTime = 0;
    this.totalDuration = 0;
    this.startTime = null;
    this.endTime = null;
    this.playbackSpeed = 1;
    this.animationFrameId = null;
    this.lastUpdateTime = 0;
    
    this.callbacks = {
      onTimeUpdate: [],
      onPlay: [],
      onPause: [],
      onReset: []
    };
    
    this.initTimeRange();
  }

  initTimeRange() {
    const liftPlan = this.dataLoader.liftPlan;
    if (!liftPlan || liftPlan.length === 0) {
      this.totalDuration = 3600;
      return;
    }
    
    let earliestStart = null;
    let latestEnd = null;
    
    liftPlan.forEach(lift => {
      if (lift.start_time) {
        if (!earliestStart || lift.start_time < earliestStart) {
          earliestStart = lift.start_time;
        }
      }
      if (lift.end_time) {
        if (!latestEnd || lift.end_time > latestEnd) {
          latestEnd = lift.end_time;
        }
      }
    });
    
    if (earliestStart && latestEnd) {
      this.startTime = earliestStart;
      this.endTime = latestEnd;
      this.totalDuration = (latestEnd.getTime() - earliestStart.getTime()) / 1000;
      this.currentTime = 0;
    } else {
      this.totalDuration = 3600;
    }
  }

  on(event, callback) {
    if (this.callbacks[event]) {
      this.callbacks[event].push(callback);
    }
    return this;
  }

  trigger(event, data) {
    if (this.callbacks[event]) {
      this.callbacks[event].forEach(cb => cb(data));
    }
  }

  play() {
    if (this.isPlaying) return;
    
    this.isPlaying = true;
    this.lastUpdateTime = performance.now();
    this.trigger('onPlay', { currentTime: this.currentTime });
    
    this.animate();
  }

  pause() {
    if (!this.isPlaying) return;
    
    this.isPlaying = false;
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    this.trigger('onPause', { currentTime: this.currentTime });
  }

  reset() {
    this.pause();
    this.currentTime = 0;
    this.trigger('onReset', { currentTime: 0 });
    this.trigger('onTimeUpdate', { 
      currentTime: 0,
      totalDuration: this.totalDuration,
      progress: 0
    });
  }

  animate() {
    if (!this.isPlaying) return;
    
    const now = performance.now();
    const deltaTime = (now - this.lastUpdateTime) / 1000;
    this.lastUpdateTime = now;
    
    this.currentTime += deltaTime * this.playbackSpeed;
    
    if (this.currentTime >= this.totalDuration) {
      this.currentTime = this.totalDuration;
      this.pause();
    }
    
    const progress = this.currentTime / this.totalDuration;
    this.trigger('onTimeUpdate', {
      currentTime: this.currentTime,
      totalDuration: this.totalDuration,
      progress: progress,
      dateTime: this.getCurrentDateTime()
    });
    
    this.animationFrameId = requestAnimationFrame(() => this.animate());
  }

  setTime(time) {
    this.currentTime = Math.max(0, Math.min(this.totalDuration, time));
    const progress = this.currentTime / this.totalDuration;
    this.trigger('onTimeUpdate', {
      currentTime: this.currentTime,
      totalDuration: this.totalDuration,
      progress: progress,
      dateTime: this.getCurrentDateTime()
    });
  }

  setProgress(progress) {
    this.setTime(progress * this.totalDuration);
  }

  getCurrentDateTime() {
    if (!this.startTime) {
      const now = new Date();
      now.setSeconds(now.getSeconds() + this.currentTime);
      return now;
    }
    
    const date = new Date(this.startTime.getTime() + this.currentTime * 1000);
    return date;
  }

  getActiveLifts() {
    const liftPlan = this.dataLoader.liftPlan;
    if (!liftPlan) return [];
    
    const currentDateTime = this.getCurrentDateTime();
    const activeLifts = [];
    
    liftPlan.forEach(lift => {
      if (lift.start_time && lift.end_time) {
        if (currentDateTime >= lift.start_time && currentDateTime <= lift.end_time) {
          const progress = this.calculateLiftProgress(lift);
          activeLifts.push({
            lift: lift,
            progress: progress,
            isActive: true
          });
        }
      }
    });
    
    return activeLifts;
  }

  calculateLiftProgress(lift) {
    if (!lift.start_time || !lift.end_time) return 0;
    
    const currentDateTime = this.getCurrentDateTime();
    const totalDuration = lift.end_time.getTime() - lift.start_time.getTime();
    const elapsed = currentDateTime.getTime() - lift.start_time.getTime();
    
    return Math.max(0, Math.min(1, elapsed / totalDuration));
  }

  formatTime(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    if (hours > 0) {
      return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }
    return `${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }

  formatDateTime(date) {
    if (!date) return '';
    
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
  }

  getTimelineMarkers() {
    const markers = [];
    const liftPlan = this.dataLoader.liftPlan;
    
    if (!liftPlan || !this.startTime || !this.endTime) {
      return markers;
    }
    
    const totalRange = this.endTime.getTime() - this.startTime.getTime();
    
    liftPlan.forEach(lift => {
      if (lift.start_time && lift.end_time) {
        const startProgress = (lift.start_time.getTime() - this.startTime.getTime()) / totalRange;
        const endProgress = (lift.end_time.getTime() - this.startTime.getTime()) / totalRange;
        
        markers.push({
          type: 'lift_start',
          lift_id: lift.lift_id,
          lift_name: lift.lift_name,
          progress: startProgress,
          label: `${lift.lift_name} 开始`
        });
        
        markers.push({
          type: 'lift_end',
          lift_id: lift.lift_id,
          lift_name: lift.lift_name,
          progress: endProgress,
          label: `${lift.lift_name} 结束`
        });
      }
    });
    
    return markers;
  }
}

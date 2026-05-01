/**
 * 时间调度系统模块
 * 管理游戏时间推进、患者到达和事件调度
 */

class Scheduler {
  constructor(config = {}) {
    this.tickRate = config.tickRate || 1000;
    this.gameSpeed = config.gameSpeed || 1;
    this.isRunning = false;
    this.isPaused = false;
    this.currentTime = 0;
    this.totalDuration = config.duration || 600;
    this.tickListeners = [];
    this.eventListeners = {};
    this.scheduledEvents = [];
    this.repeatingEvents = [];
    this.intervalId = null;
    this.lastTickTime = null;
  }

  addTickListener(callback) {
    this.tickListeners.push(callback);
  }

  addEventListener(eventType, callback) {
    if (!this.eventListeners[eventType]) {
      this.eventListeners[eventType] = [];
    }
    this.eventListeners[eventType].push(callback);
  }

  removeEventListener(eventType, callback) {
    if (this.eventListeners[eventType]) {
      this.eventListeners[eventType] = this.eventListeners[eventType].filter(
        cb => cb !== callback
      );
    }
  }

  scheduleEvent(time, eventType, data = {}) {
    this.scheduledEvents.push({
      time: time,
      eventType: eventType,
      data: data,
      executed: false
    });
    this.scheduledEvents.sort((a, b) => a.time - b.time);
  }

  scheduleRepeatingEvent(interval, eventType, data = {}) {
    this.repeatingEvents.push({
      interval: interval,
      eventType: eventType,
      data: data,
      lastExecution: 0
    });
  }

  clearScheduledEvents() {
    this.scheduledEvents = [];
    this.repeatingEvents = [];
  }

  start() {
    if (this.isRunning) return;

    this.isRunning = true;
    this.isPaused = false;
    this.lastTickTime = Date.now();
    this.notifyEvent('start', { time: this.currentTime });
    this.runLoop();
  }

  pause() {
    if (!this.isRunning || this.isPaused) return;

    this.isPaused = true;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.notifyEvent('pause', { time: this.currentTime });
  }

  resume() {
    if (!this.isRunning || !this.isPaused) return;

    this.isPaused = false;
    this.lastTickTime = Date.now();
    this.notifyEvent('resume', { time: this.currentTime });
    this.runLoop();
  }

  stop() {
    this.isRunning = false;
    this.isPaused = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.notifyEvent('stop', { time: this.currentTime });
  }

  reset() {
    this.stop();
    this.currentTime = 0;
    this.scheduledEvents.forEach(event => event.executed = false);
    this.repeatingEvents.forEach(event => event.lastExecution = 0);
  }

  runLoop() {
    if (this.intervalId) return;

    this.intervalId = setInterval(() => {
      if (!this.isRunning || this.isPaused) {
        return;
      }

      const now = Date.now();
      const deltaRealTime = (now - this.lastTickTime) / 1000;
      this.lastTickTime = now;

      const deltaGameTime = deltaRealTime * this.gameSpeed;
      this.tick(deltaGameTime);
    }, this.tickRate);
  }

  tick(deltaTime) {
    const previousTime = this.currentTime;
    this.currentTime += deltaTime;

    if (this.currentTime >= this.totalDuration) {
      this.currentTime = this.totalDuration;
      this.notifyEvent('timeUp', { time: this.currentTime });
      this.stop();
      return;
    }

    this.checkScheduledEvents(previousTime, this.currentTime);
    this.checkRepeatingEvents(this.currentTime);
    this.notifyTick(deltaTime);
  }

  checkScheduledEvents(previousTime, currentTime) {
    for (const event of this.scheduledEvents) {
      const shouldExecute = !event.executed && 
        (previousTime === 0 
          ? event.time <= currentTime 
          : event.time > previousTime && event.time <= currentTime);
      
      if (shouldExecute) {
        event.executed = true;
        this.notifyEvent(event.eventType, {
          ...event.data,
          scheduledTime: event.time,
          actualTime: currentTime
        });
      }
    }
  }

  checkRepeatingEvents(currentTime) {
    for (const event of this.repeatingEvents) {
      if (currentTime - event.lastExecution >= event.interval) {
        event.lastExecution = currentTime;
        this.notifyEvent(event.eventType, {
          ...event.data,
          time: currentTime
        });
      }
    }
  }

  notifyTick(deltaTime) {
    this.tickListeners.forEach(callback => {
      try {
        callback(this.currentTime, deltaTime);
      } catch (error) {
        console.error('Tick listener error:', error);
      }
    });
  }

  notifyEvent(eventType, data) {
    const listeners = this.eventListeners[eventType];
    if (listeners) {
      listeners.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`Event listener error (${eventType}):`, error);
        }
      });
    }
  }

  setGameSpeed(speed) {
    this.gameSpeed = Math.max(0.1, Math.min(10, speed));
    this.notifyEvent('speedChange', { speed: this.gameSpeed });
  }

  getGameSpeed() {
    return this.gameSpeed;
  }

  getCurrentTime() {
    return this.currentTime;
  }

  getRemainingTime() {
    return Math.max(0, this.totalDuration - this.currentTime);
  }

  getProgress() {
    return this.currentTime / this.totalDuration;
  }

  formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  getFormattedCurrentTime() {
    return this.formatTime(this.currentTime);
  }

  getFormattedRemainingTime() {
    return this.formatTime(this.getRemainingTime());
  }

  toJSON() {
    return {
      currentTime: this.currentTime,
      totalDuration: this.totalDuration,
      gameSpeed: this.gameSpeed,
      isRunning: this.isRunning,
      isPaused: this.isPaused,
      scheduledEvents: this.scheduledEvents.map(e => ({
        ...e,
        executed: e.executed
      })),
      repeatingEvents: this.repeatingEvents.map(e => ({
        ...e,
        lastExecution: e.lastExecution
      }))
    };
  }

  fromJSON(data) {
    this.currentTime = data.currentTime || 0;
    this.totalDuration = data.totalDuration || 600;
    this.gameSpeed = data.gameSpeed || 1;
    this.isRunning = false;
    this.isPaused = false;

    if (data.scheduledEvents) {
      this.scheduledEvents = data.scheduledEvents.map(e => ({
        ...e
      }));
    }

    if (data.repeatingEvents) {
      this.repeatingEvents = data.repeatingEvents.map(e => ({
        ...e
      }));
    }
  }
}

export { Scheduler };

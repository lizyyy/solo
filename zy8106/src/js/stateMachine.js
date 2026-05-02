import { GAME_STATES, MAX_HISTORY_LENGTH } from './constants.js';
import { deepClone } from './utils.js';

class StateMachine {
  constructor() {
    this.state = GAME_STATES.IDLE;
    this.currentLevelId = null;
    this.tasks = [];
    this.schedule = {};
    this.channels = 0;
    this.slots = 0;
    this.battery = 100;
    this.score = 0;
    
    this.history = [];
    this.historyIndex = -1;
    this.listeners = new Map();
  }

  init(level) {
    this.currentLevelId = level.id;
    this.channels = level.channels;
    this.slots = level.slots;
    this.battery = level.initialBattery || 100;
    this.tasks = deepClone(level.tasks);
    this.schedule = {};
    this.score = 0;
    
    this.history = [];
    this.historyIndex = -1;
    
    this.saveHistoryPoint();
    
    this.state = GAME_STATES.PLAYING;
    this.emit('init', { level: deepClone(level) });
    
    return this.getState();
  }

  getState() {
    return {
      state: this.state,
      currentLevelId: this.currentLevelId,
      tasks: deepClone(this.tasks),
      schedule: deepClone(this.schedule),
      channels: this.channels,
      slots: this.slots,
      battery: this.battery,
      score: this.score,
      canUndo: this.historyIndex > 0,
      canRedo: this.historyIndex < this.history.length - 1
    };
  }

  scheduleTask(taskId, channel, slot) {
    if (this.state !== GAME_STATES.PLAYING) {
      throw new Error('游戏未处于可操作状态');
    }
    
    const task = this.tasks.find(t => t.id === taskId);
    if (!task) {
      throw new Error('任务不存在');
    }
    
    if (channel < 0 || channel >= this.channels) {
      throw new Error('频道索引无效');
    }
    
    if (slot < 0 || slot >= this.slots) {
      throw new Error('时隙索引无效');
    }
    
    const existingTask = this.getTaskAt(channel, slot);
    if (existingTask) {
      throw new Error('该位置已有任务');
    }
    
    this.saveHistoryPoint();
    
    if (task.scheduled) {
      const { channel: oldChannel, slot: oldSlot } = task.scheduled;
      const scheduleKey = this.getScheduleKey(oldChannel, oldSlot);
      delete this.schedule[scheduleKey];
    }
    
    const scheduleKey = this.getScheduleKey(channel, slot);
    this.schedule[scheduleKey] = taskId;
    task.scheduled = { channel, slot };
    
    this.emit('scheduleTask', {
      taskId,
      task: deepClone(task),
      channel,
      slot
    });
    
    return this.getState();
  }

  unscheduleTask(taskId) {
    if (this.state !== GAME_STATES.PLAYING) {
      throw new Error('游戏未处于可操作状态');
    }
    
    const task = this.tasks.find(t => t.id === taskId);
    if (!task || !task.scheduled) {
      throw new Error('任务不存在或未被调度');
    }
    
    this.saveHistoryPoint();
    
    const { channel, slot } = task.scheduled;
    const scheduleKey = this.getScheduleKey(channel, slot);
    delete this.schedule[scheduleKey];
    task.scheduled = null;
    
    this.emit('unscheduleTask', {
      taskId,
      task: deepClone(task),
      channel,
      slot
    });
    
    return this.getState();
  }

  moveTask(taskId, newChannel, newSlot) {
    const task = this.tasks.find(t => t.id === taskId);
    if (!task || !task.scheduled) {
      throw new Error('任务不存在或未被调度');
    }
    
    this.saveHistoryPoint();
    
    const { channel: oldChannel, slot: oldSlot } = task.scheduled;
    const oldKey = this.getScheduleKey(oldChannel, oldSlot);
    const newKey = this.getScheduleKey(newChannel, newSlot);
    
    const targetTask = this.getTaskAt(newChannel, newSlot);
    if (targetTask) {
      this.schedule[oldKey] = targetTask.id;
      const targetTaskObj = this.tasks.find(t => t.id === targetTask.id);
      if (targetTaskObj) {
        targetTaskObj.scheduled = { channel: oldChannel, slot: oldSlot };
      }
    } else {
      delete this.schedule[oldKey];
    }
    
    this.schedule[newKey] = taskId;
    task.scheduled = { channel: newChannel, slot: newSlot };
    
    this.emit('moveTask', {
      taskId,
      oldChannel,
      oldSlot,
      newChannel,
      newSlot
    });
    
    return this.getState();
  }

  clearAll() {
    if (this.state !== GAME_STATES.PLAYING) {
      throw new Error('游戏未处于可操作状态');
    }
    
    this.saveHistoryPoint();
    
    this.schedule = {};
    this.tasks.forEach(task => {
      task.scheduled = null;
    });
    
    this.emit('clearAll', {});
    
    return this.getState();
  }

  getTaskAt(channel, slot) {
    const scheduleKey = this.getScheduleKey(channel, slot);
    const taskId = this.schedule[scheduleKey];
    if (!taskId) return null;
    
    const task = this.tasks.find(t => t.id === taskId);
    return task ? deepClone(task) : null;
  }

  getScheduleKey(channel, slot) {
    return `${channel}-${slot}`;
  }

  parseScheduleKey(key) {
    const [channel, slot] = key.split('-').map(Number);
    return { channel, slot };
  }

  saveHistoryPoint() {
    const snapshot = {
      tasks: deepClone(this.tasks),
      schedule: deepClone(this.schedule),
      battery: this.battery,
      score: this.score
    };
    
    if (this.historyIndex < this.history.length - 1) {
      this.history = this.history.slice(0, this.historyIndex + 1);
    }
    
    this.history.push(snapshot);
    
    if (this.history.length > MAX_HISTORY_LENGTH) {
      this.history.shift();
    } else {
      this.historyIndex = this.history.length - 1;
    }
  }

  undo() {
    if (this.historyIndex <= 0) {
      return null;
    }
    
    this.historyIndex--;
    const snapshot = this.history[this.historyIndex];
    this.tasks = deepClone(snapshot.tasks);
    this.schedule = deepClone(snapshot.schedule);
    this.battery = snapshot.battery;
    this.score = snapshot.score;
    
    this.emit('undo', { state: this.getState() });
    
    return this.getState();
  }

  redo() {
    if (this.historyIndex >= this.history.length - 1) {
      return null;
    }
    
    this.historyIndex++;
    const snapshot = this.history[this.historyIndex];
    this.tasks = deepClone(snapshot.tasks);
    this.schedule = deepClone(snapshot.schedule);
    this.battery = snapshot.battery;
    this.score = snapshot.score;
    
    this.emit('redo', { state: this.getState() });
    
    return this.getState();
  }

  canUndo() {
    return this.historyIndex > 0;
  }

  canRedo() {
    return this.historyIndex < this.history.length - 1;
  }

  setScore(score) {
    this.score = score;
    this.emit('scoreChange', { score });
  }

  setBattery(battery) {
    this.battery = battery;
    this.emit('batteryChange', { battery });
  }

  complete() {
    this.state = GAME_STATES.COMPLETED;
    this.emit('complete', { state: this.getState() });
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
    
    this.listeners.get(event).forEach(callback => {
      try {
        callback(data);
      } catch (error) {
        console.error(`事件监听器错误 [${event}]:`, error);
      }
    });
  }
}

export const stateMachine = new StateMachine();
export default StateMachine;

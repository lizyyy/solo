export const DEDUCTION_TYPES = {
  TIMEOUT: 'timeout',
  MISPLACED: 'misplaced',
  DANGER: 'danger',
  MISSING: 'missing',
};

export const DEDUCTION_NAMES = {
  [DEDUCTION_TYPES.TIMEOUT]: '超时',
  [DEDUCTION_TYPES.MISPLACED]: '错位',
  [DEDUCTION_TYPES.DANGER]: '危险占道',
  [DEDUCTION_TYPES.MISSING]: '遗漏动作',
};

export const DEDUCTION_POINTS = {
  [DEDUCTION_TYPES.TIMEOUT]: 10,
  [DEDUCTION_TYPES.MISPLACED]: 5,
  [DEDUCTION_TYPES.DANGER]: 15,
  [DEDUCTION_TYPES.MISSING]: 20,
};

export class GameEngine {
  constructor(levelData) {
    this.levelData = levelData;
    this.score = 100;
    this.actions = [];
    this.deductions = [];
    this.currentTime = 0;
    this.isRunning = false;
    this.startTime = null;
    this.replayData = [];
    this.stageItems = {
      curtains: [],
      props: [],
      lights: [],
    };
    this.completedEvents = [];
    this.listeners = {};
  }

  on(event, callback) {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event].push(callback);
  }

  emit(event, data) {
    if (this.listeners[event]) {
      this.listeners[event].forEach(cb => cb(data));
    }
  }

  start() {
    this.isRunning = true;
    this.startTime = Date.now();
    this.emit('start');
    this.runTimeline();
  }

  pause() {
    this.isRunning = false;
    this.emit('pause');
  }

  stop() {
    this.isRunning = false;
    this.emit('stop');
  }

  async runTimeline() {
    const timeline = this.levelData.timeline || [];
    let eventIndex = 0;

    while (this.isRunning && eventIndex < timeline.length) {
      const event = timeline[eventIndex];
      const targetTime = event.time;
      
      while (this.isRunning && this.currentTime < targetTime) {
        await this.wait(100);
        this.currentTime = (Date.now() - this.startTime) / 1000;
        this.emit('timeUpdate', this.currentTime);
      }

      if (!this.isRunning) break;

      this.emit('eventStart', event);
      
      const eventResult = await this.waitForEventCompletion(event);
      
      if (eventResult.success) {
        this.completedEvents.push(eventIndex);
        this.emit('eventComplete', { event, success: true });
      } else {
        this.emit('eventComplete', { event, success: false, reason: eventResult.reason });
      }

      eventIndex++;
    }

    if (this.isRunning) {
      this.isRunning = false;
      this.emit('gameOver');
    }
  }

  wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async waitForEventCompletion(event) {
    const deadline = this.currentTime + (event.duration || 10);
    const requiredItems = event.requiredItems || [];
    
    while (this.isRunning && this.currentTime < deadline) {
      await this.wait(100);
      this.currentTime = (Date.now() - this.startTime) / 1000;
      this.emit('timeUpdate', this.currentTime);
      
      if (this.checkEventRequirements(event)) {
        return { success: true };
      }
    }

    const missingItems = this.getMissingItems(event);
    
    if (missingItems.length > 0) {
      this.addDeduction(
        DEDUCTION_TYPES.MISSING,
        `遗漏动作: ${missingItems.map(i => i.name).join(', ')}`,
        this.currentTime
      );
    }

    const misplacedItems = this.getMisplacedItems(event);
    if (misplacedItems.length > 0) {
      misplacedItems.forEach(item => {
        this.addDeduction(
          DEDUCTION_TYPES.MISPLACED,
          `错位: ${item.name} 位置不正确`,
          this.currentTime
        );
      });
    }

    return { 
      success: false, 
      reason: '超时或未完成要求' 
    };
  }

  checkEventRequirements(event) {
    const requiredItems = event.requiredItems || [];
    
    for (const req of requiredItems) {
      const item = this.findItem(req.type, req.id);
      if (!item) return false;
      
      if (req.targetZone) {
        if (!this.isInZone(item, req.targetZone)) {
          return false;
        }
      }
      
      if (req.state !== undefined && item.state !== req.state) {
        return false;
      }
    }
    
    return true;
  }

  getMissingItems(event) {
    const requiredItems = event.requiredItems || [];
    const missing = [];
    
    for (const req of requiredItems) {
      const item = this.findItem(req.type, req.id);
      if (!item) {
        missing.push(req);
      } else if (req.targetZone && !this.isInZone(item, req.targetZone)) {
        missing.push(req);
      }
    }
    
    return missing;
  }

  getMisplacedItems(event) {
    const requiredItems = event.requiredItems || [];
    const misplaced = [];
    
    for (const req of requiredItems) {
      const item = this.findItem(req.type, req.id);
      if (item && req.targetZone && !this.isInZone(item, req.targetZone)) {
        misplaced.push({ ...req, name: item.name || req.id });
      }
    }
    
    return misplaced;
  }

  findItem(type, id) {
    const items = this.stageItems[type] || [];
    return items.find(i => i.id === id);
  }

  isInZone(item, zone) {
    if (!item || !zone) return true;
    
    const { x, y, width = 60, height = 60 } = item;
    const itemCenterX = x + width / 2;
    const itemCenterY = y + height / 2;
    
    return (
      itemCenterX >= zone.x &&
      itemCenterX <= zone.x + zone.width &&
      itemCenterY >= zone.y &&
      itemCenterY <= zone.y + zone.height
    );
  }

  addItem(type, item) {
    if (!this.stageItems[type]) {
      this.stageItems[type] = [];
    }
    this.stageItems[type].push({ ...item, addedAt: this.currentTime });
    
    this.replayData.push({
      action: 'add',
      type,
      item: { ...item },
      timestamp: this.currentTime,
    });
    
    this.emit('itemAdded', { type, item });
  }

  moveItem(type, itemId, newX, newY) {
    const item = this.findItem(type, itemId);
    if (!item) return;
    
    const oldX = item.x;
    const oldY = item.y;
    
    item.x = newX;
    item.y = newY;
    
    this.actions.push({
      type: 'move',
      target: itemId,
      itemType: type,
      x: newX,
      y: newY,
      oldX,
      oldY,
      timestamp: this.currentTime,
    });
    
    this.replayData.push({
      action: 'move',
      type,
      itemId,
      x: newX,
      y: newY,
      timestamp: this.currentTime,
    });
    
    this.checkDangerZones(item, type);
    
    this.emit('itemMoved', { type, itemId, x: newX, y: newY });
  }

  removeItem(type, itemId) {
    if (!this.stageItems[type]) return;
    
    const index = this.stageItems[type].findIndex(i => i.id === itemId);
    if (index === -1) return;
    
    const item = this.stageItems[type][index];
    this.stageItems[type].splice(index, 1);
    
    this.replayData.push({
      action: 'remove',
      type,
      itemId,
      timestamp: this.currentTime,
    });
    
    this.emit('itemRemoved', { type, itemId, item });
  }

  checkDangerZones(item, itemType) {
    const stageConfig = this.levelData.stageConfig || {};
    const dangerZones = stageConfig.dangerZones || [];
    
    for (const zone of dangerZones) {
      if (this.isInZone(item, zone)) {
        this.addDeduction(
          DEDUCTION_TYPES.DANGER,
          `危险占道: ${item.name || item.id} 进入危险区域 ${zone.name}`,
          this.currentTime
        );
      }
    }
  }

  addDeduction(type, description, timestamp) {
    const points = DEDUCTION_POINTS[type] || 0;
    this.score = Math.max(0, this.score - points);
    
    const deduction = {
      type,
      description,
      points,
      timestamp: timestamp || this.currentTime,
    };
    
    this.deductions.push(deduction);
    this.emit('deduction', deduction);
  }

  getResults() {
    return {
      score: this.score,
      actions: this.actions,
      deductions: this.deductions,
      replayData: this.replayData,
      startTime: this.startTime ? new Date(this.startTime).toISOString() : null,
      endTime: new Date().toISOString(),
      completedEvents: this.completedEvents,
    };
  }

  getCurrentEvent() {
    const timeline = this.levelData.timeline || [];
    for (let i = 0; i < timeline.length; i++) {
      if (this.currentTime >= timeline[i].time && 
          this.currentTime < timeline[i].time + (timeline[i].duration || 10)) {
        return { ...timeline[i], index: i };
      }
    }
    return null;
  }
}

export default GameEngine;

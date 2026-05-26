export const TICK_SECONDS = 1;

export const GAME_DURATION_MINUTES = 1440;

export const EVAPORATOR_COUNT = 3;

export const ZONE_TARGETS = {
  A: { min: -25, max: -18, label: 'A区 (冷冻)' },
  B: { min: -15, max: -8, label: 'B区 (冷藏)' },
  C: { min: 2, max: 8, label: 'C区 (恒温)' }
};

export const AMBIENT_TEMP = 25;

export const COOLING_RATE = 0.8;
export const WARMING_RATE = 0.15;
export const DEFROST_WARMING_RATE = 0.6;
export const DOOR_OPEN_WARMING_RATE = 0.3;

export const DEFROST_DURATION_MIN = 5;
export const DEFROST_DURATION_MAX = 60;
export const DEFROST_COOLDOWN = 30;
export const DEFROST_INTERVAL_RECOMMENDED = 180;

export const SCORE = {
  TEMP_OK_PER_MIN: 2,
  TASK_ON_TIME: 100,
  DEFROST_TIMELY: 50,
  TEMP_OVER_PER_DEGREE_MIN: -3,
  TASK_DELAY_PER_MIN: -50,
  DEFROST_TIMEOUT: -100,
  ENERGY_WASTE: -20,
  MISSING_DEFROST: -80
};

export class Evaporator {
  constructor(id, zone) {
    this.id = id;
    this.zone = zone;
    this.status = 'cooling';
    this.defrostStart = null;
    this.defrostEnd = null;
    this.cooldownUntil = 0;
    this.lastDefrost = 0;
    this.efficiency = 1.0;
  }

  isDefrosting(gameTime) {
    return this.status === 'defrosting'
      && this.defrostStart !== null
      && gameTime >= this.defrostStart
      && (this.defrostEnd === null || gameTime < this.defrostEnd);
  }

  startDefrost(gameTime, duration) {
    this.status = 'defrosting';
    this.defrostStart = gameTime;
    this.defrostEnd = gameTime + duration;
  }

  completeDefrost(gameTime) {
    this.status = 'cooling';
    this.lastDefrost = gameTime;
    this.cooldownUntil = gameTime + DEFROST_COOLDOWN;
    this.efficiency = 1.0;
    this.defrostStart = null;
    this.defrostEnd = null;
  }
}

export class Zone {
  constructor(id) {
    this.id = id;
    this.target = ZONE_TARGETS[id];
    this.temp = (this.target.min + this.target.max) / 2;
    this.doorOpen = false;
    this.assignedEvaporator = null;
  }
}

export class Task {
  constructor(config) {
    this.id = config.id;
    this.name = config.name;
    this.type = config.type;
    this.zone = config.zone;
    this.windowStart = config.windowStart;
    this.windowEnd = config.windowEnd;
    this.duration = config.duration;
    this.status = 'pending';
    this.startedAt = null;
    this.completedAt = null;
  }

  isInWindow(gameTime) {
    return gameTime >= this.windowStart && gameTime <= this.windowEnd;
  }

  isOverdue(gameTime) {
    return gameTime > this.windowEnd && this.status !== 'completed';
  }
}

export class DefrostSchedule {
  constructor(config) {
    this.id = config.id;
    this.evaporatorId = config.evaporatorId;
    this.start = config.start;
    this.duration = config.duration;
    this.conflict = false;
  }

  get end() {
    return this.start + this.duration;
  }
}

export class GameState {
  constructor(levelConfig) {
    this.levelConfig = levelConfig;
    this.gameTime = 0;
    this.paused = false;
    this.finished = false;
    this.gameOver = false;
    this.failureReason = null;
    this.score = 0;
    this.scoreBreakdown = {
      tempOk: 0,
      taskOnTime: 0,
      defrostTimely: 0,
      tempOver: 0,
      taskDelay: 0,
      defrostTimeout: 0,
      energyWaste: 0,
      missingDefrost: 0
    };
    this.zones = {};
    this.evaporators = {};
    this.tasks = [];
    this.defrostSchedules = [];
    this.events = [];
    this.tempHistory = {};
    this.nextDefrostId = 1;
    this._initZones();
    this._initEvaporators();
    this._initTasks();
    this._initDefrostSchedules();
  }

  _initZones() {
    for (const id of Object.keys(ZONE_TARGETS)) {
      this.zones[id] = new Zone(id);
      this.tempHistory[id] = [];
    }
  }

  _initEvaporators() {
    const zones = Object.keys(ZONE_TARGETS);
    for (let i = 0; i < zones.length; i++) {
      const evap = new Evaporator(i + 1, zones[i]);
      this.evaporators[evap.id] = evap;
      this.zones[zones[i]].assignedEvaporator = evap.id;
    }
  }

  _initTasks() {
    this.tasks = (this.levelConfig.tasks || []).map(t => new Task(t));
  }

  _initDefrostSchedules() {
    this.defrostSchedules = (this.levelConfig.initialDefrosts || []).map(
      d => new DefrostSchedule({ ...d, id: this.nextDefrostId++ })
    );
  }

  addEvent(level, msg) {
    this.events.push({
      time: this.gameTime,
      level,
      msg
    });
    if (this.events.length > 500) {
      this.events.shift();
    }
  }

  recordTemp() {
    for (const id of Object.keys(this.zones)) {
      this.tempHistory[id].push({
        t: this.gameTime,
        temp: this.zones[id].temp
      });
      if (this.tempHistory[id].length > 2000) {
        this.tempHistory[id].shift();
      }
    }
  }

  getEvaporatorForZone(zoneId) {
    const zone = this.zones[zoneId];
    return zone ? this.evaporators[zone.assignedEvaporator] : null;
  }

  getActiveTasks() {
    return this.tasks.filter(t => t.status === 'active' || t.status === 'delayed');
  }

  getPendingTasks() {
    return this.tasks.filter(t => t.status === 'pending');
  }

  getZoneTempStatus(zoneId) {
    const zone = this.zones[zoneId];
    if (!zone) return 'unknown';
    if (zone.temp > zone.target.max) return 'over';
    if (zone.temp < zone.target.min) return 'under';
    if (zone.temp > zone.target.max - 2) return 'near-high';
    if (zone.temp < zone.target.min + 2) return 'near-low';
    return 'ok';
  }
}
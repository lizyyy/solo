export const GameState = {
  IDLE: 'idle',
  RUNNING: 'running',
  PAUSED: 'paused',
  FAILED: 'failed',
  FINISHED: 'finished'
};

export const FailureReason = {
  TIME_EXHAUSTED: 'time_exhausted',
  SCORE_TOO_LOW: 'score_too_low',
  CRITICAL_FAILURE: 'critical_failure'
};

export class Buffer {
  constructor(capacity, initialItems = 0) {
    this.capacity = capacity;
    this.items = Math.min(Math.max(0, initialItems), capacity);
  }

  isEmpty() {
    return this.items === 0;
  }

  isFull() {
    return this.items >= this.capacity;
  }

  getFillRatio() {
    return this.items / this.capacity;
  }

  addItem() {
    if (!this.isFull()) {
      this.items++;
      return true;
    }
    return false;
  }

  removeItem() {
    if (!this.isEmpty()) {
      this.items--;
      return true;
    }
    return false;
  }
}

export class Workstation {
  constructor(id, name, baseCycleTime, minCycleTime, maxCycleTime) {
    this.id = id;
    this.name = name;
    this.cycleTime = baseCycleTime;
    this.baseCycleTime = baseCycleTime;
    this.minCycleTime = minCycleTime;
    this.maxCycleTime = maxCycleTime;
    this.isWorking = false;
    this.progress = 0;
    this.hasProduct = false;
  }

  setCycleTime(newTime) {
    this.cycleTime = Math.max(this.minCycleTime, Math.min(this.maxCycleTime, newTime));
    if (this.isWorking) {
      this.progress = Math.min(this.progress, this.cycleTime - 0.01);
    }
  }

  canDecreaseCycleTime() {
    return this.cycleTime > this.minCycleTime;
  }

  canIncreaseCycleTime() {
    return this.cycleTime < this.maxCycleTime;
  }

  decreaseCycleTime() {
    if (this.canDecreaseCycleTime()) {
      this.setCycleTime(this.cycleTime - 1);
      return true;
    }
    return false;
  }

  increaseCycleTime() {
    if (this.canIncreaseCycleTime()) {
      this.setCycleTime(this.cycleTime + 1);
      return true;
    }
    return false;
  }

  startWorking() {
    if (!this.isWorking) {
      this.isWorking = true;
      this.progress = 0;
    }
  }

  tick(deltaTime) {
    if (this.isWorking) {
      this.progress += deltaTime;
      if (this.progress >= this.cycleTime) {
        this.progress = this.cycleTime;
        return true;
      }
    }
    return false;
  }

  finishWork() {
    this.isWorking = false;
    this.progress = 0;
    this.hasProduct = true;
  }

  releaseProduct() {
    this.hasProduct = false;
  }
}

export class ScoreRecord {
  constructor(time, action, scoreChange, reason, bufferId) {
    this.time = time;
    this.action = action;
    this.scoreChange = scoreChange;
    this.reason = reason;
    this.bufferId = bufferId;
  }
}

export class GameHistoryEntry {
  constructor(
    timestamp,
    workstations,
    buffers,
    score,
    timeLeft,
    productsCompleted,
    scoreRecords
  ) {
    this.timestamp = timestamp;
    this.workstations = JSON.parse(JSON.stringify(workstations));
    this.buffers = JSON.parse(JSON.stringify(buffers));
    this.score = score;
    this.timeLeft = timeLeft;
    this.productsCompleted = productsCompleted;
    this.scoreRecords = JSON.parse(JSON.stringify(scoreRecords));
  }
}

import {
  GameState,
  FailureReason,
  Buffer,
  Workstation,
  ScoreRecord,
  GameHistoryEntry
} from './game.js';

export class GameConfiguration {
  constructor() {
    this.totalTime = 120;
    this.startingScore = 1000;
    this.minScore = -500;
    this.scorePerProduct = 50;
    this.fullBufferPenalty = 10;
    this.emptyBufferPenalty = 10;
    this.penaltyInterval = 1;
    this.targetProducts = 20;
    this.buffers = [
      { id: 'b1', capacity: 8, initialItems: 4 },
      { id: 'b2', capacity: 8, initialItems: 2 },
      { id: 'b3', capacity: 8, initialItems: 0 }
    ];
    this.workstations = [
      { id: 'ws1', name: '工位A', baseCycleTime: 4, minCycleTime: 2, maxCycleTime: 8, inputBuffer: 'infinite', outputBuffer: 'b1' },
      { id: 'ws2', name: '工位B', baseCycleTime: 5, minCycleTime: 2, maxCycleTime: 8, inputBuffer: 'b1', outputBuffer: 'b2' },
      { id: 'ws3', name: '工位C', baseCycleTime: 6, minCycleTime: 2, maxCycleTime: 8, inputBuffer: 'b2', outputBuffer: 'b3' },
      { id: 'ws4', name: '工位D', baseCycleTime: 5, minCycleTime: 2, maxCycleTime: 8, inputBuffer: 'b3', outputBuffer: 'finished' }
    ];
  }
}

export class GameEngine {
  constructor(configuration = null) {
    this.config = configuration || new GameConfiguration();
    this._reset();
  }

  _reset() {
    this.gameState = GameState.IDLE;
    this.failureReason = null;
    this.score = this.config.startingScore;
    this.timeLeft = this.config.totalTime;
    this.productsCompleted = 0;
    this.elapsedTime = 0;
    this.lastPenaltyTime = 0;
    this.scoreRecords = [];
    
    this.buffers = {};
    for (const bufConfig of this.config.buffers) {
      this.buffers[bufConfig.id] = new Buffer(
        bufConfig.capacity,
        bufConfig.initialItems
      );
    }
    
    this.workstations = [];
    for (const wsConfig of this.config.workstations) {
      this.workstations.push(new Workstation(
        wsConfig.id,
        wsConfig.name,
        wsConfig.baseCycleTime,
        wsConfig.minCycleTime,
        wsConfig.maxCycleTime
      ));
    }
    
    this.wsConfigMap = {};
    for (const wsConfig of this.config.workstations) {
      this.wsConfigMap[wsConfig.id] = wsConfig;
    }
    
    this.history = [];
    this.isReplayMode = false;
    this.replayIndex = 0;
  }

  _getWorkstationById(id) {
    return this.workstations.find(ws => ws.id === id);
  }

  _getInputBuffer(workstation) {
    const config = this.wsConfigMap[workstation.id];
    if (config.inputBuffer === 'infinite') {
      return null;
    }
    return this.buffers[config.inputBuffer];
  }

  _getOutputBuffer(workstation) {
    const config = this.wsConfigMap[workstation.id];
    if (config.outputBuffer === 'finished') {
      return null;
    }
    return this.buffers[config.outputBuffer];
  }

  _canStartWork(workstation) {
    const inputBuffer = this._getInputBuffer(workstation);
    const hasInput = inputBuffer === null || !inputBuffer.isEmpty();
    const notWorking = !workstation.isWorking;
    const noFinishedProduct = !workstation.hasProduct;
    
    return hasInput && notWorking && noFinishedProduct;
  }

  _tryStartWork(workstation) {
    if (this._canStartWork(workstation)) {
      const inputBuffer = this._getInputBuffer(workstation);
      if (inputBuffer !== null) {
        inputBuffer.removeItem();
      }
      workstation.startWorking();
      return true;
    }
    return false;
  }

  _canFinishWork(workstation) {
    const outputBuffer = this._getOutputBuffer(workstation);
    const hasSpace = outputBuffer === null || !outputBuffer.isFull();
    return workstation.isWorking && workstation.progress >= workstation.cycleTime && hasSpace;
  }

  _finishWork(workstation) {
    workstation.finishWork();
    const outputBuffer = this._getOutputBuffer(workstation);
    if (outputBuffer !== null) {
      outputBuffer.addItem();
      workstation.releaseProduct();
    } else {
      this.productsCompleted++;
      workstation.releaseProduct();
      this._addScoreRecord(
        this.config.scorePerProduct,
        'product_completed',
        `完成产品 #${this.productsCompleted}`,
        null
      );
      this.score += this.config.scorePerProduct;
    }
  }

  _addScoreRecord(scoreChange, action, reason, bufferId) {
    this.scoreRecords.push(new ScoreRecord(
      this.elapsedTime,
      action,
      scoreChange,
      reason,
      bufferId
    ));
  }

  _checkPenalties() {
    if (this.elapsedTime - this.lastPenaltyTime < this.config.penaltyInterval) {
      return;
    }
    this.lastPenaltyTime = this.elapsedTime;
    
    for (const [bufferId, buffer] of Object.entries(this.buffers)) {
      if (buffer.isFull()) {
        this.score -= this.config.fullBufferPenalty;
        this._addScoreRecord(
          -this.config.fullBufferPenalty,
          'penalty',
          `缓冲区 ${bufferId} 爆满`,
          bufferId
        );
      } else if (buffer.isEmpty()) {
        this.score -= this.config.emptyBufferPenalty;
        this._addScoreRecord(
          -this.config.emptyBufferPenalty,
          'penalty',
          `缓冲区 ${bufferId} 断料`,
          bufferId
        );
      }
    }
  }

  _checkGameEndConditions() {
    if (this.score <= this.config.minScore) {
      this.gameState = GameState.FAILED;
      this.failureReason = FailureReason.SCORE_TOO_LOW;
      return true;
    }
    
    if (this.productsCompleted >= this.config.targetProducts) {
      this.gameState = GameState.FINISHED;
      return true;
    }
    
    return false;
  }

  _saveHistory() {
    this.history.push(new GameHistoryEntry(
      this.elapsedTime,
      this.workstations,
      this.buffers,
      this.score,
      this.timeLeft,
      this.productsCompleted,
      this.scoreRecords
    ));
  }

  start() {
    if (this.gameState === GameState.RUNNING) {
      return;
    }
    if (this.gameState === GameState.IDLE || this.gameState === GameState.FAILED || this.gameState === GameState.FINISHED) {
      this._reset();
    }
    this.gameState = GameState.RUNNING;
    this.isReplayMode = false;
  }

  pause() {
    if (this.gameState === GameState.RUNNING) {
      this.gameState = GameState.PAUSED;
    }
  }

  resume() {
    if (this.gameState === GameState.PAUSED) {
      this.gameState = GameState.RUNNING;
    }
  }

  restart() {
    this._reset();
    this.gameState = GameState.RUNNING;
  }

  adjustWorkstationCycleTime(workstationId, change) {
    if (this.gameState !== GameState.RUNNING) {
      return false;
    }
    
    const workstation = this._getWorkstationById(workstationId);
    if (!workstation) {
      return false;
    }
    
    if (change < 0) {
      return workstation.decreaseCycleTime();
    } else if (change > 0) {
      return workstation.increaseCycleTime();
    }
    return false;
  }

  tick(deltaTime) {
    if (this.gameState !== GameState.RUNNING) {
      return;
    }
    
    this.elapsedTime += deltaTime;
    this.timeLeft = Math.max(0, this.config.totalTime - this.elapsedTime);
    
    if (this.timeLeft <= 0) {
      this.gameState = GameState.FAILED;
      this.failureReason = FailureReason.TIME_EXHAUSTED;
      this._saveHistory();
      return;
    }
    
    for (const workstation of this.workstations) {
      if (workstation.hasProduct) {
        continue;
      }
      
      this._tryStartWork(workstation);
      
      if (workstation.isWorking) {
        const workFinished = workstation.tick(deltaTime);
        if (workFinished && this._canFinishWork(workstation)) {
          this._finishWork(workstation);
        }
      }
    }
    
    this._checkPenalties();
    
    if (this._checkGameEndConditions()) {
      this._saveHistory();
      return;
    }
    
    this._saveHistory();
  }

  getState() {
    return {
      gameState: this.gameState,
      failureReason: this.failureReason,
      score: this.score,
      timeLeft: this.timeLeft,
      elapsedTime: this.elapsedTime,
      productsCompleted: this.productsCompleted,
      targetProducts: this.config.targetProducts,
      workstations: this.workstations.map(ws => ({
        id: ws.id,
        name: ws.name,
        cycleTime: ws.cycleTime,
        minCycleTime: ws.minCycleTime,
        maxCycleTime: ws.maxCycleTime,
        isWorking: ws.isWorking,
        progress: ws.progress,
        hasProduct: ws.hasProduct,
        progressPercent: ws.isWorking ? (ws.progress / ws.cycleTime) * 100 : 0,
        canDecreaseCycleTime: ws.canDecreaseCycleTime(),
        canIncreaseCycleTime: ws.canIncreaseCycleTime()
      })),
      buffers: Object.entries(this.buffers).map(([id, buf]) => ({
        id: id,
        capacity: buf.capacity,
        items: buf.items,
        isEmpty: buf.isEmpty(),
        isFull: buf.isFull(),
        fillRatio: buf.getFillRatio()
      })),
      scoreRecords: [...this.scoreRecords].reverse().slice(0, 50),
      isReplayMode: this.isReplayMode
    };
  }

  getHistoryCount() {
    return this.history.length;
  }

  startReplay() {
    if (this.history.length === 0) {
      return false;
    }
    this.isReplayMode = true;
    this.replayIndex = 0;
    return true;
  }

  getReplayState(index) {
    if (index < 0 || index >= this.history.length) {
      return null;
    }
    const entry = this.history[index];
    return {
      gameState: GameState.RUNNING,
      failureReason: null,
      score: entry.score,
      timeLeft: entry.timeLeft,
      elapsedTime: entry.timestamp,
      productsCompleted: entry.productsCompleted,
      targetProducts: this.config.targetProducts,
      workstations: entry.workstations.map(ws => ({
        id: ws.id,
        name: ws.name,
        cycleTime: ws.cycleTime,
        minCycleTime: ws.minCycleTime,
        maxCycleTime: ws.maxCycleTime,
        isWorking: ws.isWorking,
        progress: ws.progress,
        hasProduct: ws.hasProduct,
        progressPercent: ws.isWorking ? (ws.progress / ws.cycleTime) * 100 : 0,
        canDecreaseCycleTime: ws.cycleTime > ws.minCycleTime,
        canIncreaseCycleTime: ws.cycleTime < ws.maxCycleTime
      })),
      buffers: Object.entries(entry.buffers).map(([id, buf]) => ({
        id: id,
        capacity: buf.capacity,
        items: buf.items,
        isEmpty: buf.items === 0,
        isFull: buf.items >= buf.capacity,
        fillRatio: buf.items / buf.capacity
      })),
      scoreRecords: [...entry.scoreRecords].reverse().slice(0, 50),
      isReplayMode: true,
      replayIndex: index,
      replayTotal: this.history.length
    };
  }

  stopReplay() {
    this.isReplayMode = false;
  }
}

export const GameState = {
  IDLE: 'idle',
  PLAYING: 'playing',
  PAUSED: 'paused',
  GAME_OVER: 'game_over'
};

export const RiskLevel = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  CONTRABAND: 'contraband'
};

export const RiskConfig = {
  [RiskLevel.LOW]: {
    name: '低风险',
    color: '#22c55e',
    inspectionTime: 3,
    correctInspectScore: -10,
    correctPassScore: 20,
    wrongPassScore: 0
  },
  [RiskLevel.MEDIUM]: {
    name: '中风险',
    color: '#eab308',
    inspectionTime: 5,
    correctInspectScore: 30,
    correctPassScore: 0,
    wrongPassScore: -50
  },
  [RiskLevel.HIGH]: {
    name: '高风险',
    color: '#f97316',
    inspectionTime: 8,
    correctInspectScore: 50,
    correctPassScore: 0,
    wrongPassScore: -100
  },
  [RiskLevel.CONTRABAND]: {
    name: '违禁品',
    color: '#8b5cf6',
    inspectionTime: 10,
    correctInspectScore: 100,
    correctPassScore: 0,
    wrongPassScore: -200
  }
};

const ITEM_TYPES = ['旅客行李', '货物包裹', '手提袋', '纸箱', '行李箱', '背包'];
const MAX_QUEUE_SIZE = 10;
const MAX_CONTRABAND_MISSES = 3;

export class CustomsGame {
  constructor() {
    this.state = GameState.IDLE;
    this.score = 0;
    this.queue = [];
    this.windows = [null, null];
    this.contrabandMisses = 0;
    this.scoreHistory = [];
    this.itemCounter = 0;
    this.gameTime = 0;
    this.spawnTimer = null;
    this.gameTimer = null;
    this.inspectionTimers = [null, null];
    this.spawnInterval = 4000;
    this.lastSpawnTime = 0;
  }

  start() {
    if (this.state === GameState.PLAYING) return;
    
    this.state = GameState.PLAYING;
    this.score = 0;
    this.queue = [];
    this.windows = [null, null];
    this.contrabandMisses = 0;
    this.scoreHistory = [];
    this.gameTime = 0;
    this.itemCounter = 0;
    this.lastSpawnTime = 0;
    this.spawnInterval = 4000;
    
    this._spawnItem();
    this._startGameLoop();
    
    return this._getGameStatus();
  }

  pause() {
    if (this.state !== GameState.PLAYING) return;
    
    this.state = GameState.PAUSED;
    this._clearTimers();
    
    return this._getGameStatus();
  }

  resume() {
    if (this.state !== GameState.PAUSED) return;
    
    this.state = GameState.PLAYING;
    this._startGameLoop();
    this._resumeInspections();
    
    return this._getGameStatus();
  }

  restart() {
    this._clearAllTimers();
    return this.start();
  }

  inspect(windowIndex) {
    if (this.state !== GameState.PLAYING) return { success: false, reason: '游戏未进行中' };
    if (windowIndex < 0 || windowIndex >= 2) return { success: false, reason: '窗口索引无效' };
    if (this.windows[windowIndex] !== null) return { success: false, reason: '窗口正在使用中' };
    if (this.queue.length === 0) return { success: false, reason: '队列为空' };

    const item = this.queue.shift();
    item.status = 'inspecting';
    item.windowIndex = windowIndex;
    item.inspectionStartTime = this.gameTime;
    this.windows[windowIndex] = item;

    const config = RiskConfig[item.riskLevel];
    const inspectionDuration = config.inspectionTime * 1000;

    this.inspectionTimers[windowIndex] = setTimeout(() => {
      this._completeInspection(windowIndex);
    }, inspectionDuration);

    return { success: true, item, windowIndex };
  }

  pass() {
    if (this.state !== GameState.PLAYING) return { success: false, reason: '游戏未进行中' };
    if (this.queue.length === 0) return { success: false, reason: '队列为空' };

    const item = this.queue.shift();
    const config = RiskConfig[item.riskLevel];
    let scoreChange = 0;
    let isCorrect = false;
    let isContrabandMiss = false;

    if (item.riskLevel === RiskLevel.CONTRABAND) {
      scoreChange = config.wrongPassScore;
      this.contrabandMisses++;
      isContrabandMiss = true;
    } else if (item.riskLevel === RiskLevel.LOW) {
      scoreChange = config.correctPassScore;
      isCorrect = true;
    } else {
      scoreChange = config.wrongPassScore;
    }

    this.score += scoreChange;
    this.scoreHistory.push({
      itemId: item.id,
      action: 'pass',
      riskLevel: item.riskLevel,
      scoreChange,
      isCorrect,
      isContrabandMiss,
      time: this.gameTime
    });

    if (this.contrabandMisses >= MAX_CONTRABAND_MISSES) {
      this._gameOver('违禁品放行次数过多');
    }

    return { success: true, item, scoreChange, isCorrect, isContrabandMiss };
  }

  getStatus() {
    return this._getGameStatus();
  }

  _completeInspection(windowIndex) {
    if (this.state !== GameState.PLAYING) return;
    
    const item = this.windows[windowIndex];
    if (!item) return;

    const config = RiskConfig[item.riskLevel];
    let scoreChange = 0;
    let isCorrect = false;

    if (item.riskLevel === RiskLevel.CONTRABAND || 
        item.riskLevel === RiskLevel.HIGH || 
        item.riskLevel === RiskLevel.MEDIUM) {
      scoreChange = config.correctInspectScore;
      isCorrect = true;
    } else {
      scoreChange = config.correctInspectScore;
      isCorrect = false;
    }

    this.score += scoreChange;
    this.scoreHistory.push({
      itemId: item.id,
      action: 'inspect',
      riskLevel: item.riskLevel,
      scoreChange,
      isCorrect,
      time: this.gameTime,
      windowIndex
    });

    this.windows[windowIndex] = null;
    this.inspectionTimers[windowIndex] = null;

    if (this._onInspectionComplete) {
      this._onInspectionComplete(windowIndex, item, scoreChange, isCorrect);
    }
  }

  _spawnItem() {
    const random = Math.random();
    let riskLevel;
    
    if (random < 0.4) {
      riskLevel = RiskLevel.LOW;
    } else if (random < 0.65) {
      riskLevel = RiskLevel.MEDIUM;
    } else if (random < 0.85) {
      riskLevel = RiskLevel.HIGH;
    } else {
      riskLevel = RiskLevel.CONTRABAND;
    }

    const item = {
      id: ++this.itemCounter,
      riskLevel,
      type: ITEM_TYPES[Math.floor(Math.random() * ITEM_TYPES.length)],
      status: 'queued',
      queueTime: this.gameTime
    };

    this.queue.push(item);

    if (this.queue.length > MAX_QUEUE_SIZE) {
      this._gameOver('队列积压过多');
    }

    if (this._onItemSpawn) {
      this._onItemSpawn(item);
    }
  }

  _startGameLoop() {
    const startTime = Date.now() - this.gameTime;
    
    this.gameTimer = setInterval(() => {
      if (this.state === GameState.PLAYING) {
        const elapsed = Date.now() - startTime;
        this.gameTime = elapsed;
        
        if (elapsed - this.lastSpawnTime >= this.spawnInterval) {
          this._spawnItem();
          this.lastSpawnTime = elapsed;
          this.spawnInterval = Math.max(2000, this.spawnInterval - 50);
        }
      }
    }, 100);
  }

  _resumeInspections() {
    for (let i = 0; i < 2; i++) {
      const item = this.windows[i];
      if (item && item.inspectionStartTime !== undefined) {
        const config = RiskConfig[item.riskLevel];
        const totalTime = config.inspectionTime * 1000;
        const elapsed = this.gameTime - item.inspectionStartTime;
        const remaining = Math.max(0, totalTime - elapsed);
        
        if (remaining > 0) {
          this.inspectionTimers[i] = setTimeout(() => {
            this._completeInspection(i);
          }, remaining);
        } else {
          this._completeInspection(i);
        }
      }
    }
  }

  _gameOver(reason) {
    this.state = GameState.GAME_OVER;
    this._clearAllTimers();
    
    if (this._onGameOver) {
      this._onGameOver(reason, this.score);
    }
  }

  _clearTimers() {
    if (this.gameTimer) {
      clearInterval(this.gameTimer);
      this.gameTimer = null;
    }
    this.inspectionTimers.forEach((timer, index) => {
      if (timer) {
        clearTimeout(timer);
        this.inspectionTimers[index] = null;
      }
    });
  }

  _clearAllTimers() {
    this._clearTimers();
    if (this.spawnTimer) {
      clearInterval(this.spawnTimer);
      this.spawnTimer = null;
    }
  }

  _getGameStatus() {
    return {
      state: this.state,
      score: this.score,
      queue: [...this.queue],
      windows: [...this.windows],
      contrabandMisses: this.contrabandMisses,
      scoreHistory: [...this.scoreHistory],
      gameTime: this.gameTime,
      maxQueueSize: MAX_QUEUE_SIZE,
      maxContrabandMisses: MAX_CONTRABAND_MISSES
    };
  }

  setEventHandlers({ onItemSpawn, onInspectionComplete, onGameOver }) {
    this._onItemSpawn = onItemSpawn;
    this._onInspectionComplete = onInspectionComplete;
    this._onGameOver = onGameOver;
  }

  getInspectionProgress(windowIndex) {
    const item = this.windows[windowIndex];
    if (!item || item.inspectionStartTime === undefined) return 0;
    
    const config = RiskConfig[item.riskLevel];
    const totalTime = config.inspectionTime * 1000;
    const elapsed = this.gameTime - item.inspectionStartTime;
    
    return Math.min(1, elapsed / totalTime);
  }
}

export { MAX_QUEUE_SIZE, MAX_CONTRABAND_MISSES };

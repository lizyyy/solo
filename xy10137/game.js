const GameState = {
  IDLE: 'idle',
  PLAYING: 'playing',
  PAUSED: 'paused',
  WON: 'won',
  LOST: 'lost'
};

const GameConfig = {
  BASE_TEMPERATURE: 2,
  MAX_TEMPERATURE: 10,
  TEMPERATURE_RISE: 0.07,
  BASE_DELIVERY_TIME: 30,
  MAX_DELIVERY_TIME: 60,
  INITIAL_VEHICLES: 3,
  INITIAL_CRATES: 5,
  CRATE_TIME_LIMIT: 90,
  SCORE_PER_DELIVERY: 100,
  SCORE_BONUS_FAST: 50,
  SCORE_BONUS_COLD: 50
};

class ColdChainGame {
  constructor() {
    this.state = GameState.IDLE;
    this.crates = [];
    this.vehicles = [];
    this.score = 0;
    this.scoreDetails = [];
    this.startTime = 0;
    this.elapsedTime = 0;
    this.pausedTime = 0;
    this.gameHistory = [];
    this.eventLog = [];
    this.lastUpdate = 0;
    this.gameLoopId = null;
  }

  init() {
    this.crates = [];
    this.vehicles = [];
    this.score = 0;
    this.scoreDetails = [];
    this.elapsedTime = 0;
    this.pausedTime = 0;
    this.gameHistory = [];
    this.eventLog = [];
    this.state = GameState.IDLE;

    for (let i = 0; i < GameConfig.INITIAL_CRATES; i++) {
      this.crates.push({
        id: i,
        name: `冷链箱 ${String.fromCharCode(65 + i)}`,
        temperature: GameConfig.BASE_TEMPERATURE,
        deliveryTime: 0,
        maxDeliveryTime: GameConfig.CRATE_TIME_LIMIT + Math.floor(Math.random() * 20),
        vehicleId: null,
        delivered: false,
        destination: this._getRandomDestination(),
        deliveryProgress: 0
      });
    }

    for (let i = 0; i < GameConfig.INITIAL_VEHICLES; i++) {
      this.vehicles.push({
        id: i,
        name: `车辆 ${i + 1}`,
        assignedCrateId: null,
        coolingPower: 0.04 + Math.random() * 0.03,
        speed: 1.7 + Math.random() * 1.0
      });
    }

    this._logEvent('游戏初始化完成');
    this._saveHistory();
  }

  _getRandomDestination() {
    const destinations = ['超市A', '超市B', '餐厅C', '医院D', '仓库E'];
    return destinations[Math.floor(Math.random() * destinations.length)];
  }

  start() {
    if (this.state !== GameState.IDLE) {
      return false;
    }
    this.state = GameState.PLAYING;
    this.startTime = Date.now();
    this.lastUpdate = this.startTime;
    this._logEvent('游戏开始');
    this._saveHistory();
    return true;
  }

  pause() {
    if (this.state !== GameState.PLAYING) {
      return false;
    }
    this.state = GameState.PAUSED;
    this.pausedTime = Date.now();
    this._logEvent('游戏暂停');
    this._saveHistory();
    return true;
  }

  resume() {
    if (this.state !== GameState.PAUSED) {
      return false;
    }
    const pauseDuration = Date.now() - this.pausedTime;
    this.lastUpdate += pauseDuration;
    this.state = GameState.PLAYING;
    this._logEvent('游戏继续');
    return true;
  }

  restart() {
    this._stopGameLoop();
    this.init();
    this.start();
    return true;
  }

  assignVehicleToCrate(vehicleId, crateId) {
    if (this.state !== GameState.PLAYING) {
      return false;
    }

    const vehicle = this.vehicles.find(v => v.id === vehicleId);
    const crate = this.crates.find(c => c.id === crateId);

    if (!vehicle || !crate) {
      return false;
    }

    if (vehicle.assignedCrateId !== null) {
      const oldCrate = this.crates.find(c => c.id === vehicle.assignedCrateId);
      if (oldCrate) {
        oldCrate.vehicleId = null;
      }
    }

    if (crate.vehicleId !== null) {
      const oldVehicle = this.vehicles.find(v => v.id === crate.vehicleId);
      if (oldVehicle) {
        oldVehicle.assignedCrateId = null;
      }
    }

    vehicle.assignedCrateId = crateId;
    crate.vehicleId = vehicleId;

    this._logEvent(`${vehicle.name} 分配给 ${crate.name}`);
    this._saveHistory();
    return true;
  }

  update(currentTime) {
    if (this.state !== GameState.PLAYING) {
      return false;
    }

    const deltaTime = (currentTime - this.lastUpdate) / 1000;
    this.lastUpdate = currentTime;
    this.elapsedTime += deltaTime;

    for (const crate of this.crates) {
      if (crate.delivered) continue;

      crate.temperature += GameConfig.TEMPERATURE_RISE * deltaTime;

      if (crate.vehicleId !== null) {
        const vehicle = this.vehicles.find(v => v.id === crate.vehicleId);
        if (vehicle) {
          crate.temperature -= vehicle.coolingPower * deltaTime;
          crate.deliveryProgress += vehicle.speed * deltaTime;
          crate.deliveryTime += deltaTime;

          if (crate.deliveryProgress >= 100) {
            this._deliverCrate(crate);
          }
        }
      } else {
        crate.deliveryTime += deltaTime;
      }

      crate.temperature = Math.max(-5, Math.min(crate.temperature, 20));
    }

    this._checkGameOver();
    this._saveHistory();
    return true;
  }

  _deliverCrate(crate) {
    crate.delivered = true;
    crate.deliveryProgress = 100;

    let deliveryScore = GameConfig.SCORE_PER_DELIVERY;
    const details = [`${crate.name} 成功送达 ${crate.destination}`];

    if (crate.deliveryTime < crate.maxDeliveryTime * 0.6) {
      deliveryScore += GameConfig.SCORE_BONUS_FAST;
      details.push('快速配送奖励 +' + GameConfig.SCORE_BONUS_FAST);
    }

    if (crate.temperature < GameConfig.BASE_TEMPERATURE + 2) {
      deliveryScore += GameConfig.SCORE_BONUS_COLD;
      details.push('低温保存奖励 +' + GameConfig.SCORE_BONUS_COLD);
    }

    this.score += deliveryScore;
    this.scoreDetails.push({
      crate: crate.name,
      score: deliveryScore,
      details: details,
      timestamp: this.elapsedTime
    });

    const vehicle = this.vehicles.find(v => v.id === crate.vehicleId);
    if (vehicle) {
      vehicle.assignedCrateId = null;
    }
    crate.vehicleId = null;

    this._logEvent(`${crate.name} 成功送达，得分 +${deliveryScore}`);
  }

  _checkGameOver() {
    let allDelivered = true;

    for (const crate of this.crates) {
      if (crate.delivered) continue;

      allDelivered = false;

      const timeExceeded = crate.deliveryTime >= crate.maxDeliveryTime;
      const tempExceeded = crate.temperature >= GameConfig.MAX_TEMPERATURE;

      if (timeExceeded && tempExceeded) {
        this.state = GameState.LOST;
        this._logEvent(`游戏失败: ${crate.name} 温度和时间同时超标`);
        this._saveHistory();
        return;
      }
    }

    if (allDelivered) {
      this.state = GameState.WON;
      this._logEvent('游戏胜利: 所有冷链箱成功配送');
      this._saveHistory();
    }
  }

  _logEvent(message) {
    this.eventLog.push({
      timestamp: this.elapsedTime,
      state: this.state,
      message: message
    });
  }

  _saveHistory() {
    if (this.gameHistory.length > 0) {
      const lastState = this.gameHistory[this.gameHistory.length - 1];
      if (lastState.elapsedTime === this.elapsedTime && 
          lastState.state === this.state &&
          lastState.score === this.score) {
        return;
      }
    }

    this.gameHistory.push({
      elapsedTime: this.elapsedTime,
      state: this.state,
      score: this.score,
      crates: JSON.parse(JSON.stringify(this.crates)),
      vehicles: JSON.parse(JSON.stringify(this.vehicles))
    });
  }

  getState() {
    return {
      state: this.state,
      crates: this.crates,
      vehicles: this.vehicles,
      score: this.score,
      scoreDetails: this.scoreDetails,
      elapsedTime: this.elapsedTime,
      eventLog: this.eventLog
    };
  }

  getReplayData() {
    return JSON.parse(JSON.stringify(this.gameHistory));
  }

  _stopGameLoop() {
    if (this.gameLoopId) {
      cancelAnimationFrame(this.gameLoopId);
      this.gameLoopId = null;
    }
  }

  isRunning() {
    return this.state === GameState.PLAYING;
  }

  isGameOver() {
    return this.state === GameState.WON || this.state === GameState.LOST;
  }

  isWon() {
    return this.state === GameState.WON;
  }

  isLost() {
    return this.state === GameState.LOST;
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    GameState,
    GameConfig,
    ColdChainGame
  };
}

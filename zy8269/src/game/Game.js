import PassengerStateMachine from './PassengerStateMachine.js';
import CapacityCalculator from './CapacityCalculator.js';
import RiskEvaluator from './RiskEvaluator.js';
import Scorer from './Scorer.js';

class Game {
  constructor(levelConfig) {
    this.config = levelConfig;
    this.isStarted = false;
    this.isEnded = false;
    
    this.currentTime = 7 * 60;
    this.score = 0;
    this.maxRisk = 0;
    this.totalPassengers = 0;
    this.incidents = 0;
    
    this.stateMachine = new PassengerStateMachine(this);
    this.capacityCalculator = new CapacityCalculator(this);
    this.riskEvaluator = new RiskEvaluator(this);
    this.scorer = new Scorer(this);
    
    this.passengers = [];
    this.objects = [];
    this.areas = {};
    this.trains = [];
    this.waves = [];
    this.alerts = [];
    this.replayHistory = [];
    
    this.tickCount = 0;
    this.lastWaveIndex = -1;
    this.trainScheduleIndex = 0;
    
    this.initFromConfig();
  }
  
  initFromConfig() {
    this.objects = this.config.objects.map(obj => ({
      ...obj,
      originalState: obj.state
    }));
    
    this.areas = {};
    this.config.areas.forEach(area => {
      this.areas[area.name] = {
        ...area,
        currentCount: 0,
        status: 'safe'
      };
    });
    
    this.trains = [...this.config.trainSchedule];
    this.waves = [...this.config.crowdWaves];
    
    this.rules = {
      ...this.config.rules,
      accessibilityGates: this.objects.filter(o => o.type === 'gate' && o.accessibility).map(o => o.id)
    };
  }
  
  start() {
    this.isStarted = true;
    this.isEnded = false;
    this.recordReplay('start', { time: this.currentTime });
  }
  
  update() {
    if (!this.isStarted || this.isEnded) return;
    
    this.tickCount++;
    this.currentTime += this.config.timeSpeed || 0.5;
    
    this.checkCrowdWaves();
    this.checkTrainSchedule();
    this.updatePassengers();
    this.updateAreas();
    this.checkRisk();
    this.updateScore();
    this.checkBoundaryConditions();
    
    this.recordReplay('tick', {
      time: this.currentTime,
      passengers: this.passengers.length,
      risk: this.riskEvaluator.getOverallRisk()
    });
  }
  
  checkCrowdWaves() {
    for (let i = 0; i < this.waves.length; i++) {
      const wave = this.waves[i];
      if (i > this.lastWaveIndex && this.currentTime >= wave.startTime) {
        this.spawnPassengerWave(wave);
        this.lastWaveIndex = i;
        
        this.addAlert('warning', `客流波次来袭！入口${wave.entrance}将有${wave.count}名乘客进入。`);
        this.recordReplay('wave', wave);
      }
    }
  }
  
  spawnPassengerWave(wave) {
    const entrance = this.objects.find(o => o.type === 'entrance' && o.id === wave.entrance);
    if (!entrance) return;
    
    for (let i = 0; i < wave.count; i++) {
      setTimeout(() => {
        if (!this.isEnded) {
          this.spawnPassenger(entrance, wave);
        }
      }, i * 100);
    }
  }
  
  spawnPassenger(entrance, wave) {
    const passenger = {
      id: `p_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      x: entrance.x + Math.random() * entrance.width,
      y: entrance.y + Math.random() * entrance.height,
      width: 8,
      height: 8,
      speed: 0.5 + Math.random() * 0.3,
      state: 'entering',
      targetPlatform: wave.targetPlatform || 'platform1',
      hasAccessibilityNeed: Math.random() < 0.05,
      spawnTime: this.currentTime,
      area: entrance.area
    };
    
    this.passengers.push(passenger);
    this.totalPassengers++;
  }
  
  checkTrainSchedule() {
    if (this.trainScheduleIndex >= this.trains.length) return;
    
    const train = this.trains[this.trainScheduleIndex];
    
    if (this.currentTime >= train.arrivalTime && !train.arrived) {
      train.arrived = true;
      this.onTrainArrive(train);
    }
    
    if (this.currentTime >= train.departureTime && train.arrived && !train.departed) {
      train.departed = true;
      this.trainScheduleIndex++;
      this.onTrainDepart(train);
    }
  }
  
  onTrainArrive(train) {
    this.addAlert('info', `列车抵达${train.platform}站台，将在${(train.departureTime - train.arrivalTime).toFixed(0)}秒后发车。`);
    this.recordReplay('train_arrive', train);
    
    this.passengers.forEach(p => {
      if (p.area === train.platform && p.state === 'waiting') {
        p.state = 'boarding';
      }
    });
  }
  
  onTrainDepart(train) {
    const boardingPassengers = this.passengers.filter(p => p.state === 'boarding');
    const remaining = this.passengers.filter(p => p.state !== 'boarding');
    
    const successCount = boardingPassengers.length;
    if (successCount > 0) {
      this.score += successCount * 10;
      this.addAlert('info', `${successCount}名乘客成功乘车，获得${successCount * 10}分。`);
    }
    
    this.passengers = remaining;
    
    const latePassengers = remaining.filter(p => 
      p.area === train.platform && p.state === 'waiting'
    );
    if (latePassengers.length > 0) {
      this.addAlert('warning', `${latePassengers.length}名乘客未能赶上本次列车。`);
      latePassengers.forEach(p => p.state = 'waiting');
    }
    
    this.recordReplay('train_depart', { train, boarded: successCount });
  }
  
  updatePassengers() {
    this.passengers.forEach(passenger => {
      this.stateMachine.update(passenger);
    });
    
    this.passengers = this.passengers.filter(p => !p.removed);
  }
  
  updateAreas() {
    for (const [name, area] of Object.entries(this.areas)) {
      area.currentCount = this.passengers.filter(p => p.area === name).length;
      area.utilization = area.currentCount / area.capacity;
      
      if (area.utilization > 0.9) {
        area.status = 'danger';
      } else if (area.utilization > 0.7) {
        area.status = 'warning';
      } else {
        area.status = 'safe';
      }
    }
  }
  
  checkRisk() {
    const risks = this.riskEvaluator.evaluate();
    
    if (risks.overall > this.maxRisk) {
      this.maxRisk = risks.overall;
    }
    
    if (risks.overcrowdedAreas.length > 0 && this.tickCount % 60 === 0) {
      const areaNames = risks.overcrowdedAreas.map(a => a.name).join(', ');
      this.addAlert('warning', `以下区域人流拥挤：${areaNames}`);
    }
    
    if (risks.overall > 0.8 && this.tickCount % 30 === 0) {
      this.addAlert('danger', '严重风险！请立即采取限流措施！');
    }
  }
  
  checkBoundaryConditions() {
    this.checkMidnightDelay();
    this.checkAccessibilityBlocked();
  }
  
  checkMidnightDelay() {
    if (this.currentTime > 24 * 60) {
      const delayedTrains = this.trains.filter(t => 
        !t.departed && t.isLastTrain && t.arrivalTime > 24 * 60
      );
      
      if (delayedTrains.length > 0 && !this.midnightWarningShown) {
        this.addAlert('danger', '注意：跨午夜末班车延误！请妥善安排滞留乘客。');
        this.midnightWarningShown = true;
        this.incidents++;
      }
    }
  }
  
  checkAccessibilityBlocked() {
    this.rules.accessibilityGates.forEach(gateId => {
      const gate = this.objects.find(o => o.id === gateId);
      if (gate && gate.state === 'closed') {
        if (!this.accessibilityWarnings) {
          this.accessibilityWarnings = {};
        }
        
        if (!this.accessibilityWarnings[gateId]) {
          this.accessibilityWarnings[gateId] = true;
          this.addAlert('danger', `严重违规！无障碍通道 ${gateId} 被误封！`);
          this.incidents++;
          this.score = Math.max(0, this.score - 100);
        }
      } else {
        if (this.accessibilityWarnings && this.accessibilityWarnings[gateId]) {
          this.accessibilityWarnings[gateId] = false;
          this.addAlert('info', `无障碍通道 ${gateId} 已恢复通行。`);
        }
      }
    });
  }
  
  updateScore() {
    this.scorer.update();
  }
  
  toggleGate(gateId) {
    const gate = this.objects.find(o => o.id === gateId && o.type === 'gate');
    if (gate) {
      gate.state = gate.state === 'open' ? 'closed' : 'open';
      this.addAlert('info', `闸机 ${gateId} 已${gate.state === 'open' ? '打开' : '关闭'}`);
      this.recordReplay('gate_toggle', { id: gateId, state: gate.state });
    }
  }
  
  toggleEscalator(escalatorId) {
    const escalator = this.objects.find(o => o.id === escalatorId && o.type === 'escalator');
    if (escalator) {
      escalator.direction = escalator.direction === 'up' ? 'down' : 'up';
      this.addAlert('info', `扶梯 ${escalatorId} 方向已切换为${escalator.direction === 'up' ? '上行' : '下行'}`);
      this.recordReplay('escalator_toggle', { id: escalatorId, direction: escalator.direction });
    }
  }
  
  toggleBarrier(barrierId, position) {
    if (barrierId) {
      const barrier = this.objects.find(o => o.id === barrierId && o.type === 'barrier');
      if (barrier) {
        barrier.active = !barrier.active;
        this.addAlert('info', `临时围栏 ${barrierId} 已${barrier.active ? '放置' : '移除'}`);
        this.recordReplay('barrier_toggle', { id: barrierId, active: barrier.active });
      }
    }
  }
  
  getObjectAt(position) {
    return this.objects.find(obj => {
      return position.x >= obj.x && 
             position.x <= obj.x + obj.width &&
             position.y >= obj.y && 
             position.y <= obj.y + obj.height;
    });
  }
  
  addAlert(type, message) {
    const alert = {
      type: type,
      message: message,
      time: this.currentTime,
      shown: false
    };
    this.alerts.push(alert);
  }
  
  recordReplay(eventType, data) {
    this.replayHistory.push({
      tick: this.tickCount,
      time: this.currentTime,
      type: eventType,
      data: data
    });
  }
  
  getState() {
    return {
      currentTime: this.currentTime,
      score: this.score,
      currentPassengers: this.passengers.length,
      riskLevel: this.riskEvaluator.getOverallRisk(),
      areas: this.areas,
      alerts: this.alerts.filter(a => !a.shown)
    };
  }
  
  getFinalStats() {
    return {
      score: this.score,
      totalPassengers: this.totalPassengers,
      maxRisk: this.maxRisk,
      incidents: this.incidents,
      duration: this.currentTime - 7 * 60
    };
  }
  
  getReplayData() {
    return {
      level: this.config.name,
      startTime: '2024-01-01T07:00:00',
      endTime: `2024-01-01T${Math.floor(this.currentTime / 60).toString().padStart(2, '0')}:${Math.floor(this.currentTime % 60).toString().padStart(2, '0')}`,
      finalStats: this.getFinalStats(),
      history: this.replayHistory,
      objects: this.objects,
      trains: this.trains
    };
  }
  
  isGameOver() {
    if (this.incidents >= 3) {
      this.addAlert('danger', '安全事件过多，任务失败！');
      return true;
    }
    
    const allTrainsDeparted = this.trains.every(t => t.departed);
    const noPassengersLeft = this.passengers.length === 0;
    const allWavesProcessed = this.lastWaveIndex >= this.waves.length - 1;
    
    if (allTrainsDeparted && allWavesProcessed && noPassengersLeft) {
      return true;
    }
    
    if (this.currentTime > 10 * 60 + 30) {
      return true;
    }
    
    return false;
  }
}

export default Game;

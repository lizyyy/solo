if (typeof module !== 'undefined' && module.exports && typeof GameConfig === 'undefined') {
  const gc = require('./gameConfig');
  if (typeof global !== 'undefined') {
    global.GameConfig = gc;
  }
}

class GameEngine {
  constructor() {
    this.reset();
  }

  reset() {
    this.state = 'idle';
    this.score = 0;
    this.timeRemaining = GameConfig.GAME_DURATION;
    this.emergencySpawnInterval = GameConfig.EMERGENCY_SPAWN_INTERVAL;
    this.emergencyCount = 0;
    this.emergencies = [];
    this.completedEmergencies = [];
    this.failedEmergencies = [];
    this.scoreBreakdown = [];
    this.resolvedActions = new Set();
    
    this.stations = JSON.parse(JSON.stringify(GameConfig.INITIAL_RESOURCES.stations));
    this.vehicles = JSON.parse(JSON.stringify(GameConfig.INITIAL_RESOURCES.vehicles));
    this.hydrants = JSON.parse(JSON.stringify(GameConfig.INITIAL_RESOURCES.hydrants));
    
    this.dispatchHistory = [];
    this.lastUpdateTime = null;
    this.spawnTimer = 0;
  }

  start() {
    if (this.state !== 'idle' && this.state !== 'finished') return;
    this.reset();
    this.state = 'playing';
    this.lastUpdateTime = Date.now();
    this.spawnTimer = 0;
    this.spawnEmergency();
  }

  pause() {
    if (this.state === 'playing') {
      this.state = 'paused';
    }
  }

  resume() {
    if (this.state === 'paused') {
      this.state = 'playing';
      this.lastUpdateTime = Date.now();
    }
  }

  restart() {
    this.reset();
    this.start();
  }

  update() {
    if (this.state !== 'playing') return;

    const now = Date.now();
    const deltaTime = (now - this.lastUpdateTime) / 1000;
    this.lastUpdateTime = now;

    this.timeRemaining -= deltaTime;
    if (this.timeRemaining <= 0) {
      this.timeRemaining = 0;
      this.finishGame('time_up');
      return;
    }

    this.spawnTimer += deltaTime * 1000;
    if (this.spawnTimer >= this.emergencySpawnInterval) {
      this.spawnTimer = 0;
      if (this.emergencies.length < GameConfig.MAX_ACTIVE_EMERGENCIES) {
        this.spawnEmergency();
      }
      this.emergencySpawnInterval = Math.max(
        GameConfig.MIN_SPAWN_INTERVAL,
        this.emergencySpawnInterval - GameConfig.SPAWN_INTERVAL_DECREASE
      );
    }

    this.updateEmergencies(deltaTime);
    this.updateVehicles(deltaTime);

    if (this.state === 'playing' && this.checkGameOver()) {
      this.finishGame('too_many_failures');
    }
  }

  spawnEmergency() {
    const types = Object.keys(GameConfig.EMERGENCY_TYPES);
    const typeKey = types[Math.floor(Math.random() * types.length)];
    const typeConfig = GameConfig.EMERGENCY_TYPES[typeKey];

    let x, y;
    let attempts = 0;
    do {
      x = 100 + Math.random() * (GameConfig.MAP_WIDTH - 200);
      y = 100 + Math.random() * (GameConfig.MAP_HEIGHT - 200);
      attempts++;
    } while (
      attempts < 10 &&
      this.emergencies.some(e => this.getDistance({ x, y }, { x: e.x, y: e.y }) < 100)
    );

    const emergency = {
      id: `emergency_${++this.emergencyCount}`,
      type: typeKey,
      x,
      y,
      timeRemaining: typeConfig.maxTime,
      maxTime: typeConfig.maxTime,
      dispatchedVehicles: [],
      personnelArrived: 0,
      waterProvided: 0,
      status: 'active',
      targetPersonnel: typeConfig.personnelNeeded,
      targetWater: typeConfig.waterNeeded,
      createdAt: Date.now(),
      actionId: `spawn_${this.emergencyCount}`
    };

    this.emergencies.push(emergency);
    return emergency;
  }

  updateEmergencies(deltaTime) {
    for (let i = this.emergencies.length - 1; i >= 0; i--) {
      const emergency = this.emergencies[i];

      let arrivedPersonnel = 0;
      let arrivedWater = 0;

      for (const dv of emergency.dispatchedVehicles) {
        const realVehicle = this.vehicles.find(v => v.id === dv.id);
        if (realVehicle && realVehicle.status === 'arrived') {
          arrivedPersonnel += dv.personnel;
          arrivedWater += dv.water;
        }
      }

      emergency.personnelArrived = arrivedPersonnel;
      emergency.waterProvided = arrivedWater;

      if (arrivedPersonnel >= emergency.targetPersonnel && arrivedWater >= emergency.targetWater) {
        this.resolveEmergency(emergency, 'success');
        continue;
      }

      emergency.timeRemaining -= deltaTime;
      if (emergency.timeRemaining <= 0) {
        this.resolveEmergency(emergency, 'timeout');
      }
    }
  }

  resolveEmergency(emergency, result) {
    const typeConfig = GameConfig.EMERGENCY_TYPES[emergency.type];
    const idx = this.emergencies.indexOf(emergency);
    if (idx > -1) {
      this.emergencies.splice(idx, 1);
    }

    emergency.status = result;
    emergency.resolvedAt = Date.now();

    let points = 0;
    let reason = '';

    if (result === 'success') {
      const timeBonus = Math.floor(emergency.timeRemaining / emergency.maxTime * 100);
      points = typeConfig.baseReward + timeBonus;
      reason = `${typeConfig.name} - 成功处置 (时间奖励: +${timeBonus})`;
      this.completedEmergencies.push(emergency);
    } else {
      points = -typeConfig.baseReward;
      reason = `${typeConfig.name} - 处置失败 (超时)`;
      this.failedEmergencies.push(emergency);
    }

    this.score = Math.max(0, this.score + points);
    this.scoreBreakdown.push({
      time: GameConfig.GAME_DURATION - this.timeRemaining,
      reason,
      points,
      emergencyType: emergency.type,
      result
    });

    emergency.dispatchedVehicles.forEach(dv => {
      const vehicle = this.vehicles.find(v => v.id === dv.id);
      if (vehicle) {
        vehicle.status = 'returning';
        vehicle.personnel = 0;
        vehicle.water = 0;
        const station = this.stations.find(s => s.id === vehicle.stationId);
        if (station) {
          vehicle.targetX = station.x;
          vehicle.targetY = station.y;
        }
      }
    });
  }

  updateVehicles(deltaTime) {
    for (const vehicle of this.vehicles) {
      if (vehicle.status === 'available' || vehicle.status === 'arrived') continue;

      const vehicleConfig = GameConfig.VEHICLE_TYPES[vehicle.type];
      const moveDistance = vehicleConfig.speed * deltaTime;

      const dx = vehicle.targetX - vehicle.x;
      const dy = vehicle.targetY - vehicle.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance <= moveDistance) {
        vehicle.x = vehicle.targetX;
        vehicle.y = vehicle.targetY;

        if (vehicle.status === 'enroute') {
          vehicle.status = 'arrived';
        } else if (vehicle.status === 'returning') {
          vehicle.status = 'available';
          const station = this.stations.find(s => s.id === vehicle.stationId);
          if (station) {
            vehicle.water = vehicleConfig.waterCapacity;
          }
        }
      } else {
        vehicle.x += (dx / distance) * moveDistance;
        vehicle.y += (dy / distance) * moveDistance;
      }
    }
  }

  dispatch(vehicleId, emergencyId, personnelCount, useHydrant = false) {
    if (this.state !== 'playing') {
      return { success: false, error: '游戏未运行' };
    }

    const vehicle = this.vehicles.find(v => v.id === vehicleId);
    if (!vehicle) {
      return { success: false, error: '车辆不存在' };
    }

    const vehicleConfig = GameConfig.VEHICLE_TYPES[vehicle.type];

    if (vehicle.status !== 'available') {
      return { success: false, error: '车辆已被调度' };
    }

    const emergency = this.emergencies.find(e => e.id === emergencyId);
    if (!emergency) {
      return { success: false, error: '警情不存在' };
    }

    const station = this.stations.find(s => s.id === vehicle.stationId);
    if (!station) {
      return { success: false, error: '消防站不存在' };
    }

    if (personnelCount < 1 || personnelCount > vehicleConfig.capacity) {
      return { success: false, error: `人员数量必须在 1-${vehicleConfig.capacity} 之间` };
    }

    if (station.personnel < personnelCount) {
      return { success: false, error: '消防站人员不足' };
    }

    let effectiveWater = vehicleConfig.waterCapacity;
    if (useHydrant) {
      const nearestHydrant = this.findNearestHydrant(emergency.x, emergency.y);
      if (nearestHydrant) {
        effectiveWater = vehicleConfig.waterCapacity + nearestHydrant.flowRate * 3;
      }
    }

    station.personnel -= personnelCount;
    vehicle.personnel = personnelCount;
    vehicle.water = effectiveWater;
    vehicle.status = 'enroute';
    vehicle.targetX = emergency.x;
    vehicle.targetY = emergency.y;

    emergency.dispatchedVehicles.push({
      id: vehicle.id,
      type: vehicle.type,
      personnel: personnelCount,
      water: vehicle.water,
      status: 'enroute',
      distance: this.getDistance(
        { x: vehicle.x, y: vehicle.y },
        { x: emergency.x, y: emergency.y }
      )
    });

    this.dispatchHistory.push({
      time: GameConfig.GAME_DURATION - this.timeRemaining,
      vehicleId,
      vehicleType: vehicle.type,
      emergencyId,
      personnelCount,
      useHydrant
    });

    return { success: true, message: '调度成功' };
  }

  findNearestHydrant(x, y) {
    let nearest = null;
    let minDist = Infinity;

    for (const hydrant of this.hydrants) {
      const dist = this.getDistance({ x, y }, hydrant);
      if (dist < minDist) {
        minDist = dist;
        nearest = hydrant;
      }
    }

    return nearest;
  }

  getDistance(p1, p2) {
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  getAvailableVehicles() {
    return this.vehicles.filter(v => v.status === 'available');
  }

  getActiveEmergencies() {
    return this.emergencies.filter(e => e.status === 'active');
  }

  checkGameOver() {
    return this.failedEmergencies.length >= 3;
  }

  finishGame(reason) {
    this.state = 'finished';
    this.finishReason = reason;
  }

  getGameState() {
    return {
      state: this.state,
      score: this.score,
      timeRemaining: this.timeRemaining,
      finishReason: this.finishReason || null,
      emergencies: [...this.emergencies],
      completedEmergencies: [...this.completedEmergencies],
      failedEmergencies: [...this.failedEmergencies],
      vehicles: [...this.vehicles],
      stations: [...this.stations],
      hydrants: [...this.hydrants],
      scoreBreakdown: [...this.scoreBreakdown],
      dispatchHistory: [...this.dispatchHistory]
    };
  }

  validateDispatch(vehicleId, emergencyId, personnelCount) {
    if (this.state !== 'playing') {
      return { valid: false, reason: '游戏未运行' };
    }

    const vehicle = this.vehicles.find(v => v.id === vehicleId);
    if (!vehicle) {
      return { valid: false, reason: '车辆不存在' };
    }

    if (vehicle.status !== 'available') {
      return { valid: false, reason: '车辆已被调度' };
    }

    const emergency = this.emergencies.find(e => e.id === emergencyId);
    if (!emergency) {
      return { valid: false, reason: '警情不存在' };
    }

    const vehicleConfig = GameConfig.VEHICLE_TYPES[vehicle.type];
    if (personnelCount < 1 || personnelCount > vehicleConfig.capacity) {
      return { valid: false, reason: `人员数量必须在 1-${vehicleConfig.capacity} 之间` };
    }

    const station = this.stations.find(s => s.id === vehicle.stationId);
    if (!station || station.personnel < personnelCount) {
      return { valid: false, reason: '消防站人员不足' };
    }

    return { valid: true };
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = GameEngine;
}

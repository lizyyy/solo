export class Simulation {
  constructor(dronesData, noFlyZones, batteriesData = null) {
    this.drones = this.initializeDrones(dronesData);
    this.noFlyZones = noFlyZones || [];
    this.batteries = batteriesData || [];
    
    this.currentTime = 0;
    this.isPlaying = false;
    this.lastUpdateTime = null;
    this.playbackSpeed = 1;
    
    this.minCollisionDistance = 3;
    this.warningCollisionDistance = 10;
    this.lowBatteryThreshold = 20;
    this.criticalBatteryThreshold = 10;
    
    this.eventListeners = {};
    this.currentStates = null;
    
    this.totalTime = this.calculateTotalTime();
    
    this.initialDroneStates = this.drones.map(drone => ({
      id: drone.id,
      waypoints: [...drone.waypoints]
    }));
  }

  initializeDrones(dronesData) {
    return dronesData.map(drone => ({
      id: drone.id,
      name: drone.name,
      batteryId: drone.batteryId,
      waypoints: drone.waypoints,
      color: drone.color,
      startTime: drone.startTime,
      endTime: drone.endTime,
      currentPosition: null,
      batteryLevel: 100,
      isActive: false
    }));
  }

  calculateTotalTime() {
    let maxTime = 0;
    
    this.drones.forEach(drone => {
      if (drone.waypoints.length > 0) {
        const lastWaypoint = drone.waypoints[drone.waypoints.length - 1];
        if (lastWaypoint.time > maxTime) {
          maxTime = lastWaypoint.time;
        }
      }
    });

    return maxTime;
  }

  on(eventName, callback) {
    if (!this.eventListeners[eventName]) {
      this.eventListeners[eventName] = [];
    }
    this.eventListeners[eventName].push(callback);
  }

  emit(eventName, data) {
    if (this.eventListeners[eventName]) {
      this.eventListeners[eventName].forEach(callback => callback(data));
    }
  }

  play() {
    this.isPlaying = true;
    this.lastUpdateTime = performance.now();
    this.update();
  }

  pause() {
    this.isPlaying = false;
    this.lastUpdateTime = null;
  }

  reset() {
    this.isPlaying = false;
    this.currentTime = 0;
    this.lastUpdateTime = null;
    
    this.drones.forEach(drone => {
      drone.currentPosition = null;
      drone.batteryLevel = 100;
      drone.isActive = false;
    });
    
    this.currentStates = null;
    this.emit('update');
  }

  seekTo(time) {
    this.currentTime = Math.max(0, Math.min(time, this.totalTime));
    this.update();
  }

  setPlaybackSpeed(speed) {
    this.playbackSpeed = speed;
  }

  update() {
    if (this.isPlaying) {
      const now = performance.now();
      if (this.lastUpdateTime) {
        const delta = (now - this.lastUpdateTime) / 1000;
        this.currentTime += delta * this.playbackSpeed;
        
        if (this.currentTime >= this.totalTime) {
          this.currentTime = this.totalTime;
          this.isPlaying = false;
        }
      }
      this.lastUpdateTime = now;
    }

    this.updateDroneStates();
    this.checkCollisions();
    this.checkNoFlyViolations();
    this.checkBatteryLevels();

    this.emit('update');

    if (this.isPlaying) {
      requestAnimationFrame(() => this.update());
    }
  }

  updateDroneStates() {
    this.currentStates = [];

    this.drones.forEach(drone => {
      const state = this.getDroneStateAtTime(drone, this.currentTime);
      drone.currentPosition = state.position;
      drone.isActive = state.isActive;
      drone.batteryLevel = state.batteryLevel;

      this.currentStates.push(state);
    });
  }

  getDroneStateAtTime(drone, time) {
    if (time < drone.startTime) {
      return {
        id: drone.id,
        name: drone.name,
        position: null,
        isActive: false,
        batteryLevel: 100,
        currentWaypointIndex: -1
      };
    }

    if (drone.endTime !== null && time > drone.endTime) {
      return {
        id: drone.id,
        name: drone.name,
        position: null,
        isActive: false,
        batteryLevel: this.calculateBatteryLevel(drone, drone.endTime),
        currentWaypointIndex: drone.waypoints.length - 1
      };
    }

    if (drone.waypoints.length === 0) {
      return {
        id: drone.id,
        name: drone.name,
        position: null,
        isActive: false,
        batteryLevel: 100,
        currentWaypointIndex: -1
      };
    }

    let beforeWp = null;
    let afterWp = null;
    let wpIndex = -1;

    for (let i = 0; i < drone.waypoints.length; i++) {
      const wp = drone.waypoints[i];
      if (wp.time <= time) {
        beforeWp = wp;
        wpIndex = i;
      } else {
        afterWp = wp;
        break;
      }
    }

    if (!beforeWp) {
      beforeWp = drone.waypoints[0];
      wpIndex = 0;
    }

    if (!afterWp) {
      afterWp = beforeWp;
    }

    const position = this.interpolatePosition(beforeWp, afterWp, time);

    return {
      id: drone.id,
      name: drone.name,
      position: position,
      isActive: true,
      batteryLevel: this.calculateBatteryLevel(drone, time),
      currentWaypointIndex: wpIndex,
      color: drone.color
    };
  }

  interpolatePosition(beforeWp, afterWp, time) {
    if (beforeWp.time === afterWp.time) {
      return {
        x: beforeWp.x,
        y: beforeWp.y,
        z: beforeWp.z
      };
    }

    const t = (time - beforeWp.time) / (afterWp.time - beforeWp.time);
    const clampedT = Math.max(0, Math.min(1, t));

    return {
      x: beforeWp.x + (afterWp.x - beforeWp.x) * clampedT,
      y: beforeWp.y + (afterWp.y - beforeWp.y) * clampedT,
      z: beforeWp.z + (afterWp.z - beforeWp.z) * clampedT
    };
  }

  calculateBatteryLevel(drone, time) {
    const battery = this.batteries.find(b => b.id === drone.batteryId);
    
    if (!battery) {
      const activeTime = Math.max(0, time - drone.startTime);
      return Math.max(0, 100 - activeTime * 0.5);
    }

    const drainRate = battery.drainRate || 0.5;
    const activeTime = Math.max(0, time - drone.startTime);
    const initialCapacity = battery.capacity || 100;
    
    return Math.max(0, initialCapacity - activeTime * drainRate);
  }

  checkCollisions() {
    if (!this.currentStates) return;

    const activeDrones = this.currentStates.filter(s => s.isActive && s.position);
    
    let minDistance = Infinity;
    let collisionPairs = [];

    for (let i = 0; i < activeDrones.length; i++) {
      for (let j = i + 1; j < activeDrones.length; j++) {
        const d1 = activeDrones[i];
        const d2 = activeDrones[j];

        const dist = this.distance3D(d1.position, d2.position);
        
        if (dist < minDistance) {
          minDistance = dist;
        }

        if (dist < this.minCollisionDistance) {
          collisionPairs.push({
            drone1: d1.id,
            drone2: d2.id,
            distance: dist,
            position1: d1.position,
            position2: d2.position
          });
        }
      }
    }

    if (collisionPairs.length > 0) {
      this.emit('collision', {
        time: this.currentTime,
        description: `检测到 ${collisionPairs.length} 起碰撞风险`,
        details: collisionPairs
      });
    }
  }

  checkNoFlyViolations() {
    if (!this.currentStates) return;

    const activeDrones = this.currentStates.filter(s => s.isActive && s.position);
    const violations = [];

    activeDrones.forEach(drone => {
      this.noFlyZones.forEach(zone => {
        if (this.isInNoFlyZone(drone.position, zone)) {
          if (zone.startTime !== undefined && this.currentTime < zone.startTime) return;
          if (zone.endTime !== undefined && zone.endTime !== null && this.currentTime > zone.endTime) return;

          if (drone.position.z < zone.minAltitude || drone.position.z > zone.maxAltitude) {
            return;
          }

          violations.push({
            droneId: drone.id,
            zoneId: zone.id,
            zoneName: zone.name,
            position: drone.position
          });
        }
      });
    });

    if (violations.length > 0) {
      this.emit('noFlyViolation', {
        time: this.currentTime,
        description: `检测到 ${violations.length} 起禁飞区穿越`,
        details: violations
      });
    }
  }

  isInNoFlyZone(position, zone) {
    if (zone.shape === 'circle') {
      const dx = position.x - zone.center.x;
      const dy = position.y - zone.center.y;
      const dist2D = Math.sqrt(dx * dx + dy * dy);
      return dist2D <= zone.radius;
    }

    if (zone.shape === 'polygon' && zone.coordinates && zone.coordinates.length >= 3) {
      return this.pointInPolygon(position, zone.coordinates);
    }

    return false;
  }

  pointInPolygon(point, polygon) {
    let inside = false;
    const x = point.x;
    const y = point.y;

    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const xi = polygon[i].x;
      const yi = polygon[i].y;
      const xj = polygon[j].x;
      const yj = polygon[j].y;

      const intersect = ((yi > y) !== (yj > y)) &&
        (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
      
      if (intersect) {
        inside = !inside;
      }
    }

    return inside;
  }

  checkBatteryLevels() {
    if (!this.currentStates) return;

    const lowBatteryDrones = this.currentStates.filter(s => 
      s.isActive && s.batteryLevel < this.lowBatteryThreshold
    );

    if (lowBatteryDrones.length > 0) {
      const criticalDrones = lowBatteryDrones.filter(s => 
        s.batteryLevel < this.criticalBatteryThreshold
      );

      this.emit('batteryWarning', {
        time: this.currentTime,
        description: `检测到 ${lowBatteryDrones.length} 架无人机低电量`,
        details: lowBatteryDrones.map(d => ({
          droneId: d.id,
          batteryLevel: d.batteryLevel,
          isCritical: d.batteryLevel < this.criticalBatteryThreshold
        }))
      });
    }
  }

  distance3D(p1, p2) {
    const dx = p1.x - p2.x;
    const dy = p1.y - p2.y;
    const dz = p1.z - p2.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }

  getDroneStates() {
    return this.currentStates || [];
  }

  getStats() {
    const activeDrones = this.currentStates ? 
      this.currentStates.filter(s => s.isActive).length : 0;

    let minDistance = null;
    let hasCollisionRisk = false;
    let hasNoFlyViolation = false;
    let hasBatteryWarning = false;

    if (this.currentStates) {
      const active = this.currentStates.filter(s => s.isActive && s.position);
      
      for (let i = 0; i < active.length; i++) {
        for (let j = i + 1; j < active.length; j++) {
          const dist = this.distance3D(active[i].position, active[j].position);
          if (minDistance === null || dist < minDistance) {
            minDistance = dist;
          }
          if (dist < this.minCollisionDistance) {
            hasCollisionRisk = true;
          }
        }
      }

      active.forEach(drone => {
        this.noFlyZones.forEach(zone => {
          if (this.isInNoFlyZone(drone.position, zone)) {
            hasNoFlyViolation = true;
          }
        });
      });

      hasBatteryWarning = active.some(s => s.batteryLevel < this.lowBatteryThreshold);
    }

    return {
      currentTime: this.currentTime,
      totalTime: this.totalTime,
      droneCount: this.drones.length,
      activeDrones: activeDrones,
      noFlyCount: this.noFlyZones.length,
      minDistance: minDistance,
      hasCollisionRisk: hasCollisionRisk,
      hasNoFlyViolation: hasNoFlyViolation,
      hasBatteryWarning: hasBatteryWarning,
      isPlaying: this.isPlaying
    };
  }

  runFullAnalysis() {
    const results = {
      collisions: [],
      noFlyViolations: [],
      batteryWarnings: [],
      minDistances: []
    };

    const step = 0.1;
    const originalTime = this.currentTime;

    for (let t = 0; t <= this.totalTime; t += step) {
      this.currentTime = t;
      this.updateDroneStates();

      const activeDrones = this.currentStates.filter(s => s.isActive && s.position);

      let currentMinDist = null;
      for (let i = 0; i < activeDrones.length; i++) {
        for (let j = i + 1; j < activeDrones.length; j++) {
          const dist = this.distance3D(activeDrones[i].position, activeDrones[j].position);
          
          if (currentMinDist === null || dist < currentMinDist) {
            currentMinDist = dist;
          }

          if (dist < this.minCollisionDistance) {
            results.collisions.push({
              time: t,
              drone1: activeDrones[i].id,
              drone2: activeDrones[j].id,
              distance: dist
            });
          }
        }
      }

      if (currentMinDist !== null) {
        results.minDistances.push({
          time: t,
          distance: currentMinDist
        });
      }

      activeDrones.forEach(drone => {
        this.noFlyZones.forEach(zone => {
          if (this.isInNoFlyZone(drone.position, zone)) {
            results.noFlyViolations.push({
              time: t,
              droneId: drone.id,
              zoneId: zone.id,
              zoneName: zone.name
            });
          }
        });

        if (drone.batteryLevel < this.lowBatteryThreshold) {
          results.batteryWarnings.push({
            time: t,
            droneId: drone.id,
            batteryLevel: drone.batteryLevel
          });
        }
      });
    }

    this.currentTime = originalTime;
    this.update();

    return results;
  }
}

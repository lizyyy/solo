export class RuleEngine {
  constructor(config = {}) {
    this.config = {
      speedLimit: config.speedLimit || 5,
      reverseSpeedLimit: config.reverseSpeedLimit || 3,
      blindSpotDistance: config.blindSpotDistance || 5,
      blindSpotAngle: config.blindSpotAngle || 90,
      turningSpeedLimit: config.turningSpeedLimit || 3,
      ...config
    };
    
    this.detectedEvents = [];
  }

  runAllChecks(trajectoryData, shelvesData, nearMissEvents = []) {
    this.detectedEvents = [];

    if (!trajectoryData || !trajectoryData.points) {
      return this.detectedEvents;
    }

    this.checkOverspeed(trajectoryData);
    this.checkTurningOverspeed(trajectoryData);
    this.checkReverseOverspeed(trajectoryData);
    
    if (shelvesData) {
      this.checkBlindSpotEncounters(trajectoryData, shelvesData);
      this.checkNoEntryZones(trajectoryData, shelvesData);
      this.checkTemporaryObstacles(trajectoryData, shelvesData);
    }

    if (nearMissEvents && nearMissEvents.length > 0) {
      this.detectedEvents = this.detectedEvents.concat(nearMissEvents);
    }

    this.detectedEvents.sort((a, b) => a.timestamp - b.timestamp);

    return this.detectedEvents;
  }

  checkOverspeed(trajectoryData) {
    const points = trajectoryData.points;
    let currentEvent = null;

    for (let i = 0; i < points.length; i++) {
      const point = points[i];
      const speed = Math.abs(point.speed ?? point.calculatedSpeed ?? 0);
      const limit = point.speedLimit ?? this.config.speedLimit;

      if (speed > limit) {
        if (!currentEvent) {
          currentEvent = {
            id: `overspeed_${Date.now()}_${i}`,
            type: 'overspeed',
            timestamp: point.timestamp,
            startTime: point.timestamp,
            endTime: point.timestamp,
            startPoint: { ...point },
            maxSpeed: speed,
            speedLimit: limit,
            location: { ...point.position },
            severity: this.getSpeedSeverity(speed, limit),
            description: `检测到超速: ${speed.toFixed(2)} km/h, 限速: ${limit} km/h`,
            reviewStatus: 'unreviewed',
            reviewNotes: '',
            involvedEntities: [{
              type: 'forklift',
              id: point.forkliftId
            }]
          };
        } else {
          currentEvent.endTime = point.timestamp;
          currentEvent.maxSpeed = Math.max(currentEvent.maxSpeed, speed);
        }
      } else {
        if (currentEvent) {
          const duration = (currentEvent.endTime - currentEvent.startTime) / 1000;
          if (duration >= 1) {
            currentEvent.description = `检测到超速: 最大 ${currentEvent.maxSpeed.toFixed(2)} km/h, 限速: ${currentEvent.speedLimit} km/h, 持续 ${duration.toFixed(1)} 秒`;
            this.detectedEvents.push(currentEvent);
          }
          currentEvent = null;
        }
      }
    }

    if (currentEvent) {
      const duration = (currentEvent.endTime - currentEvent.startTime) / 1000;
      if (duration >= 1) {
        currentEvent.description = `检测到超速: 最大 ${currentEvent.maxSpeed.toFixed(2)} km/h, 限速: ${currentEvent.speedLimit} km/h, 持续 ${duration.toFixed(1)} 秒`;
        this.detectedEvents.push(currentEvent);
      }
    }
  }

  checkTurningOverspeed(trajectoryData) {
    const points = trajectoryData.points;
    
    for (let i = 1; i < points.length - 1; i++) {
      const prevPoint = points[i-1];
      const currPoint = points[i];
      const nextPoint = points[i+1];

      const prevAngle = prevPoint.directionAngle ?? prevPoint.direction ?? 0;
      const currAngle = currPoint.directionAngle ?? currPoint.direction ?? 0;
      const nextAngle = nextPoint.directionAngle ?? nextPoint.direction ?? 0;

      let angleChange = Math.abs(nextAngle - prevAngle);
      if (angleChange > 180) angleChange = 360 - angleChange;

      if (angleChange > 30) {
        const speed = Math.abs(currPoint.speed ?? currPoint.calculatedSpeed ?? 0);
        
        if (speed > this.config.turningSpeedLimit) {
          this.detectedEvents.push({
            id: `turning_overspeed_${Date.now()}_${i}`,
            type: 'overspeed',
            subType: 'turning',
            timestamp: currPoint.timestamp,
            location: { ...currPoint.position },
            speed: speed,
            angleChange: angleChange,
            speedLimit: this.config.turningSpeedLimit,
            severity: speed > this.config.turningSpeedLimit * 1.5 ? 'high' : 'medium',
            description: `转弯时超速: ${speed.toFixed(2)} km/h, 转弯限速: ${this.config.turningSpeedLimit} km/h, 转向角度变化: ${angleChange.toFixed(1)}°`,
            reviewStatus: 'unreviewed',
            reviewNotes: '',
            involvedEntities: [{
              type: 'forklift',
              id: currPoint.forkliftId
            }]
          });
        }
      }
    }
  }

  checkReverseOverspeed(trajectoryData) {
    const points = trajectoryData.points;
    let currentEvent = null;

    for (let i = 0; i < points.length; i++) {
      const point = points[i];
      const isReversing = point.isReversing || point.gear === 'reverse';
      
      if (isReversing) {
        const speed = Math.abs(point.speed ?? point.calculatedSpeed ?? 0);
        
        if (speed > this.config.reverseSpeedLimit) {
          if (!currentEvent) {
            currentEvent = {
              id: `reverse_overspeed_${Date.now()}_${i}`,
              type: 'overspeed',
              subType: 'reverse',
              timestamp: point.timestamp,
              startTime: point.timestamp,
              endTime: point.timestamp,
              startPoint: { ...point },
              maxSpeed: speed,
              speedLimit: this.config.reverseSpeedLimit,
              location: { ...point.position },
              severity: speed > this.config.reverseSpeedLimit * 1.5 ? 'high' : 'medium',
              description: `倒车时超速检测中: ${speed.toFixed(2)} km/h, 倒车限速: ${this.config.reverseSpeedLimit} km/h`,
              reviewStatus: 'unreviewed',
              reviewNotes: '',
              involvedEntities: [{
                type: 'forklift',
                id: point.forkliftId
              }]
            };
          } else {
            currentEvent.endTime = point.timestamp;
            currentEvent.maxSpeed = Math.max(currentEvent.maxSpeed, speed);
          }
        } else {
          if (currentEvent) {
            const duration = (currentEvent.endTime - currentEvent.startTime) / 1000;
            currentEvent.description = `倒车时超速: 最大 ${currentEvent.maxSpeed.toFixed(2)} km/h, 倒车限速: ${currentEvent.speedLimit} km/h, 持续 ${duration.toFixed(1)} 秒`;
            this.detectedEvents.push(currentEvent);
            currentEvent = null;
          }
        }
      } else {
        if (currentEvent) {
          const duration = (currentEvent.endTime - currentEvent.startTime) / 1000;
          currentEvent.description = `倒车时超速: 最大 ${currentEvent.maxSpeed.toFixed(2)} km/h, 倒车限速: ${currentEvent.speedLimit} km/h, 持续 ${duration.toFixed(1)} 秒`;
          this.detectedEvents.push(currentEvent);
          currentEvent = null;
        }
      }
    }
  }

  checkBlindSpotEncounters(trajectoryData, shelvesData) {
    if (!shelvesData || !shelvesData.shelves) return;

    const blindSpots = shelvesData.shelves.filter(s => s.isBlindSpot);
    if (blindSpots.length === 0) return;

    const points = trajectoryData.points;
    const encounters = [];

    for (let i = 0; i < points.length; i++) {
      const point = points[i];
      
      for (const shelf of blindSpots) {
        const dx = point.position.x - shelf.position.x;
        const dz = point.position.z - shelf.position.z;
        const distance = Math.sqrt(dx * dx + dz * dz);

        if (distance <= this.config.blindSpotDistance) {
          const angleToForklift = Math.atan2(dz, dx) * (180 / Math.PI);
          const shelfBlindAngle = shelf.blindSpotZone?.angle ?? this.config.blindSpotAngle;
          
          const isInBlindZone = this.isInAngleRange(
            angleToForklift,
            point.directionAngle ?? point.direction ?? 0,
            shelfBlindAngle
          );

          const nearbyEncounter = encounters.find(e => 
            e.shelfId === shelf.id && 
            (point.timestamp - e.lastTimestamp) < 2000
          );

          if (nearbyEncounter) {
            nearbyEncounter.endTime = point.timestamp;
            nearbyEncounter.endPoint = { ...point };
            nearbyEncounter.minDistance = Math.min(nearbyEncounter.minDistance, distance);
            nearbyEncounter.lastTimestamp = point.timestamp;
            nearbyEncounter.isInBlindZone = nearbyEncounter.isInBlindZone || isInBlindZone;
          } else {
            encounters.push({
              id: `blind_spot_${Date.now()}_${i}_${shelf.id}`,
              shelfId: shelf.id,
              shelfName: shelf.name,
              timestamp: point.timestamp,
              startTime: point.timestamp,
              endTime: point.timestamp,
              startPoint: { ...point },
              endPoint: { ...point },
              minDistance: distance,
              lastTimestamp: point.timestamp,
              isInBlindZone: isInBlindZone,
              speed: point.speed ?? point.calculatedSpeed ?? 0
            });
          }
        }
      }
    }

    encounters.forEach(encounter => {
      const duration = (encounter.endTime - encounter.startTime) / 1000;
      
      if (duration >= 1) {
        this.detectedEvents.push({
          id: encounter.id,
          type: 'blind-spot',
          timestamp: encounter.startTime,
          startTime: encounter.startTime,
          endTime: encounter.endTime,
          duration: duration,
          location: { ...encounter.startPoint.position },
          shelfId: encounter.shelfId,
          shelfName: encounter.shelfName,
          minDistance: encounter.minDistance,
          isInBlindZone: encounter.isInBlindZone,
          speed: encounter.speed,
          severity: (encounter.minDistance < 2 && encounter.speed > 3) ? 'high' : 
                    (encounter.minDistance < 3) ? 'medium' : 'low',
          description: `${encounter.isInBlindZone ? '进入盲区区域' : '接近盲区'}: 货架 '${encounter.shelfName}', 最近距离 ${encounter.minDistance.toFixed(2)}m, 持续 ${duration.toFixed(1)} 秒`,
          reviewStatus: 'unreviewed',
          reviewNotes: '',
          involvedEntities: [
            { type: 'forklift', id: encounter.startPoint.forkliftId },
            { type: 'shelf', id: encounter.shelfId, name: encounter.shelfName }
          ]
        });
      }
    });
  }

  checkNoEntryZones(trajectoryData, shelvesData) {
    if (!shelvesData || !shelvesData.noEntryZones || shelvesData.noEntryZones.length === 0) return;

    const points = trajectoryData.points;

    for (let i = 0; i < points.length; i++) {
      const point = points[i];

      for (const zone of shelvesData.noEntryZones) {
        const isInZone = this.isPointInZone(point.position, zone);
        
        if (isInZone) {
          const lastEvent = this.detectedEvents[this.detectedEvents.length - 1];
          const isContinuing = lastEvent && 
            lastEvent.type === 'no-entry' && 
            lastEvent.zoneId === zone.id &&
            (point.timestamp - lastEvent.endTime) < 2000;

          if (isContinuing) {
            lastEvent.endTime = point.timestamp;
          } else {
            this.detectedEvents.push({
              id: `no_entry_${Date.now()}_${i}`,
              type: 'no-entry',
              zoneId: zone.id,
              zoneName: zone.name || '未命名禁行区',
              timestamp: point.timestamp,
              startTime: point.timestamp,
              endTime: point.timestamp,
              location: { ...point.position },
              zone: zone,
              severity: 'high',
              description: `进入禁行区: ${zone.name || '未命名禁行区'}`,
              reviewStatus: 'unreviewed',
              reviewNotes: '',
              involvedEntities: [
                { type: 'forklift', id: point.forkliftId },
                { type: 'zone', id: zone.id, name: zone.name }
              ]
            });
          }
        }
      }
    }

    this.detectedEvents.filter(e => e.type === 'no-entry').forEach(event => {
      const duration = (event.endTime - event.startTime) / 1000;
      event.duration = duration;
      event.description = `进入禁行区: ${event.zoneName}, 持续 ${duration.toFixed(1)} 秒`;
    });
  }

  checkTemporaryObstacles(trajectoryData, shelvesData) {
    if (!shelvesData || !shelvesData.temporaryObstacles || shelvesData.temporaryObstacles.length === 0) return;

    const points = trajectoryData.points;

    for (let i = 0; i < points.length; i++) {
      const point = points[i];

      for (const obstacle of shelvesData.temporaryObstacles) {
        const dx = point.position.x - obstacle.position.x;
        const dz = point.position.z - obstacle.position.z;
        const distance = Math.sqrt(dx * dx + dz * dz);

        const obstacleRadius = obstacle.size?.radius ?? 1.5;
        
        if (distance < obstacleRadius + 1) {
          const lastEvent = this.detectedEvents.find(e => 
            e.type === 'obstacle' && 
            e.obstacleId === obstacle.id &&
            (point.timestamp - e.endTime) < 2000
          );

          if (lastEvent) {
            lastEvent.endTime = point.timestamp;
            lastEvent.minDistance = Math.min(lastEvent.minDistance, distance);
          } else {
            this.detectedEvents.push({
              id: `obstacle_${Date.now()}_${i}`,
              type: 'near-miss',
              subType: 'temporary-obstacle',
              obstacleId: obstacle.id,
              obstacleName: obstacle.name || '临时障碍物',
              timestamp: point.timestamp,
              startTime: point.timestamp,
              endTime: point.timestamp,
              location: { ...point.position },
              minDistance: distance,
              obstacle: obstacle,
              severity: distance < obstacleRadius ? 'high' : 'medium',
              description: `接近临时障碍物: ${obstacle.name || '托盘占道'}, 距离 ${distance.toFixed(2)}m`,
              reviewStatus: 'unreviewed',
              reviewNotes: '',
              involvedEntities: [
                { type: 'forklift', id: point.forkliftId },
                { type: 'obstacle', id: obstacle.id, name: obstacle.name }
              ]
            });
          }
        }
      }
    }
  }

  isInAngleRange(angle, centerAngle, rangeAngle) {
    let diff = angle - centerAngle;
    while (diff > 180) diff -= 360;
    while (diff < -180) diff += 360;
    return Math.abs(diff) <= rangeAngle / 2;
  }

  isPointInZone(point, zone) {
    if (zone.type === 'circle' || zone.radius) {
      const dx = point.x - (zone.center?.x ?? zone.x ?? 0);
      const dz = point.z - (zone.center?.z ?? zone.z ?? 0);
      const distance = Math.sqrt(dx * dx + dz * dz);
      return distance <= (zone.radius ?? 5);
    }
    
    if (zone.type === 'rectangle' || zone.width) {
      const minX = (zone.position?.x ?? zone.x ?? 0) - (zone.width ?? 2) / 2;
      const maxX = (zone.position?.x ?? zone.x ?? 0) + (zone.width ?? 2) / 2;
      const minZ = (zone.position?.z ?? zone.z ?? 0) - (zone.depth ?? 2) / 2;
      const maxZ = (zone.position?.z ?? zone.z ?? 0) + (zone.depth ?? 2) / 2;
      
      return point.x >= minX && point.x <= maxX && 
             point.z >= minZ && point.z <= maxZ;
    }

    return false;
  }

  getSpeedSeverity(speed, limit) {
    const ratio = speed / limit;
    if (ratio >= 1.5) return 'high';
    if (ratio >= 1.2) return 'medium';
    return 'low';
  }

  getEvents() {
    return [...this.detectedEvents];
  }

  getEventsByType(type) {
    return this.detectedEvents.filter(e => e.type === type);
  }

  getStatistics() {
    const stats = {
      total: this.detectedEvents.length,
      byType: {},
      bySeverity: { high: 0, medium: 0, low: 0 },
      byReviewStatus: { unreviewed: 0, reviewed: 0, dismissed: 0, confirmed: 0 }
    };

    this.detectedEvents.forEach(event => {
      stats.byType[event.type] = (stats.byType[event.type] || 0) + 1;
      stats.bySeverity[event.severity] = (stats.bySeverity[event.severity] || 0) + 1;
      stats.byReviewStatus[event.reviewStatus] = (stats.byReviewStatus[event.reviewStatus] || 0) + 1;
    });

    return stats;
  }
}

export default RuleEngine;

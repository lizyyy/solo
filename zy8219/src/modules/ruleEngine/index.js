export class RuleEngine {
  constructor(rules, warehouseLayout) {
    this.rules = rules;
    this.warehouseLayout = warehouseLayout;
    this.risks = [];
    this.statistics = {
      totalBlindSpotRisks: 0,
      totalNearMissRisks: 0,
      totalWrongWayRisks: 0,
      totalTurningBlindSpotRisks: 0,
      criticalRisks: 0,
      warningRisks: 0
    };
  }

  calculateAllRisks(trajectoryData, pedestrianEvents) {
    this.risks = [];
    this.statistics = {
      totalBlindSpotRisks: 0,
      totalNearMissRisks: 0,
      totalWrongWayRisks: 0,
      totalTurningBlindSpotRisks: 0,
      criticalRisks: 0,
      warningRisks: 0
    };

    const processedTrajectory = this.processTrajectoryForAnalysis(trajectoryData);
    const aisles = this.warehouseLayout?.aisles || [];

    for (let i = 1; i < processedTrajectory.length; i++) {
      const currentPoint = processedTrajectory[i];
      const prevPoint = processedTrajectory[i - 1];
      const currentTime = currentPoint.timestamp;

      if (this.rules.wrongWay?.enabled) {
        const wrongWayRisk = this.checkWrongWay(currentPoint, prevPoint, aisles);
        if (wrongWayRisk) {
          this.addRisk(wrongWayRisk);
          this.statistics.totalWrongWayRisks++;
        }
      }

      if (this.rules.turningBlindSpot?.enabled) {
        const turningBlindSpotRisk = this.checkTurningBlindSpot(currentPoint, prevPoint, processedTrajectory, i);
        if (turningBlindSpotRisk) {
          this.addRisk(turningBlindSpotRisk);
          this.statistics.totalTurningBlindSpotRisks++;
        }
      }

      if (this.rules.blindSpot?.enabled) {
        const blindSpotRisks = this.checkShelfBlindSpot(currentPoint);
        blindSpotRisks.forEach(risk => {
          this.addRisk(risk);
          this.statistics.totalBlindSpotRisks++;
        });
      }
    }

    if (this.rules.nearMiss?.enabled && pedestrianEvents.length > 0) {
      const nearMissRisks = this.checkNearMiss(processedTrajectory, pedestrianEvents);
      nearMissRisks.forEach(risk => {
        this.addRisk(risk);
        this.statistics.totalNearMissRisks++;
      });
    }

    return {
      risks: this.risks,
      statistics: this.statistics
    };
  }

  processTrajectoryForAnalysis(trajectoryData) {
    return trajectoryData.map((point, index) => {
      const processed = { ...point };
      
      if (index > 0) {
        const prevPoint = trajectoryData[index - 1];
        if (prevPoint.x !== null && prevPoint.z !== null && point.x !== null && point.z !== null) {
          const dx = point.x - prevPoint.x;
          const dz = point.z - prevPoint.z;
          processed.direction = Math.atan2(dx, dz) * (180 / Math.PI);
          processed.speed = Math.sqrt(dx * dx + dz * dz);
        }
      }
      
      return processed;
    });
  }

  checkWrongWay(currentPoint, prevPoint, aisles) {
    if (!currentPoint.direction || !aisles || aisles.length === 0) return null;

    const currentAisle = this.findCurrentAisle(currentPoint, aisles);
    if (!currentAisle) return null;

    const allowedDirection = currentAisle.allowedDirection || this.rules.wrongWay.allowedDirection;
    if (allowedDirection === 'both') return null;

    const aisleDirection = this.getAisleDirection(currentAisle);
    const directionDifference = Math.abs(this.normalizeAngle(currentPoint.direction - aisleDirection));

    const threshold = this.rules.wrongWay.violationThreshold;
    let isWrongWay = false;

    if (allowedDirection === 'forward') {
      isWrongWay = directionDifference > 90 + threshold;
    } else if (allowedDirection === 'backward') {
      isWrongWay = directionDifference < 90 - threshold && directionDifference > -90 + threshold;
    }

    if (isWrongWay) {
      return {
        type: 'wrong_way',
        severity: 'warning',
        timestamp: currentPoint.timestamp,
        location: { x: currentPoint.x, y: currentPoint.y, z: currentPoint.z },
        details: {
          currentDirection: currentPoint.direction,
          allowedDirection: allowedDirection,
          aisleId: currentAisle.id,
          aisleName: currentAisle.name
        },
        description: `叉车在通道 ${currentAisle.name || currentAisle.id} 逆行`
      };
    }

    return null;
  }

  findCurrentAisle(point, aisles) {
    for (const aisle of aisles) {
      if (this.isPointInAisle(point, aisle)) {
        return aisle;
      }
    }
    return null;
  }

  isPointInAisle(point, aisle) {
    if (!aisle.bounds) return false;
    
    const { x, z } = point;
    const { minX, maxX, minZ, maxZ } = aisle.bounds;
    
    return x >= minX && x <= maxX && z >= minZ && z <= maxZ;
  }

  getAisleDirection(aisle) {
    if (aisle.direction !== undefined) return aisle.direction;
    
    if (aisle.bounds) {
      const dx = aisle.bounds.maxX - aisle.bounds.minX;
      const dz = aisle.bounds.maxZ - aisle.bounds.minZ;
      return Math.atan2(dx, dz) * (180 / Math.PI);
    }
    
    return 0;
  }

  normalizeAngle(angle) {
    while (angle > 180) angle -= 360;
    while (angle < -180) angle += 360;
    return angle;
  }

  checkTurningBlindSpot(currentPoint, prevPoint, trajectory, currentIndex) {
    if (currentIndex < 5) return null;
    
    const recentPoints = trajectory.slice(Math.max(0, currentIndex - 10), currentIndex + 1);
    const validPoints = recentPoints.filter(p => p.direction !== undefined);
    
    if (validPoints.length < 3) return null;

    const startDirection = validPoints[0].direction;
    const endDirection = validPoints[validPoints.length - 1].direction;
    const angleChange = Math.abs(this.normalizeAngle(endDirection - startDirection));

    const threshold = this.rules.turningBlindSpot.turningAngleThreshold;
    
    if (angleChange >= threshold) {
      const turningDirection = endDirection > startDirection ? 'left' : 'right';
      
      return {
        type: 'turning_blind_spot',
        severity: 'warning',
        timestamp: currentPoint.timestamp,
        location: { x: currentPoint.x, y: currentPoint.y, z: currentPoint.z },
        details: {
          angleChange: angleChange,
          turningDirection: turningDirection,
          extraBlindDistance: this.rules.turningBlindSpot.extraBlindDistance
        },
        description: `叉车${turningDirection === 'left' ? '左' : '右'}转，角度变化 ${angleChange.toFixed(1)}°，存在转弯盲区风险`
      };
    }

    return null;
  }

  checkShelfBlindSpot(currentPoint) {
    const risks = [];
    const racks = this.warehouseLayout?.racks || [];
    
    const detectionDistance = this.rules.blindSpot.detectionDistance;
    const warningDistance = this.rules.blindSpot.warningDistance;
    const detectionAngle = this.rules.blindSpot.detectionAngle;

    const forkliftDirection = currentPoint.direction || 0;

    for (const rack of racks) {
      const distance = this.getDistanceToRack(currentPoint, rack);
      
      if (distance <= detectionDistance) {
        const angleToRack = this.getAngleToRack(currentPoint, rack);
        const angleDifference = Math.abs(this.normalizeAngle(angleToRack - forkliftDirection));
        
        if (angleDifference <= detectionAngle / 2) {
          const isObscured = this.isRackObscuringView(currentPoint, rack, forkliftDirection);
          
          if (isObscured || distance <= warningDistance) {
            const severity = distance <= warningDistance ? 'warning' : 'info';
            
            risks.push({
              type: 'blind_spot',
              severity: severity,
              timestamp: currentPoint.timestamp,
              location: { x: currentPoint.x, y: currentPoint.y, z: currentPoint.z },
              details: {
                rackId: rack.id,
                rackName: rack.name,
                distance: distance,
                angleToRack: angleToRack,
                isObscured: isObscured
              },
              description: `货架 ${rack.name || rack.id} 可能遮挡视线，距离 ${distance.toFixed(2)}m`
            });
          }
        }
      }
    }

    return risks;
  }

  getDistanceToRack(point, rack) {
    const rackCenter = this.getRackCenter(rack);
    const dx = point.x - rackCenter.x;
    const dz = point.z - rackCenter.z;
    return Math.sqrt(dx * dx + dz * dz);
  }

  getRackCenter(rack) {
    if (rack.position) {
      return {
        x: rack.position.x,
        z: rack.position.z
      };
    }
    if (rack.bounds) {
      return {
        x: (rack.bounds.minX + rack.bounds.maxX) / 2,
        z: (rack.bounds.minZ + rack.bounds.maxZ) / 2
      };
    }
    return { x: 0, z: 0 };
  }

  getAngleToRack(point, rack) {
    const rackCenter = this.getRackCenter(rack);
    const dx = rackCenter.x - point.x;
    const dz = rackCenter.z - point.z;
    return Math.atan2(dx, dz) * (180 / Math.PI);
  }

  isRackObscuringView(point, rack, direction) {
    const rackCenter = this.getRackCenter(rack);
    const angleToRack = this.getAngleToRack(point, rack);
    const angleDifference = Math.abs(this.normalizeAngle(angleToRack - direction));
    
    return angleDifference < 45;
  }

  checkNearMiss(trajectoryData, pedestrianEvents) {
    const risks = [];
    const warningDistance = this.rules.nearMiss.warningDistance;
    const criticalDistance = this.rules.nearMiss.criticalDistance;

    for (const pedestrian of pedestrianEvents) {
      for (const trajectoryPoint of trajectoryData) {
        const timeDiff = Math.abs(trajectoryPoint.timestamp - pedestrian.timestamp);
        
        if (timeDiff < 5000) {
          const distance = this.calculateDistance(
            { x: trajectoryPoint.x, z: trajectoryPoint.z },
            { x: pedestrian.x, z: pedestrian.z }
          );

          if (distance <= warningDistance) {
            const severity = distance <= criticalDistance ? 'critical' : 'warning';
            
            risks.push({
              type: 'near_miss',
              severity: severity,
              timestamp: trajectoryPoint.timestamp,
              location: { 
                x: (trajectoryPoint.x + pedestrian.x) / 2, 
                y: 0, 
                z: (trajectoryPoint.z + pedestrian.z) / 2 
              },
              details: {
                distance: distance,
                timeDifference: timeDiff,
                forkliftLocation: { x: trajectoryPoint.x, z: trajectoryPoint.z },
                pedestrianLocation: { x: pedestrian.x, z: pedestrian.z },
                pedestrianId: pedestrian.id || pedestrian.pedestrian_id
              },
              description: `近失事件：与行人距离 ${distance.toFixed(2)}m`
            });
            
            if (severity === 'critical') {
              this.statistics.criticalRisks++;
            } else {
              this.statistics.warningRisks++;
            }
          }
        }
      }
    }

    return risks;
  }

  calculateDistance(point1, point2) {
    const dx = point1.x - point2.x;
    const dz = point1.z - point2.z;
    return Math.sqrt(dx * dx + dz * dz);
  }

  addRisk(risk) {
    this.risks.push(risk);
    
    if (risk.severity === 'critical') {
      this.statistics.criticalRisks++;
    } else if (risk.severity === 'warning') {
      this.statistics.warningRisks++;
    }
  }

  getRisksByType(type) {
    return this.risks.filter(risk => risk.type === type);
  }

  getRisksBySeverity(severity) {
    return this.risks.filter(risk => risk.severity === severity);
  }

  getTimeRangeRisks(startTime, endTime) {
    return this.risks.filter(risk => 
      risk.timestamp >= startTime && risk.timestamp <= endTime
    );
  }

  getStatistics() {
    return { ...this.statistics };
  }
}

export default RuleEngine;

class RulesEngine {
  constructor(scoringSystem) {
    this.level = null;
    this.vehicle = null;
    this.scoringSystem = scoringSystem;
    
    this.lastCollisionCheck = 0;
    this.lastSpeedCheck = 0;
    this.lastBlindSpotCheck = 0;
    
    this.checkInterval = 0.1;
  }

  setLevel(level) {
    this.level = level;
  }

  setVehicle(vehicle) {
    this.vehicle = vehicle;
  }

  checkAll(elapsedTime) {
    const violations = [];
    
    const collisionViolation = this.checkCollision();
    if (collisionViolation) {
      violations.push(collisionViolation);
    }
    
    const speedViolation = this.checkSpeedLimit();
    if (speedViolation) {
      violations.push(speedViolation);
    }
    
    const turningViolation = this.checkTurningRadius();
    if (turningViolation) {
      violations.push(turningViolation);
    }
    
    const blindSpotViolation = this.checkBlindSpot();
    if (blindSpotViolation) {
      violations.push(blindSpotViolation);
    }
    
    return violations;
  }

  checkCollision() {
    if (!this.vehicle || !this.level) {
      return null;
    }

    const vehicleBox = this.vehicle.getBoundingBox();
    const vehiclePos = this.vehicle.position;
    
    const allObstacles = [
      ...(this.level.racks || []),
      ...(this.level.obstacles || []),
      ...(this.level.loadingDocks || [])
    ];

    for (const obstacle of allObstacles) {
      const obstaclePos = obstacle.position;
      const distance = Math.sqrt(
        Math.pow(vehiclePos.x - obstaclePos.x, 2) +
        Math.pow(vehiclePos.z - obstaclePos.z, 2)
      );
      
      const collisionThreshold = this.vehicle.getCollisionRadius();
      
      if (distance < collisionThreshold) {
        const obstacleType = this.getObstacleType(obstacle);
        return {
          type: 'collision',
          message: `与${obstacleType}发生碰撞风险！距离: ${distance.toFixed(2)}m`,
          severity: 'high',
          details: {
            obstacleId: obstacle.id,
            obstacleType: obstacleType,
            distance: distance,
            position: {
              vehicle: { x: vehiclePos.x, z: vehiclePos.z },
              obstacle: { x: obstaclePos.x, z: obstaclePos.z }
            }
          }
        };
      }
    }

    return null;
  }

  checkSpeedLimit() {
    if (!this.vehicle || !this.level) {
      return null;
    }

    const currentSpeed = this.vehicle.currentSpeed;
    const speedLimitZones = this.level.speedLimitZones || [];
    
    for (const zone of speedLimitZones) {
      if (this.isVehicleInZone(this.vehicle, zone)) {
        const maxSpeed = zone.maxSpeed || 2;
        if (currentSpeed > maxSpeed) {
          return {
            type: 'speeding',
            message: `超速！当前速度: ${currentSpeed.toFixed(1)} m/s, 限速: ${maxSpeed} m/s`,
            severity: 'medium',
            details: {
              zoneId: zone.id,
              currentSpeed: currentSpeed,
              maxSpeed: maxSpeed,
              overSpeed: currentSpeed - maxSpeed
            }
          };
        }
      }
    }

    return null;
  }

  checkTurningRadius() {
    if (!this.vehicle) {
      return null;
    }

    if (Math.abs(this.vehicle.angularVelocity) > 0) {
      const currentSpeed = this.vehicle.currentSpeed;
      const turningRadius = this.vehicle.turningRadius;
      
      const minTurningRadius = 2.5;
      const currentTurningRadius = currentSpeed / Math.abs(this.vehicle.angularVelocity);
      
      if (currentTurningRadius < minTurningRadius && currentSpeed > 1) {
        return {
          type: 'turningRadius',
          message: '转弯半径不足！请减速或增大转弯半径',
          severity: 'medium',
          details: {
            currentTurningRadius: currentTurningRadius,
            minRequired: minTurningRadius,
            speed: currentSpeed,
            angularVelocity: this.vehicle.angularVelocity
          }
        };
      }
    }

    return null;
  }

  checkBlindSpot() {
    if (!this.vehicle || !this.level) {
      return null;
    }

    const pedestrianZones = this.level.pedestrianZones || [];
    const vehiclePos = this.vehicle.position;
    const vehicleDirection = this.vehicle.getForwardDirection();

    for (const zone of pedestrianZones) {
      if (!zone.hasPedestrians) continue;
      
      const zonePos = zone.position;
      const distance = Math.sqrt(
        Math.pow(vehiclePos.x - zonePos.x, 2) +
        Math.pow(vehiclePos.z - zonePos.z, 2)
      );

      const toZone = new THREE.Vector3(
        zonePos.x - vehiclePos.x,
        0,
        zonePos.z - vehiclePos.z
      ).normalize();

      const dotProduct = vehicleDirection.dot(toZone);
      const isBehind = dotProduct < -0.3;
      
      const blindSpotDistance = 10;
      const sideBlindSpot = Math.abs(
        vehicleDirection.clone().cross(toZone).y
      ) > 0.7;

      if (distance < blindSpotDistance && (isBehind || sideBlindSpot)) {
        return {
          type: 'blindSpot',
          message: `盲区警告！行人区域距离: ${distance.toFixed(1)}m`,
          severity: 'high',
          details: {
            zoneId: zone.id,
            distance: distance,
            isBehind: isBehind,
            isSideBlindSpot: sideBlindSpot,
            pedestrianCount: zone.pedestrianCount
          }
        };
      }
    }

    return null;
  }

  checkTask(task, vehicle) {
    if (!task || !vehicle) {
      return { completed: false };
    }

    const vehiclePos = vehicle.position;

    switch (task.type) {
      case 'pickup':
        return this.checkPickupTask(task, vehiclePos);
      case 'delivery':
        return this.checkDeliveryTask(task, vehiclePos);
      case 'avoid':
        return this.checkAvoidTask(task, vehiclePos);
      default:
        return { completed: false };
    }
  }

  checkPickupTask(task, vehiclePos) {
    if (!this.level || !this.level.pallets) {
      return { completed: false };
    }

    const pallet = this.level.pallets.find(p => p.id === task.targetId);
    if (!pallet) {
      return { completed: false };
    }

    const distance = Math.sqrt(
      Math.pow(vehiclePos.x - pallet.position.x, 2) +
      Math.pow(vehiclePos.z - pallet.position.z, 2)
    );

    const pickupDistance = 3;
    
    if (distance < pickupDistance && this.vehicle.forkHeight > 0.5) {
      return {
        completed: true,
        message: '取货完成',
        details: { distance: distance }
      };
    }

    return {
      completed: false,
      message: distance < 5 ? '接近货物，请提升货叉' : `距离货物 ${distance.toFixed(1)}m`,
      details: { distance: distance }
    };
  }

  checkDeliveryTask(task, vehiclePos) {
    if (!this.level || !this.level.loadingDocks) {
      return { completed: false };
    }

    const dock = this.level.loadingDocks.find(d => d.id === task.targetId);
    if (!dock) {
      return { completed: false };
    }

    const distance = Math.sqrt(
      Math.pow(vehiclePos.x - dock.position.x, 2) +
      Math.pow(vehiclePos.z - dock.position.z, 2)
    );

    const deliveryDistance = 4;
    
    if (distance < deliveryDistance && this.vehicle.forkHeight < 0.3) {
      return {
        completed: true,
        message: '放货完成',
        details: { distance: distance }
      };
    }

    return {
      completed: false,
      message: distance < 6 ? '接近装卸月台，请降低货叉' : `距离月台 ${distance.toFixed(1)}m`,
      details: { distance: distance }
    };
  }

  checkAvoidTask(task, vehiclePos) {
    if (!this.level || !this.level.pedestrianZones) {
      return { completed: false };
    }

    const zone = this.level.pedestrianZones.find(z => z.id === task.targetId);
    if (!zone) {
      return { completed: false };
    }

    const distance = Math.sqrt(
      Math.pow(vehiclePos.x - zone.position.x, 2) +
      Math.pow(vehiclePos.z - zone.position.z, 2)
    );

    const safeDistance = 8;
    
    if (distance > safeDistance) {
      return {
        completed: true,
        message: '已安全避让行人区域',
        details: { distance: distance }
      };
    }

    return {
      completed: false,
      message: `请保持安全距离，当前距离: ${distance.toFixed(1)}m`,
      details: { distance: distance }
    };
  }

  checkPalletSequence(palletId) {
    if (!this.level || !this.level.pallets) {
      return { valid: true };
    }

    const pallet = this.level.pallets.find(p => p.id === palletId);
    if (!pallet) {
      return { valid: false, message: '无效的托盘 ID' };
    }

    const expectedSequence = pallet.sequence;
    const completedPallets = this.level.pallets.filter(p => p.delivered);
    
    const highestCompleted = completedPallets.reduce((max, p) => 
      Math.max(max, p.sequence), -1
    );

    if (expectedSequence > highestCompleted + 1) {
      return {
        valid: false,
        message: `托盘顺序错误！应先完成序号 ${highestCompleted + 1} 的托盘`,
        severity: 'high',
        details: {
          expected: highestCompleted + 1,
          actual: expectedSequence
        }
      };
    }

    return { valid: true };
  }

  isVehicleInZone(vehicle, zone) {
    const vehiclePos = vehicle.position;
    const zonePos = zone.position;
    
    const halfWidth = zone.width / 2;
    const halfDepth = zone.depth / 2;
    
    return (
      vehiclePos.x >= zonePos.x - halfWidth &&
      vehiclePos.x <= zonePos.x + halfWidth &&
      vehiclePos.z >= zonePos.z - halfDepth &&
      vehiclePos.z <= zonePos.z + halfDepth
    );
  }

  getObstacleType(obstacle) {
    if (obstacle.type === 'rack' || obstacle.width && obstacle.height && !obstacle.type) {
      return '货架';
    }
    if (obstacle.type === 'box' || obstacle.type === 'cylinder') {
      return '障碍物';
    }
    if (obstacle.width && obstacle.depth && !obstacle.type) {
      return '装卸月台';
    }
    return '物体';
  }
}

export default RulesEngine;

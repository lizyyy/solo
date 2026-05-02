import { Vector3, BoundingBox, CollisionResult, sceneManager } from '../models/SceneModel.js';

class CollisionDetector {
  constructor() {
    this.defaultClearance = 0.3;
    this.defaultHeightLimit = 10;
    this.lastResult = null;
  }

  detect(scene = null) {
    const targetScene = scene || sceneManager.currentScene;
    const result = new CollisionResult();

    this.checkDeviceCollisions(result, targetScene);
    this.checkObstacleCollisions(result, targetScene);
    this.checkClearance(result, targetScene);
    this.checkHeightLimit(result, targetScene);
    this.checkTrussOverlap(result, targetScene);

    this.lastResult = result;
    targetScene.collisionResult = result;

    return result;
  }

  checkDeviceCollisions(result, scene) {
    const devices = scene.devices;
    
    for (let i = 0; i < devices.length; i++) {
      for (let j = i + 1; j < devices.length; j++) {
        const device1 = devices[i];
        const device2 = devices[j];
        
        const box1 = this.getExpandedBox(device1.getBoundingBox(), 0.05);
        const box2 = this.getExpandedBox(device2.getBoundingBox(), 0.05);
        
        if (box1.intersectsBox(box2)) {
          const minDistance = this.getMinDistance(device1, device2);
          result.addCollision(
            device1.id,
            device2.id,
            `设备 "${device1.name}" 与设备 "${device2.name}" 发生碰撞，最小距离: ${minDistance.toFixed(3)}m`
          );
        }
      }
    }
  }

  checkObstacleCollisions(result, scene) {
    const obstacles = scene.obstacles;
    const devices = scene.devices;
    const trusses = scene.trusses;

    for (const obstacle of obstacles) {
      const obsBox = this.getExpandedBox(obstacle.getBoundingBox(), 0.1);
      
      for (const device of devices) {
        const deviceBox = this.getExpandedBox(device.getBoundingBox(), 0.05);
        
        if (obsBox.intersectsBox(deviceBox)) {
          const minDistance = this.getMinDistance(device, obstacle);
          result.addCollision(
            device.id,
            obstacle.id,
            `设备 "${device.name}" 与障碍物 "${obstacle.name}" 发生碰撞，最小距离: ${minDistance.toFixed(3)}m`
          );
        }
      }

      for (const truss of trusses) {
        const trussBox = this.getExpandedBox(truss.getBoundingBox(), 0.1);
        
        if (obsBox.intersectsBox(trussBox)) {
          const minDistance = this.getBoxDistance(truss.getBoundingBox(), obstacle.getBoundingBox());
          result.addCollision(
            truss.id,
            obstacle.id,
            `桁架 "${truss.name}" 与障碍物 "${obstacle.name}" 发生碰撞，最小距离: ${minDistance.toFixed(3)}m`
          );
        }
      }
    }
  }

  checkClearance(result, scene) {
    const obstacles = scene.obstacles;
    const devices = scene.devices;
    const trusses = scene.trusses;

    for (const obstacle of obstacles) {
      const clearance = obstacle.clearanceRequired || this.defaultClearance;
      const expandedBox = this.getExpandedBox(obstacle.getBoundingBox(), clearance);
      
      for (const device of devices) {
        const deviceBox = device.getBoundingBox();
        
        if (expandedBox.intersectsBox(deviceBox)) {
          const distance = this.getBoxDistance(deviceBox, obstacle.getBoundingBox());
          
          if (distance < clearance && distance > 0) {
            result.addClearanceWarning(
              device.id,
              obstacle.id,
              distance,
              `设备 "${device.name}" 与障碍物 "${obstacle.name}" 净空不足: ${distance.toFixed(3)}m (需要 ${clearance}m)`
            );
          }
        }
      }

      for (const truss of trusses) {
        const trussBox = truss.getBoundingBox();
        
        if (expandedBox.intersectsBox(trussBox)) {
          const distance = this.getBoxDistance(trussBox, obstacle.getBoundingBox());
          
          if (distance < clearance && distance > 0) {
            result.addClearanceWarning(
              truss.id,
              obstacle.id,
              distance,
              `桁架 "${truss.name}" 与障碍物 "${obstacle.name}" 净空不足: ${distance.toFixed(3)}m (需要 ${clearance}m)`
            );
          }
        }
      }
    }

    for (let i = 0; i < devices.length; i++) {
      for (let j = i + 1; j < devices.length; j++) {
        const device1 = devices[i];
        const device2 = devices[j];
        
        const clearance = 0.2;
        const expandedBox1 = this.getExpandedBox(device1.getBoundingBox(), clearance);
        const box2 = device2.getBoundingBox();
        
        if (expandedBox1.intersectsBox(box2)) {
          const distance = this.getBoxDistance(device1.getBoundingBox(), box2);
          
          if (distance < clearance && distance > 0) {
            result.addClearanceWarning(
              device1.id,
              device2.id,
              distance,
              `设备 "${device1.name}" 与设备 "${device2.name}" 间距过近: ${distance.toFixed(3)}m (建议至少 ${clearance}m)`
            );
          }
        }
      }
    }
  }

  checkHeightLimit(result, scene) {
    const stage = scene.stage;
    const heightLimit = this.defaultHeightLimit;
    
    const trusses = scene.trusses;
    const devices = scene.devices;
    const obstacles = scene.obstacles;

    for (const truss of trusses) {
      const trussTop = truss.position.y + truss.height / 2;
      if (trussTop > heightLimit) {
        result.addCollision(
          truss.id,
          'height_limit',
          `桁架 "${truss.name}" 顶部高度 ${trussTop.toFixed(2)}m 超过限高 ${heightLimit}m，超限 ${(trussTop - heightLimit).toFixed(2)}m`
        );
      }
    }

    for (const device of devices) {
      const deviceTop = device.position.y + device.dimensions.y / 2;
      if (deviceTop > heightLimit) {
        result.addCollision(
          device.id,
          'height_limit',
          `设备 "${device.name}" 顶部高度 ${deviceTop.toFixed(2)}m 超过限高 ${heightLimit}m，超限 ${(deviceTop - heightLimit).toFixed(2)}m`
        );
      }
    }
  }

  checkTrussOverlap(result, scene) {
    const trusses = scene.trusses;
    
    for (let i = 0; i < trusses.length; i++) {
      for (let j = i + 1; j < trusses.length; j++) {
        const truss1 = trusses[i];
        const truss2 = trusses[j];
        
        const box1 = truss1.getBoundingBox();
        const box2 = truss2.getBoundingBox();
        
        if (box1.intersectsBox(box2)) {
          const distance = this.getBoxDistance(box1, box2);
          result.addCollision(
            truss1.id,
            truss2.id,
            `桁架 "${truss1.name}" 与桁架 "${truss2.name}" 重叠，最小距离: ${distance.toFixed(3)}m`
          );
        }
      }
    }
  }

  getExpandedBox(box, amount) {
    return new BoundingBox(
      new Vector3(
        box.min.x - amount,
        box.min.y - amount,
        box.min.z - amount
      ),
      new Vector3(
        box.max.x + amount,
        box.max.y + amount,
        box.max.z + amount
      )
    );
  }

  getMinDistance(obj1, obj2) {
    const box1 = obj1.getBoundingBox();
    const box2 = obj2.getBoundingBox();
    return this.getBoxDistance(box1, box2);
  }

  getBoxDistance(box1, box2) {
    if (box1.intersectsBox(box2)) {
      return 0;
    }

    let dx = 0;
    let dy = 0;
    let dz = 0;

    if (box1.max.x < box2.min.x) {
      dx = box2.min.x - box1.max.x;
    } else if (box2.max.x < box1.min.x) {
      dx = box1.min.x - box2.max.x;
    }

    if (box1.max.y < box2.min.y) {
      dy = box2.min.y - box1.max.y;
    } else if (box2.max.y < box1.min.y) {
      dy = box1.min.y - box2.max.y;
    }

    if (box1.max.z < box2.min.z) {
      dz = box2.min.z - box1.max.z;
    } else if (box2.max.z < box1.min.z) {
      dz = box1.min.z - box2.max.z;
    }

    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }

  getCollisionSummary(scene = null) {
    const targetScene = scene || sceneManager.currentScene;
    const result = this.detect(targetScene);

    const summary = {
      hasCollisions: result.hasCollisions(),
      hasWarnings: result.hasWarnings(),
      totalCollisions: result.collisions.length,
      totalClearanceWarnings: result.clearanceWarnings.length,
      collisions: result.collisions.map(c => ({
        object1: this.getObjectNameById(targetScene, c.obj1Id),
        object2: this.getObjectNameById(targetScene, c.obj2Id),
        object1Id: c.obj1Id,
        object2Id: c.obj2Id,
        details: c.details,
        timestamp: c.timestamp
      })),
      clearanceWarnings: result.clearanceWarnings.map(w => ({
        object1: this.getObjectNameById(targetScene, w.obj1Id),
        object2: this.getObjectNameById(targetScene, w.obj2Id),
        object1Id: w.obj1Id,
        object2Id: w.obj2Id,
        distance: w.distance,
        details: w.details,
        timestamp: w.timestamp
      }))
    };

    return summary;
  }

  getObjectNameById(scene, id) {
    if (id === 'height_limit') {
      return '限高限制';
    }
    
    const device = scene.getDeviceById(id);
    if (device) return device.name;
    
    const truss = scene.getTrussById(id);
    if (truss) return truss.name;
    
    const obstacle = scene.getObstacleById(id);
    if (obstacle) return obstacle.name;
    
    const point = scene.getHangingPointById(id);
    if (point) return point.name;
    
    return '未知对象';
  }

  setHeightLimit(limit) {
    this.defaultHeightLimit = limit;
  }

  setDefaultClearance(clearance) {
    this.defaultClearance = clearance;
  }
}

const collisionDetector = new CollisionDetector();

export {
  CollisionDetector,
  collisionDetector
};

import * as THREE from 'three';

class CollisionDetector {
  constructor(stageSize) {
    this.stageSize = stageSize;
  }

  checkAllCollisions(elements) {
    const results = {
      collisions: [],
      boundaryViolations: [],
      distances: []
    };
    
    for (let i = 0; i < elements.length; i++) {
      const el1 = elements[i];
      for (let j = i + 1; j < elements.length; j++) {
        const el2 = elements[j];
        
        const distance = this.calculateDistance(el1, el2);
        results.distances.push({
          element1: el1.name,
          element2: el2.name,
          distance: distance
        });
        
        if (this.checkAABBCollision(el1, el2)) {
          results.collisions.push({
            element1: el1.name,
            element2: el2.name,
            type: 'collision',
            message: `${el1.name} 与 ${el2.name} 发生碰撞`
          });
        } else if (distance < 0.5) {
          results.collisions.push({
            element1: el1.name,
            element2: el2.name,
            type: 'warning',
            message: `${el1.name} 与 ${el2.name} 距离过近 (${distance.toFixed(2)}m)`
          });
        }
      }
      
      const boundaryResult = this.checkBoundary(el1);
      if (boundaryResult) {
        results.boundaryViolations.push({
          element: el1.name,
          ...boundaryResult
        });
      }
    }
    
    return results;
  }

  checkAABBCollision(el1, el2) {
    const box1 = this.getBoundingBox(el1);
    const box2 = this.getBoundingBox(el2);
    
    return (
      box1.min.x <= box2.max.x &&
      box1.max.x >= box2.min.x &&
      box1.min.y <= box2.max.y &&
      box1.max.y >= box2.min.y &&
      box1.min.z <= box2.max.z &&
      box1.max.z >= box2.min.z
    );
  }

  getBoundingBox(element) {
    const pos = element.mesh.position;
    const size = element.size;
    
    return {
      min: {
        x: pos.x - size.width / 2,
        y: pos.y - size.height / 2,
        z: pos.z - size.depth / 2
      },
      max: {
        x: pos.x + size.width / 2,
        y: pos.y + size.height / 2,
        z: pos.z + size.depth / 2
      }
    };
  }

  calculateDistance(el1, el2) {
    const pos1 = el1.mesh.position;
    const pos2 = el2.mesh.position;
    
    const dx = pos1.x - pos2.x;
    const dy = pos1.y - pos2.y;
    const dz = pos1.z - pos2.z;
    
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }

  checkBoundary(element) {
    const box = this.getBoundingBox(element);
    const { width, height, depth } = this.stageSize;
    
    const halfWidth = width / 2;
    const halfDepth = depth / 2;
    
    const violations = [];
    
    if (box.min.x < -halfWidth) {
      violations.push(`左侧边界超出 ${Math.abs(box.min.x + halfWidth).toFixed(2)}m`);
    }
    if (box.max.x > halfWidth) {
      violations.push(`右侧边界超出 ${(box.max.x - halfWidth).toFixed(2)}m`);
    }
    if (box.min.y < 0) {
      violations.push(`底部边界超出 ${Math.abs(box.min.y).toFixed(2)}m`);
    }
    if (box.max.y > height) {
      violations.push(`顶部边界超出 ${(box.max.y - height).toFixed(2)}m`);
    }
    if (box.min.z < -halfDepth) {
      violations.push(`前方边界超出 ${Math.abs(box.min.z + halfDepth).toFixed(2)}m`);
    }
    if (box.max.z > halfDepth) {
      violations.push(`后方边界超出 ${(box.max.z - halfDepth).toFixed(2)}m`);
    }
    
    if (violations.length > 0) {
      return {
        type: 'boundary',
        violations: violations,
        message: violations.join(', ')
      };
    }
    
    return null;
  }

  checkViewBlocking(camera, targetElement, allElements) {
    const cameraPos = camera.mesh.position.clone();
    const targetPos = targetElement.mesh.position.clone();
    
    const direction = targetPos.clone().sub(cameraPos);
    const totalDistance = direction.length();
    direction.normalize();
    
    for (const element of allElements) {
      if (element.id === camera.id || element.id === targetElement.id) continue;
      
      const box = this.getBoundingBox(element);
      
      if (this.intersectRayAABB(cameraPos, direction, box, totalDistance)) {
        return {
          blocker: element.name,
          message: `${camera.name} 的视角被 ${element.name} 遮挡`
        };
      }
    }
    
    return null;
  }

  intersectRayAABB(origin, direction, box, maxDistance) {
    let tMin = 0;
    let tMax = maxDistance;
    
    const dirX = direction.x;
    const dirY = direction.y;
    const dirZ = direction.z;
    
    if (Math.abs(dirX) < 0.0001) {
      if (origin.x < box.min.x || origin.x > box.max.x) {
        return false;
      }
    } else {
      let tx1 = (box.min.x - origin.x) / dirX;
      let tx2 = (box.max.x - origin.x) / dirX;
      
      if (tx1 > tx2) {
        const temp = tx1;
        tx1 = tx2;
        tx2 = temp;
      }
      
      tMin = Math.max(tMin, tx1);
      tMax = Math.min(tMax, tx2);
      
      if (tMin > tMax) return false;
    }
    
    if (Math.abs(dirY) < 0.0001) {
      if (origin.y < box.min.y || origin.y > box.max.y) {
        return false;
      }
    } else {
      let ty1 = (box.min.y - origin.y) / dirY;
      let ty2 = (box.max.y - origin.y) / dirY;
      
      if (ty1 > ty2) {
        const temp = ty1;
        ty1 = ty2;
        ty2 = temp;
      }
      
      tMin = Math.max(tMin, ty1);
      tMax = Math.min(tMax, ty2);
      
      if (tMin > tMax) return false;
    }
    
    if (Math.abs(dirZ) < 0.0001) {
      if (origin.z < box.min.z || origin.z > box.max.z) {
        return false;
      }
    } else {
      let tz1 = (box.min.z - origin.z) / dirZ;
      let tz2 = (box.max.z - origin.z) / dirZ;
      
      if (tz1 > tz2) {
        const temp = tz1;
        tz1 = tz2;
        tz2 = temp;
      }
      
      tMin = Math.max(tMin, tz1);
      tMax = Math.min(tMax, tz2);
      
      if (tMin > tMax) return false;
    }
    
    return tMin <= tMax && tMin < maxDistance && tMax > 0;
  }
}

export default CollisionDetector;

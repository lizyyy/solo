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
    const distance = direction.length();
    direction.normalize();
    
    for (const element of allElements) {
      if (element.id === camera.id || element.id === targetElement.id) continue;
      
      const box = this.getBoundingBox(element);
      
      const halfWidth = (box.max.x - box.min.x) / 2;
      const halfHeight = (box.max.y - box.min.y) / 2;
      const halfDepth = (box.max.z - box.min.z) / 2;
      
      const center = {
        x: (box.min.x + box.max.x) / 2,
        y: (box.min.y + box.max.y) / 2,
        z: (box.min.z + box.max.z) / 2
      };
      
      const toCenter = {
        x: center.x - cameraPos.x,
        y: center.y - cameraPos.y,
        z: center.z - cameraPos.z
      };
      
      const tMin = (toCenter.x - halfWidth) / direction.x;
      const tMax = (toCenter.x + halfWidth) / direction.x;
      
      const t1 = Math.min(tMin, tMax);
      const t2 = Math.max(tMin, tMax);
      
      if (t1 > 0 && t1 < distance && t2 > t1) {
        return {
          blocker: element.name,
          message: `${camera.name} 的视角被 ${element.name} 遮挡`
        };
      }
    }
    
    return null;
  }
}

export default CollisionDetector;

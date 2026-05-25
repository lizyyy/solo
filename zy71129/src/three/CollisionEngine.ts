
import * as THREE from 'three';
import { ModelElement, CollisionPoint, Point3D } from '../types/model';

export class CollisionEngine {
  private softThreshold: number = 0.1;

  setSoftThreshold(threshold: number) {
    this.softThreshold = threshold;
  }

  detectCollisions(elements: ModelElement[]): CollisionPoint[] {
    const collisions: CollisionPoint[] = [];
    
    for (let i = 0; i < elements.length; i++) {
      for (let j = i + 1; j < elements.length; j++) {
        const elA = elements[i];
        const elB = elements[j];
        
        if (elA.type === elB.type && elA.system === elB.system) continue;
        
        const collision = this.checkElementCollision(elA, elB);
        if (collision) {
          collisions.push(collision);
        }
      }
    }
    
    return collisions;
  }

  private checkElementCollision(elA: ModelElement, elB: ModelElement): CollisionPoint | null {
    for (let i = 0; i < elA.points.length - 1; i++) {
      for (let j = 0; j < elB.points.length - 1; j++) {
        const p1 = elA.points[i];
        const p2 = elA.points[i + 1];
        const p3 = elB.points[j];
        const p4 = elB.points[j + 1];
        
        const result = this.segmentSegmentCollision(
          p1, p2, elA.radius,
          p3, p4, elB.radius
        );
        
        if (result) {
          const isHard = result.distance <= 0;
          const penetrationDepth = Math.abs(result.distance);
          
          if (isHard || penetrationDepth <= this.softThreshold) {
            return {
              id: `col-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
              elementA: elA.id,
              elementB: elB.id,
              position: result.point,
              type: isHard ? 'hard' : 'soft',
              distance: penetrationDepth,
              severity: this.calculateSeverity(result.distance, isHard),
              resolved: false,
              timestamp: Date.now()
            };
          }
        }
      }
    }
    
    return null;
  }

  private segmentSegmentCollision(
    p1: Point3D, p2: Point3D, r1: number,
    p3: Point3D, p4: Point3D, r2: number
  ): { point: Point3D; distance: number } | null {
    const v1 = new THREE.Vector3(p2.x - p1.x, p2.y - p1.y, p2.z - p1.z);
    const v2 = new THREE.Vector3(p4.x - p3.x, p4.y - p3.y, p4.z - p3.z);
    const v = new THREE.Vector3(p3.x - p1.x, p3.y - p1.y, p3.z - p1.z);
    
    const v1v1 = v1.dot(v1);
    const v2v2 = v2.dot(v2);
    const v1v2 = v1.dot(v2);
    const v1v = v1.dot(v);
    const v2v = v2.dot(v);
    
    const denom = v1v1 * v2v2 - v1v2 * v1v2;
    
    if (Math.abs(denom) < 0.0001) return null;
    
    const s = (v1v2 * v2v - v2v2 * v1v) / denom;
    const t = (v1v1 * v2v - v1v2 * v1v) / denom;
    
    const sClamped = Math.max(0, Math.min(1, s));
    const tClamped = Math.max(0, Math.min(1, t));
    
    const pointA = new THREE.Vector3(
      p1.x + sClamped * v1.x,
      p1.y + sClamped * v1.y,
      p1.z + sClamped * v1.z
    );
    
    const pointB = new THREE.Vector3(
      p3.x + tClamped * v2.x,
      p3.y + tClamped * v2.y,
      p3.z + tClamped * v2.z
    );
    
    const distance = pointA.distanceTo(pointB) - r1 - r2;
    const midPoint = new THREE.Vector3().addVectors(pointA, pointB).multiplyScalar(0.5);
    
    return {
      point: { x: midPoint.x, y: midPoint.y, z: midPoint.z },
      distance
    };
  }

  private calculateSeverity(distance: number, isHard: boolean): 'critical' | 'major' | 'minor' {
    if (isHard) {
      if (distance < -0.1) return 'critical';
      return 'major';
    }
    if (distance < 0.05) return 'major';
    return 'minor';
  }

  getElementAABB(element: ModelElement): THREE.Box3 {
    const box = new THREE.Box3();
    
    element.points.forEach(p => {
      const point = new THREE.Vector3(p.x, p.y, p.z);
      box.expandByPoint(point);
    });
    
    box.expandByScalar(element.radius);
    return box;
  }
}

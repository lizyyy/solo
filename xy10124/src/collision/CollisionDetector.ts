import * as THREE from 'three';
import { Obstacle, Anomaly, AnomalyType, TrajectoryPoint, ProjectConfig } from '../types';

export interface CollisionResult {
  hasCollision: boolean;
  distance: number;
  nearestObstacleId?: string;
  anomalies: Anomaly[];
}

export class CollisionDetector {
  private obstacles: Map<string, THREE.Object3D> = new Map();
  private workspaceBounds: { min: THREE.Vector3; max: THREE.Vector3 };
  private safetyMargin: number;

  constructor(config: ProjectConfig) {
    this.workspaceBounds = {
      min: new THREE.Vector3(
        config.workspaceBounds.min.x,
        config.workspaceBounds.min.y,
        config.workspaceBounds.min.z
      ),
      max: new THREE.Vector3(
        config.workspaceBounds.max.x,
        config.workspaceBounds.max.y,
        config.workspaceBounds.max.z
      )
    };
    this.safetyMargin = config.safetyMargin;
    config.obstacles.forEach((obstacle) => this.addObstacle(obstacle));
  }

  addObstacle(obstacle: Obstacle): void {
    let geometry: THREE.BufferGeometry;
    const material = new THREE.MeshBasicMaterial({
      color: new THREE.Color(obstacle.color),
      transparent: true,
      opacity: obstacle.opacity,
      wireframe: true
    });

    switch (obstacle.geometry.type) {
      case 'box':
        geometry = new THREE.BoxGeometry(
          obstacle.geometry.size?.x || 1,
          obstacle.geometry.size?.y || 1,
          obstacle.geometry.size?.z || 1
        );
        break;
      case 'sphere':
        geometry = new THREE.SphereGeometry(obstacle.geometry.radius || 1, 16, 16);
        break;
      case 'cylinder':
        geometry = new THREE.CylinderGeometry(
          obstacle.geometry.radius || 1,
          obstacle.geometry.radius || 1,
          obstacle.geometry.height || 1,
          16
        );
        break;
      default:
        return;
    }

    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(
      obstacle.geometry.position.x,
      obstacle.geometry.position.y,
      obstacle.geometry.position.z
    );
    mesh.userData = { obstacleId: obstacle.id, type: obstacle.type };

    this.obstacles.set(obstacle.id, mesh);
  }

  removeObstacle(obstacleId: string): void {
    this.obstacles.delete(obstacleId);
  }

  updateObstacles(obstacles: Obstacle[]): void {
    this.obstacles.clear();
    obstacles.forEach((obstacle) => this.addObstacle(obstacle));
  }

  updateWorkspaceBounds(min: THREE.Vector3, max: THREE.Vector3): void {
    this.workspaceBounds = { min, max };
  }

  updateSafetyMargin(margin: number): void {
    this.safetyMargin = margin;
  }

  checkPoint(
    point: TrajectoryPoint,
    armBoxes: THREE.Box3[],
    endEffectorPos: THREE.Vector3,
    pointIndex: number
  ): CollisionResult {
    const anomalies: Anomaly[] = [];
    let minDistance = Infinity;
    let nearestObstacleId: string | undefined;
    let hasCollision = false;

    for (const [obstacleId, obstacleMesh] of this.obstacles) {
      const obstacleBox = new THREE.Box3().setFromObject(obstacleMesh);
      const obstacleCenter = new THREE.Vector3();
      obstacleBox.getCenter(obstacleCenter);

      for (const armBox of armBoxes) {
        const dist = this.computeDistance(armBox, obstacleBox);
        if (dist < minDistance) {
          minDistance = dist;
          nearestObstacleId = obstacleId;
        }

        const obstacleType = obstacleMesh.userData.type;
        const margin = obstacleType === 'forbidden' ? 0 : this.safetyMargin;

        if (dist <= 0) {
          hasCollision = true;
          anomalies.push({
            id: `anomaly_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            type: AnomalyType.COLLISION,
            timestamp: point.timestamp,
            pointIndex,
            description: `末端执行器与障碍物 ${obstacleMesh.userData.obstacleId} 发生碰撞`,
            distance: dist,
            obstacleId,
            jointStates: point.joints,
            endEffectorPos: {
              x: endEffectorPos.x,
              y: endEffectorPos.y,
              z: endEffectorPos.z
            }
          });
        } else if (dist <= margin + 0.1) {
          anomalies.push({
            id: `anomaly_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            type: AnomalyType.NEAR_MISS,
            timestamp: point.timestamp,
            pointIndex,
            description: `末端执行器接近障碍物 ${obstacleMesh.userData.obstacleId}，距离: ${dist.toFixed(4)}m`,
            distance: dist,
            obstacleId,
            jointStates: point.joints,
            endEffectorPos: {
              x: endEffectorPos.x,
              y: endEffectorPos.y,
              z: endEffectorPos.z
            }
          });
        }
      }
    }

    const boundaryViolation = this.checkBoundaryViolation(endEffectorPos);
    if (boundaryViolation) {
      hasCollision = true;
      anomalies.push({
        id: `anomaly_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        type: AnomalyType.BOUNDARY_VIOLATION,
        timestamp: point.timestamp,
        pointIndex,
        description: boundaryViolation,
        jointStates: point.joints,
        endEffectorPos: {
          x: endEffectorPos.x,
          y: endEffectorPos.y,
          z: endEffectorPos.z
        }
      });
    }

    return {
      hasCollision,
      distance: minDistance === Infinity ? -1 : minDistance,
      nearestObstacleId,
      anomalies
    };
  }

  private computeDistance(box1: THREE.Box3, box2: THREE.Box3): number {
    if (box1.intersectsBox(box2)) {
      return -this.calculateOverlap(box1, box2);
    }

    const closestPoint1 = new THREE.Vector3();
    const closestPoint2 = new THREE.Vector3();

    box1.clampPoint(box2.min, closestPoint1);
    box2.clampPoint(box1.min, closestPoint2);

    const dist = closestPoint1.distanceTo(closestPoint2);
    return dist;
  }

  private calculateOverlap(box1: THREE.Box3, box2: THREE.Box3): number {
    const overlapX = Math.min(box1.max.x, box2.max.x) - Math.max(box1.min.x, box2.min.x);
    const overlapY = Math.min(box1.max.y, box2.max.y) - Math.max(box1.min.y, box2.min.y);
    const overlapZ = Math.min(box1.max.z, box2.max.z) - Math.max(box1.min.z, box2.min.z);
    return Math.max(overlapX, overlapY, overlapZ);
  }

  private checkBoundaryViolation(pos: THREE.Vector3): string | null {
    const { min, max } = this.workspaceBounds;
    const violations: string[] = [];

    if (pos.x < min.x) violations.push(`X轴超出下界 ${min.x.toFixed(2)}`);
    if (pos.x > max.x) violations.push(`X轴超出上界 ${max.x.toFixed(2)}`);
    if (pos.y < min.y) violations.push(`Y轴超出下界 ${min.y.toFixed(2)}`);
    if (pos.y > max.y) violations.push(`Y轴超出上界 ${max.y.toFixed(2)}`);
    if (pos.z < min.z) violations.push(`Z轴超出下界 ${min.z.toFixed(2)}`);
    if (pos.z > max.z) violations.push(`Z轴超出上界 ${max.z.toFixed(2)}`);

    if (violations.length > 0) {
      return `工作空间边界违规: ${violations.join(', ')}`;
    }
    return null;
  }

  getObstacleMeshes(): THREE.Object3D[] {
    return Array.from(this.obstacles.values());
  }
}

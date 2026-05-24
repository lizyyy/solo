import { PathPoint, VehicleParams, SceneData, CollisionPoint, Vector3 } from '../types';
import { calculateVehicleCorners } from './pathCalculator';

function pointInAABB(point: Vector3, min: Vector3, max: Vector3): boolean {
  return (
    point.x >= min.x && point.x <= max.x &&
    point.z >= min.z && point.z <= max.z
  );
}

function aabbOverlap(
  aMin: Vector3, aMax: Vector3,
  bMin: Vector3, bMax: Vector3
): boolean {
  return (
    aMin.x <= bMax.x && aMax.x >= bMin.x &&
    aMin.z <= bMax.z && aMax.z >= bMin.z
  );
}

function getVehicleAABB(corners: Vector3[]): { min: Vector3; max: Vector3 } {
  const xs = corners.map(c => c.x);
  const zs = corners.map(c => c.z);
  return {
    min: { x: Math.min(...xs), y: 0, z: Math.min(...zs) },
    max: { x: Math.max(...xs), y: 0, z: Math.max(...zs) },
  };
}

function checkBoundaryCollision(
  corners: Vector3[],
  boundaries: SceneData['boundaries']
): boolean {
  const { minX, maxX, minZ, maxZ } = boundaries;
  return corners.some(corner => 
    corner.x < minX || corner.x > maxX ||
    corner.z < minZ || corner.z > maxZ
  );
}

function checkObstacleCollision(
  corners: Vector3[],
  obstacles: SceneData['obstacles']
): { collided: boolean; obstacleId?: string; obstacleType?: string } {
  const vehicleAABB = getVehicleAABB(corners);

  for (const obstacle of obstacles) {
    const obstacleMin = {
      x: obstacle.position.x - obstacle.size.x / 2,
      y: 0,
      z: obstacle.position.z - obstacle.size.z / 2,
    };
    const obstacleMax = {
      x: obstacle.position.x + obstacle.size.x / 2,
      y: obstacle.size.y,
      z: obstacle.position.z + obstacle.size.z / 2,
    };

    if (aabbOverlap(vehicleAABB.min, vehicleAABB.max, obstacleMin, obstacleMax)) {
      return { collided: true, obstacleId: obstacle.id, obstacleType: obstacle.type };
    }
  }

  return { collided: false };
}

function checkPlatformCollision(
  corners: Vector3[],
  platform: SceneData['platform']
): boolean {
  if (platform.width === 0 || platform.depth === 0) return false;

  const platformMin = {
    x: platform.position.x - platform.width / 2,
    y: 0,
    z: platform.position.z - platform.depth / 2,
  };
  const platformMax = {
    x: platform.position.x + platform.width / 2,
    y: platform.height,
    z: platform.position.z + platform.depth / 2,
  };

  const vehicleAABB = getVehicleAABB(corners);
  return aabbOverlap(vehicleAABB.min, vehicleAABB.max, platformMin, platformMax);
}

export function detectCollisions(
  path: PathPoint[],
  vehicle: VehicleParams,
  scene: SceneData
): CollisionPoint[] {
  const collisions: CollisionPoint[] = [];
  let collisionId = 0;

  for (let i = 0; i < path.length; i++) {
    const point = path[i];
    const corners = calculateVehicleCorners(point.position, point.rotation, vehicle);

    if (checkBoundaryCollision(corners, scene.boundaries)) {
      collisions.push({
        id: `collision-${collisionId++}`,
        position: { ...point.position },
        type: 'boundary',
        severity: 'critical',
        timestamp: point.timestamp,
        description: `车辆在 t=${point.timestamp.toFixed(2)} 时超出场地边界`,
      });
    }

    const obstacleResult = checkObstacleCollision(corners, scene.obstacles);
    if (obstacleResult.collided) {
      collisions.push({
        id: `collision-${collisionId++}`,
        position: { ...point.position },
        type: 'obstacle',
        severity: 'critical',
        timestamp: point.timestamp,
        description: `车辆在 t=${point.timestamp.toFixed(2)} 时与障碍物碰撞 (${obstacleResult.obstacleType})`,
      });
    }
  }

  return collisions;
}

export function getCollisionSeverity(count: number): 'safe' | 'warning' | 'danger' {
  if (count === 0) return 'safe';
  if (count <= 3) return 'warning';
  return 'danger';
}

export function getCollisionSummary(collisions: CollisionPoint[]): {
  boundaryCount: number;
  obstacleCount: number;
  platformCount: number;
  criticalCount: number;
  warningCount: number;
} {
  return {
    boundaryCount: collisions.filter(c => c.type === 'boundary').length,
    obstacleCount: collisions.filter(c => c.type === 'obstacle').length,
    platformCount: collisions.filter(c => c.type === 'platform').length,
    criticalCount: collisions.filter(c => c.severity === 'critical').length,
    warningCount: collisions.filter(c => c.severity === 'warning').length,
  };
}

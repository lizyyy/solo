import { EvacuationRoute, Point3D } from '../types';
import { generateRouteId } from '../utils/idGenerator';

export function createEvacuationRoute(params: {
  name: string;
  waypoints: Point3D[];
  obstructions: string[];
  width?: number;
  maxCapacity?: number;
  estimatedTime?: number;
}): EvacuationRoute {
  const now = Date.now();
  return {
    id: generateRouteId(),
    name: params.name,
    waypoints: params.waypoints,
    obstructions: params.obstructions,
    isActive: true,
    width: params.width ?? 1.5,
    maxCapacity: params.maxCapacity ?? 50,
    estimatedTime: params.estimatedTime ?? calculateEstimatedTime(params.waypoints)
  };
}

export function calculateEstimatedTime(waypoints: Point3D[], walkingSpeed = 1.2): number {
  if (waypoints.length < 2) return 0;

  let totalDistance = 0;
  for (let i = 1; i < waypoints.length; i++) {
    const dx = waypoints[i].x - waypoints[i - 1].x;
    const dy = waypoints[i].y - waypoints[i - 1].y;
    const dz = waypoints[i].z - waypoints[i - 1].z;
    totalDistance += Math.sqrt(dx * dx + dy * dy + dz * dz);
  }

  return Math.ceil(totalDistance / walkingSpeed);
}

export function addObstructionToRoute(
  route: EvacuationRoute,
  obstructionId: string
): EvacuationRoute {
  if (route.obstructions.includes(obstructionId)) {
    return route;
  }
  return {
    ...route,
    obstructions: [...route.obstructions, obstructionId]
  };
}

export function toggleRouteActive(route: EvacuationRoute): EvacuationRoute {
  return {
    ...route,
    isActive: !route.isActive
  };
}

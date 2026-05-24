import { Point3D, Building, NoFlyZone, Waypoint, unitConversion } from '@/types';

export interface CollisionResult {
  hasCollision: boolean;
  message: string;
  position?: Point3D;
  type: 'building' | 'no_fly_zone' | 'height_mismatch';
}

const toMeters = (point: Point3D): Point3D => ({
  x: point.x,
  y: unitConversion.toMeters(point.y, point.unit),
  z: point.z,
  unit: 'meter'
});

export const checkBuildingCollision = (
  point: Point3D,
  buildings: Building[],
  droneRadius: number = 5
): CollisionResult | null => {
  const pointM = toMeters(point);
  
  for (const building of buildings) {
    const bldMinX = building.position.x - building.width / 2 - droneRadius;
    const bldMaxX = building.position.x + building.width / 2 + droneRadius;
    const bldMinZ = building.position.z - building.depth / 2 - droneRadius;
    const bldMaxZ = building.position.z + building.depth / 2 + droneRadius;
    const bldMaxY = building.height;

    if (
      pointM.x >= bldMinX && pointM.x <= bldMaxX &&
      pointM.z >= bldMinZ && pointM.z <= bldMaxZ &&
      pointM.y <= bldMaxY
    ) {
      return {
        hasCollision: true,
        message: `航线与建筑物"${building.name}"发生碰撞`,
        position: point,
        type: 'building'
      };
    }
  }
  return null;
};

const pointInPolygon = (px: number, pz: number, polygon: Point3D[]): boolean => {
  let inside = false;
  const n = polygon.length;
  
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = polygon[i].x, zi = polygon[i].z;
    const xj = polygon[j].x, zj = polygon[j].z;

    if (((zi > pz) !== (zj > pz)) && (px < (xj - xi) * (pz - zi) / (zj - zi) + xi)) {
      inside = !inside;
    }
  }
  return inside;
};

const pointInCircle = (px: number, pz: number, cx: number, cz: number, radius: number): boolean => {
  const dx = px - cx;
  const dz = pz - cz;
  return Math.sqrt(dx * dx + dz * dz) <= radius;
};

export const checkNoFlyZoneViolation = (
  point: Point3D,
  noFlyZones: NoFlyZone[]
): CollisionResult | null => {
  const pointM = toMeters(point);
  
  for (const zone of noFlyZones) {
    const minHeight = zone.minHeight;
    const maxHeight = zone.maxHeight;

    if (pointM.y >= minHeight && pointM.y <= maxHeight) {
      let inZone = false;
      
      if (zone.type === 'polygon' && zone.coordinates.length >= 3) {
        inZone = pointInPolygon(pointM.x, pointM.z, zone.coordinates);
      } else if (zone.type === 'circle' && zone.radius && zone.coordinates[0]) {
        const center = zone.coordinates[0];
        inZone = pointInCircle(pointM.x, pointM.z, center.x, center.z, zone.radius);
      }

      if (inZone) {
        return {
          hasCollision: true,
          message: `航线穿越禁飞区"${zone.name}"`,
          position: point,
          type: 'no_fly_zone'
        };
      }
    }
  }
  return null;
};

export const checkHeightUnitMismatch = (
  waypoints: Waypoint[]
): CollisionResult[] => {
  const results: CollisionResult[] = [];
  const units = waypoints.map(wp => wp.position.unit);
  const hasMixedUnits = units.some(u => u === 'meter') && units.some(u => u === 'feet');
  
  if (hasMixedUnits) {
    results.push({
      hasCollision: true,
      message: '检测到高度单位混用，请确认所有航点单位一致',
      type: 'height_mismatch'
    });
  }
  
  return results;
};

export const checkLineSegmentCollision = (
  start: Point3D,
  end: Point3D,
  buildings: Building[],
  noFlyZones: NoFlyZone[],
  segments: number = 10
): CollisionResult[] => {
  const results: CollisionResult[] = [];
  
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const point: Point3D = {
      x: start.x + (end.x - start.x) * t,
      y: start.y + (end.y - start.y) * t,
      z: start.z + (end.z - start.z) * t,
      unit: start.unit
    };

    const buildingCollision = checkBuildingCollision(point, buildings);
    if (buildingCollision) {
      results.push(buildingCollision);
      break;
    }

    const noFlyViolation = checkNoFlyZoneViolation(point, noFlyZones);
    if (noFlyViolation) {
      results.push(noFlyViolation);
      break;
    }
  }
  
  return results;
};

export const checkFullFlightPath = (
  waypoints: Waypoint[],
  buildings: Building[],
  noFlyZones: NoFlyZone[]
): CollisionResult[] => {
  const results: CollisionResult[] = [];

  results.push(...checkHeightUnitMismatch(waypoints));

  for (let i = 0; i < waypoints.length - 1; i++) {
    const segmentResults = checkLineSegmentCollision(
      waypoints[i].position,
      waypoints[i + 1].position,
      buildings,
      noFlyZones,
      20
    );
    results.push(...segmentResults);
  }

  return results;
};

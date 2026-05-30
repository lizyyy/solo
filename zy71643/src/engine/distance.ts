import type { Point3D, PipelineSegment } from '../types';
import { lineLineDistance, distance, midpoint, lerp } from '../utils/geometry';

export interface DistanceResult {
  minDistance: number;
  closestPointA: Point3D;
  closestPointB: Point3D;
  midPoint: Point3D;
  isIntersecting: boolean;
}

export function segmentDistance(segA: PipelineSegment, segB: PipelineSegment): DistanceResult {
  const radiusA = segA.diameter / 2;
  const radiusB = segB.diameter / 2;

  const result = lineLineDistance(
    segA.startPoint,
    segA.endPoint,
    segB.startPoint,
    segB.endPoint
  );

  const surfaceDistance = result.distance - radiusA - radiusB;
  const midPoint = midpoint(result.closestPointA, result.closestPointB);

  return {
    minDistance: surfaceDistance,
    closestPointA: result.closestPointA,
    closestPointB: result.closestPointB,
    midPoint,
    isIntersecting: surfaceDistance <= 0,
  };
}

export function pointToSegmentDistance(point: Point3D, seg: PipelineSegment): {
  distance: number;
  closestPoint: Point3D;
  t: number;
} {
  const dx = seg.endPoint.x - seg.startPoint.x;
  const dy = seg.endPoint.y - seg.startPoint.y;
  const dz = seg.endPoint.z - seg.startPoint.z;

  const lengthSq = dx * dx + dy * dy + dz * dz;
  if (lengthSq === 0) {
    return {
      distance: distance(point, seg.startPoint),
      closestPoint: seg.startPoint,
      t: 0,
    };
  }

  let t =
    ((point.x - seg.startPoint.x) * dx +
      (point.y - seg.startPoint.y) * dy +
      (point.z - seg.startPoint.z) * dz) /
    lengthSq;

  t = Math.max(0, Math.min(1, t));

  const closestPoint = lerp(seg.startPoint, seg.endPoint, t);

  return {
    distance: distance(point, closestPoint),
    closestPoint,
    t,
  };
}

export function getRequiredDistance(
  typeA: string,
  typeB: string,
  config: {
    waterElectricMinDist: number;
    waterGasMinDist: number;
    electricGasMinDist: number;
    sameTypeMinDist: number;
  }
): number {
  if (typeA === typeB) {
    return config.sameTypeMinDist;
  }

  const types = [typeA, typeB].sort().join('-');

  switch (types) {
    case 'electric-water':
      return config.waterElectricMinDist;
    case 'gas-water':
      return config.waterGasMinDist;
    case 'electric-gas':
      return config.electricGasMinDist;
    default:
      return 0.5;
  }
}

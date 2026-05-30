import { GeoPoint, BearingData, Lighthouse, TriangleData, IntersectionPoint } from '../types';
import { calculateLineIntersection, calculateTriangleArea, calculateCentroid, calculateDistance } from './geoCalculations';
import { dmsToDecimal } from './bearingConversion';

export function getBearingDecimal(bearing: BearingData): number {
  if (bearing.unit === 'dms') {
    return dmsToDecimal({
      degrees: bearing.degrees,
      minutes: bearing.minutes,
      seconds: bearing.seconds
    });
  }
  return bearing.decimalDegrees;
}

export function calculateAllIntersections(
  lighthouses: Lighthouse[],
  bearings: Record<string, BearingData>
): IntersectionPoint[] {
  const intersections: IntersectionPoint[] = [];
  const validLighthouses = lighthouses.filter(lh => bearings[lh.id]);

  for (let i = 0; i < validLighthouses.length; i++) {
    for (let j = i + 1; j < validLighthouses.length; j++) {
      const lh1 = validLighthouses[i];
      const lh2 = validLighthouses[j];
      const bearing1 = getBearingDecimal(bearings[lh1.id]);
      const bearing2 = getBearingDecimal(bearings[lh2.id]);

      const intersection = calculateLineIntersection(
        lh1.position,
        bearing1,
        lh2.position,
        bearing2
      );

      if (intersection) {
        intersections.push({
          position: intersection,
          line1: lh1.id,
          line2: lh2.id
        });
      }
    }
  }

  return intersections;
}

export function calculateTriangleData(intersections: IntersectionPoint[]): TriangleData | null {
  if (intersections.length < 3) {
    return null;
  }

  const vertices = intersections.map(i => i.position);
  const area = calculateTriangleArea(vertices);
  const centroid = calculateCentroid(vertices);

  const maxDistance = Math.max(
    calculateDistance(vertices[0], vertices[1]),
    calculateDistance(vertices[1], vertices[2]),
    calculateDistance(vertices[2], vertices[0])
  );

  let errorLevel: TriangleData['errorLevel'] = 'poor';
  if (maxDistance < 500) {
    errorLevel = 'excellent';
  } else if (maxDistance < 1500) {
    errorLevel = 'good';
  } else if (maxDistance < 3000) {
    errorLevel = 'fair';
  }

  return {
    vertices,
    area,
    centroid,
    errorLevel
  };
}

export function estimatePosition(
  lighthouses: Lighthouse[],
  bearings: Record<string, BearingData>
): {
  position: GeoPoint | null;
  triangle: TriangleData | null;
  intersections: IntersectionPoint[];
} {
  const intersections = calculateAllIntersections(lighthouses, bearings);
  const triangle = calculateTriangleData(intersections);

  if (triangle) {
    return {
      position: triangle.centroid,
      triangle,
      intersections
    };
  }

  if (intersections.length > 0) {
    const avgPosition = calculateCentroid(intersections.map(i => i.position));
    return {
      position: avgPosition,
      triangle: null,
      intersections
    };
  }

  return {
    position: null,
    triangle: null,
    intersections
  };
}

export function calculatePositionError(
  estimatedPosition: GeoPoint,
  truePosition: GeoPoint
): number {
  return calculateDistance(estimatedPosition, truePosition);
}

export function getErrorLevelDescription(level: TriangleData['errorLevel']): string {
  const descriptions = {
    excellent: '定位精度优秀，误差小于500米',
    good: '定位精度良好，误差500-1500米',
    fair: '定位精度一般，误差1500-3000米',
    poor: '定位精度较差，误差大于3000米'
  };
  return descriptions[level];
}

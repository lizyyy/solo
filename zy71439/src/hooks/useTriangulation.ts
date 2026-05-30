import { useMemo } from 'react';
import { Lighthouse, BearingData, GeoPoint, TriangleData, IntersectionPoint } from '../types';
import { estimatePosition, calculatePositionError } from '../utils/triangulation';

export function useTriangulation(
  lighthouses: Lighthouse[],
  bearings: Record<string, BearingData>,
  truePosition?: GeoPoint
) {
  const result = useMemo(() => {
    return estimatePosition(lighthouses, bearings);
  }, [lighthouses, bearings]);

  const positionError = useMemo(() => {
    if (!result.position || !truePosition) return null;
    return calculatePositionError(result.position, truePosition);
  }, [result.position, truePosition]);

  const completedBearings = useMemo(() => {
    return lighthouses.filter(lh => bearings[lh.id]).length;
  }, [lighthouses, bearings]);

  const canEstimate = completedBearings >= 2;
  const hasFullData = completedBearings >= 3;

  return {
    estimatedPosition: result.position,
    triangle: result.triangle,
    intersections: result.intersections,
    positionError,
    completedBearings,
    canEstimate,
    hasFullData
  };
}

export type TriangulationResult = {
  estimatedPosition: GeoPoint | null;
  triangle: TriangleData | null;
  intersections: IntersectionPoint[];
  positionError: number | null;
  completedBearings: number;
  canEstimate: boolean;
  hasFullData: boolean;
};

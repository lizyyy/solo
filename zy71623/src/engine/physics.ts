import {
  Point,
  PlacedPolygon,
  PolygonBlock,
  BridgePier,
  Truck,
  SimulationResult,
  ReplayFrame,
  PolygonStateData,
  PolygonState
} from '../types';
import { distance, getCentroid, getPolygonBoundingBox } from './geometry';

export interface SupportPoint {
  position: Point;
  type: 'pier' | 'polygon';
  id?: string;
}

export const calculateStress = (
  polygon: PlacedPolygon,
  block: PolygonBlock,
  loadPosition: Point,
  loadWeight: number,
  supports: SupportPoint[]
): number => {
  const centroid = getCentroid(polygon.vertices);
  let totalSupportDistance = 0;
  let loadDistance = distance(centroid, loadPosition);
  for (const support of supports) {
    totalSupportDistance += distance(centroid, support.position);
  }
  const avgSupportDistance = supports.length > 0 ? totalSupportDistance / supports.length : 100;
  const leverFactor = Math.max(0.5, Math.min(3, loadDistance / Math.max(avgSupportDistance, 1)));
  const baseStress = (loadWeight * leverFactor) / Math.max(block.strength, 1);
  const supportFactor = Math.max(0.3, 1 - supports.length * 0.15);
  return baseStress * supportFactor;
};

export const findSupportPoints = (
  polygon: PlacedPolygon,
  piers: BridgePier[],
  placedPolygons: PlacedPolygon[],
  threshold: number = 15
): SupportPoint[] => {
  const supports: SupportPoint[] = [];
  const polyVertices = polygon.vertices;
  for (const pier of piers) {
    const pierTop = {
      x: pier.position.x,
      y: pier.position.y - pier.height / 2
    };
    for (const v of polyVertices) {
      if (distance(v, pierTop) <= threshold) {
        supports.push({
          position: pierTop,
          type: 'pier',
          id: pier.id
        });
        break;
      }
    }
  }
  for (const otherPoly of placedPolygons) {
    if (otherPoly.instanceId === polygon.instanceId) continue;
    for (const v of polyVertices) {
      for (const otherV of otherPoly.vertices) {
        if (distance(v, otherV) <= threshold) {
          supports.push({
            position: otherV,
            type: 'polygon',
            id: otherPoly.instanceId
          });
          break;
        }
      }
    }
  }
  return supports;
};

export const getPolygonState = (stress: number, strength: number): PolygonState => {
  const ratio = stress / strength;
  if (ratio >= 1.0) return 'broken';
  if (ratio >= 0.7) return 'stressed';
  return 'normal';
};

export const simulateBridge = (
  placedPolygons: PlacedPolygon[],
  polygonBlocks: PolygonBlock[],
  piers: BridgePier[],
  truck: Truck,
  startPoint: Point,
  endPoint: Point
): SimulationResult => {
  const replayData: ReplayFrame[] = [];
  const stressMap: Record<string, number> = {};
  let maxStress = 0;
  let failurePoint: Point | undefined;
  let failureReason: string | undefined;
  let failureTime: number | undefined;
  let success = true;

  const totalDistance = distance(startPoint, endPoint);
  const direction = {
    x: (endPoint.x - startPoint.x) / totalDistance,
    y: (endPoint.y - startPoint.y) / totalDistance
  };

  const steps = 120;
  const stepDistance = totalDistance / steps;

  for (let step = 0; step <= steps; step++) {
    const currentDistance = step * stepDistance;
    const truckPosition = {
      x: startPoint.x + direction.x * currentDistance,
      y: startPoint.y + direction.y * currentDistance
    };

    const polygonStates: PolygonStateData[] = [];
    let stepMaxStress = 0;

    for (const placed of placedPolygons) {
      const block = polygonBlocks.find(b => b.id === placed.blockId);
      if (!block) continue;

      const supports = findSupportPoints(placed, piers, placedPolygons, 20);
      const stress = calculateStress(placed, block, truckPosition, truck.weight, supports);
      
      stressMap[placed.instanceId] = Math.max(stressMap[placed.instanceId] || 0, stress);
      stepMaxStress = Math.max(stepMaxStress, stress);
      maxStress = Math.max(maxStress, stress);

      const state = getPolygonState(stress, block.strength);
      polygonStates.push({
        instanceId: placed.instanceId,
        state,
        stress
      });

      if (state === 'broken' && success) {
        success = false;
        failurePoint = truckPosition;
        failureReason = `多边形「${block.name}」应力过载 (${(stress / block.strength * 100).toFixed(1)}%)，桥梁结构断裂`;
        failureTime = step / steps * 100;
      }
    }

    let isSupported = false;
    for (const placed of placedPolygons) {
      const bbox = getPolygonBoundingBox(placed.vertices);
      if (truckPosition.x >= bbox.minX - 20 && truckPosition.x <= bbox.maxX + 20 &&
          truckPosition.y >= bbox.minY - 30 && truckPosition.y <= bbox.maxY + 30) {
        isSupported = true;
        break;
      }
    }

    if (!isSupported && success && step > 0) {
      success = false;
      failurePoint = truckPosition;
      failureReason = '载重车在位置 ' + Math.round(currentDistance) + 'px 处失去桥面支撑，桥梁存在缺口';
      failureTime = step / steps * 100;
    }

    replayData.push({
      time: step / steps * 100,
      truckPosition,
      polygonStates
    });

    if (!success) break;
  }

  return {
    success,
    maxLoad: success ? truck.weight : Math.floor(truck.weight * (failureTime || 0) / 100),
    maxStress,
    failurePoint,
    failureReason,
    failureTime,
    stressMap,
    replayData,
    totalDistance
  };
};

export const calculateEfficiency = (
  usedArea: number,
  areaBudget: number,
  maxStress: number,
  success: boolean
): number => {
  if (!success) return 0;
  const areaEfficiency = 1 - (usedArea / areaBudget);
  const stressEfficiency = 1 - maxStress;
  return Math.max(0, Math.min(100, (areaEfficiency * 0.6 + stressEfficiency * 0.4) * 100));
};

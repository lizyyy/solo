import { GeoPoint, RouteOption } from '../types';
import { calculateDistance, calculateBearing } from './geoCalculations';

function createIntermediatePoint(
  start: GeoPoint,
  end: GeoPoint,
  fraction: number,
  offset: number = 0
): GeoPoint {
  return {
    lat: start.lat + (end.lat - start.lat) * fraction + offset * 0.01,
    lng: start.lng + (end.lng - start.lng) * fraction - offset * 0.005
  };
}

export function generateRoutes(
  rescueStation: GeoPoint,
  targetPosition: GeoPoint,
  obstacles: { position: GeoPoint; radius: number }[] = []
): RouteOption[] {
  const directDistance = calculateDistance(rescueStation, targetPosition);
  const shipSpeedKnots = 15;
  const metersPerSecond = (shipSpeedKnots * 1852) / 3600;

  const midPoint = {
    lat: (rescueStation.lat + targetPosition.lat) / 2,
    lng: (rescueStation.lng + targetPosition.lng) / 2
  };

  const safeWaypoint1 = createIntermediatePoint(rescueStation, targetPosition, 0.3, -0.05);
  const safeWaypoint2 = createIntermediatePoint(rescueStation, targetPosition, 0.7, 0.03);
  const fastWaypoint1 = createIntermediatePoint(rescueStation, targetPosition, 0.4, 0.04);
  const fastWaypoint2 = createIntermediatePoint(rescueStation, targetPosition, 0.6, 0.02);

  const safeDistance =
    calculateDistance(rescueStation, safeWaypoint1) +
    calculateDistance(safeWaypoint1, safeWaypoint2) +
    calculateDistance(safeWaypoint2, targetPosition);

  const fastDistance =
    calculateDistance(rescueStation, fastWaypoint1) +
    calculateDistance(fastWaypoint1, fastWaypoint2) +
    calculateDistance(fastWaypoint2, targetPosition);

  const routes: RouteOption[] = [
    {
      id: 'direct',
      name: '直达航线',
      start: rescueStation,
      end: targetPosition,
      waypoints: [],
      distance: directDistance,
      estimatedTime: Math.round(directDistance / metersPerSecond / 60),
      riskLevel: 'medium',
      riskDescription: '距离最短但需穿越渔船密集区，需保持瞭望，注意避让作业渔船。'
    },
    {
      id: 'safe',
      name: '安全航线',
      start: rescueStation,
      end: targetPosition,
      waypoints: [safeWaypoint1, safeWaypoint2],
      distance: safeDistance,
      estimatedTime: Math.round(safeDistance / metersPerSecond / 60),
      riskLevel: 'low',
      riskDescription: '绕行避开主要航道和渔船密集区，虽然增加距离但安全性最高，适合能见度不佳时选择。'
    },
    {
      id: 'fast',
      name: '快速航线',
      start: rescueStation,
      end: targetPosition,
      waypoints: [fastWaypoint1, fastWaypoint2],
      distance: fastDistance,
      estimatedTime: Math.round(fastDistance / metersPerSecond / 60 * 0.85),
      riskLevel: 'high',
      riskDescription: '抄近道穿越浅滩区域，需确认水深足够，且航行时间可缩短约15%，但存在触礁风险。'
    }
  ];

  return routes;
}

export function getRouteById(routes: RouteOption[], id: string): RouteOption | undefined {
  return routes.find(r => r.id === id);
}

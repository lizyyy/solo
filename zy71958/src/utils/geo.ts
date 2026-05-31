import { Coordinate, NoFlyZone } from '../types';

export function haversineDistance(coord1: Coordinate, coord2: Coordinate): number {
  const R = 6371000;
  const dLat = toRad(coord2.lat - coord1.lat);
  const dLng = toRad(coord2.lng - coord1.lng);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(coord1.lat)) * Math.cos(toRad(coord2.lat)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function toRad(deg: number): number {
  return deg * (Math.PI / 180);
}

export function coordToVector3(coord: Coordinate, center: Coordinate, scale: number = 1000): [number, number, number] {
  const dx = haversineDistance(
    { lat: center.lat, lng: coord.lng, alt: 0 },
    { lat: center.lat, lng: center.lng, alt: 0 }
  ) * (coord.lng > center.lng ? 1 : -1);

  const dz = haversineDistance(
    { lat: coord.lat, lng: center.lng, alt: 0 },
    { lat: center.lat, lng: center.lng, alt: 0 }
  ) * (coord.lat > center.lat ? 1 : -1);

  return [dx / scale, coord.alt / 10, dz / scale];
}

export function checkNoFlyZoneIntersection(
  route: Coordinate[],
  noFlyZone: NoFlyZone,
  threshold: number = 0
): { intersects: boolean; closestPoint: Coordinate | null; distance: number } {
  let minDistance = Infinity;
  let closestPoint: Coordinate | null = null;

  for (const point of route) {
    const distance = haversineDistance(point, noFlyZone.center);
    const horizontalClearance = distance - noFlyZone.radius;
    const verticalClearance = Math.min(
      Math.abs(point.alt - noFlyZone.minAlt),
      Math.abs(point.alt - noFlyZone.maxAlt)
    );

    const effectiveDistance = Math.max(horizontalClearance, verticalClearance);

    if (effectiveDistance < minDistance) {
      minDistance = effectiveDistance;
      closestPoint = point;
    }

    if (
      distance <= noFlyZone.radius + threshold &&
      point.alt >= noFlyZone.minAlt - threshold &&
      point.alt <= noFlyZone.maxAlt + threshold
    ) {
      return { intersects: true, closestPoint: point, distance: effectiveDistance };
    }
  }

  return {
    intersects: false,
    closestPoint,
    distance: minDistance,
  };
}

export function checkAllNoFlyZones(
  route: Coordinate[],
  noFlyZones: NoFlyZone[],
  threshold: number = 50
): Array<{ zone: NoFlyZone; closestPoint: Coordinate; distance: number; isNear: boolean }> {
  const results: Array<{
    zone: NoFlyZone;
    closestPoint: Coordinate;
    distance: number;
    isNear: boolean;
  }> = [];

  for (const zone of noFlyZones) {
    const check = checkNoFlyZoneIntersection(route, zone, 0);
    if (check.closestPoint) {
      results.push({
        zone,
        closestPoint: check.closestPoint,
        distance: check.distance,
        isNear: check.distance <= threshold,
      });
    }
  }

  return results.sort((a, b) => a.distance - b.distance);
}

export function getCenterCoordinate(coordinates: Coordinate[]): Coordinate {
  if (coordinates.length === 0) {
    return { lat: 0, lng: 0, alt: 0 };
  }

  const sum = coordinates.reduce(
    (acc, coord) => ({
      lat: acc.lat + coord.lat,
      lng: acc.lng + coord.lng,
      alt: acc.alt + coord.alt,
    }),
    { lat: 0, lng: 0, alt: 0 }
  );

  return {
    lat: sum.lat / coordinates.length,
    lng: sum.lng / coordinates.length,
    alt: sum.alt / coordinates.length,
  };
}

export function calculateRouteLength(coordinates: Coordinate[]): number {
  if (coordinates.length < 2) return 0;

  let total = 0;
  for (let i = 0; i < coordinates.length - 1; i++) {
    total += haversineDistance(coordinates[i], coordinates[i + 1]);
  }
  return total;
}

export function formatDistance(meters: number): string {
  if (meters >= 1000) {
    return `${(meters / 1000).toFixed(2)} km`;
  }
  return `${meters.toFixed(0)} m`;
}

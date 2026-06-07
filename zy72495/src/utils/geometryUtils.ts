const BOUNDARY_THRESHOLD_METERS = 5;

function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

export function calculateDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371000;
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function isPointInPolygon(
  lng: number,
  lat: number,
  polygon: [number, number][]
): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i][0];
    const yi = polygon[i][1];
    const xj = polygon[j][0];
    const yj = polygon[j][1];

    const intersect =
      yi > lat !== yj > lat &&
      lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

function distanceToLineSegment(
  px: number,
  py: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number
): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;

  if (lenSq === 0) {
    return calculateDistance(py, px, y1, x1);
  }

  let t = ((px - x1) * dx + (py - y1) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));

  const projX = x1 + t * dx;
  const projY = y1 + t * dy;

  return calculateDistance(py, px, projY, projX);
}

export function isPointNearBoundary(
  lng: number,
  lat: number,
  polygon: [number, number][]
): boolean {
  for (let i = 0; i < polygon.length; i++) {
    const j = (i + 1) % polygon.length;
    const dist = distanceToLineSegment(
      lng,
      lat,
      polygon[i][0],
      polygon[i][1],
      polygon[j][0],
      polygon[j][1]
    );
    if (dist < BOUNDARY_THRESHOLD_METERS) {
      return true;
    }
  }
  return false;
}

export function getPointStreetIds(
  lng: number,
  lat: number,
  streets: { id: string; boundary: [number, number][] }[]
): string[] {
  const streetIds: string[] = [];
  for (const street of streets) {
    if (isPointInPolygon(lng, lat, street.boundary)) {
      streetIds.push(street.id);
    }
  }
  if (streetIds.length === 0) {
    for (const street of streets) {
      if (isPointNearBoundary(lng, lat, street.boundary)) {
        streetIds.push(street.id);
      }
    }
  }
  return streetIds;
}

export function isBoundaryPoint(
  lng: number,
  lat: number,
  streets: { id: string; boundary: [number, number][] }[]
): { isBoundary: boolean; streetIds: string[] } {
  const streetIds = getPointStreetIds(lng, lat, streets);
  const isBoundary = streetIds.length >= 2;
  return { isBoundary, streetIds };
}

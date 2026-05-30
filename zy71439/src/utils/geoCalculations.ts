import { GeoPoint } from '../types';

const EARTH_RADIUS = 6371000;

export function toRadians(degrees: number): number {
  return degrees * Math.PI / 180;
}

export function toDegrees(radians: number): number {
  return radians * 180 / Math.PI;
}

export function calculateDistance(point1: GeoPoint, point2: GeoPoint): number {
  const dLat = toRadians(point2.lat - point1.lat);
  const dLng = toRadians(point2.lng - point1.lng);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(point1.lat)) * Math.cos(toRadians(point2.lat)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS * c;
}

export function calculateBearing(from: GeoPoint, to: GeoPoint): number {
  const dLng = toRadians(to.lng - from.lng);
  const lat1 = toRadians(from.lat);
  const lat2 = toRadians(to.lat);
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  let bearing = toDegrees(Math.atan2(y, x));
  bearing = (bearing + 360) % 360;
  return bearing;
}

export function pointAlongBearing(
  start: GeoPoint,
  bearing: number,
  distance: number
): GeoPoint {
  const angularDistance = distance / EARTH_RADIUS;
  const lat1 = toRadians(start.lat);
  const lng1 = toRadians(start.lng);
  const bearingRad = toRadians(bearing);

  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(angularDistance) +
    Math.cos(lat1) * Math.sin(angularDistance) * Math.cos(bearingRad)
  );
  const lng2 = lng1 + Math.atan2(
    Math.sin(bearingRad) * Math.sin(angularDistance) * Math.cos(lat1),
    Math.cos(angularDistance) - Math.sin(lat1) * Math.sin(lat2)
  );

  return {
    lat: toDegrees(lat2),
    lng: toDegrees(lng2)
  };
}

export function calculateLineIntersection(
  line1Start: GeoPoint,
  line1Bearing: number,
  line2Start: GeoPoint,
  line2Bearing: number
): GeoPoint | null {
  const lat1 = toRadians(line1Start.lat);
  const lng1 = toRadians(line1Start.lng);
  const lat2 = toRadians(line2Start.lat);
  const lng2 = toRadians(line2Start.lng);
  const brng13 = toRadians(line1Bearing);
  const brng23 = toRadians(line2Bearing);

  const dLat = lat2 - lat1;
  const dLng = lng2 - lng1;

  const dist12 = 2 * Math.asin(Math.sqrt(
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2)
  ));

  if (dist12 === 0) return line1Start;

  const brngA = Math.acos((
    Math.sin(lat2) - Math.sin(lat1) * Math.cos(dist12)
  ) / (Math.sin(dist12) * Math.cos(lat1)));

  const brngB = Math.acos((
    Math.sin(lat1) - Math.sin(lat2) * Math.cos(dist12)
  ) / (Math.sin(dist12) * Math.cos(lat2)));

  let brng12: number;
  let brng21: number;

  if (Math.sin(dLng) > 0) {
    brng12 = brngA;
    brng21 = 2 * Math.PI - brngB;
  } else {
    brng12 = 2 * Math.PI - brngA;
    brng21 = brngB;
  }

  const alpha1 = (brng13 - brng12 + Math.PI) % (2 * Math.PI) - Math.PI;
  const alpha2 = (brng21 - brng23 + Math.PI) % (2 * Math.PI) - Math.PI;

  if (Math.sin(alpha1) === 0 && Math.sin(alpha2) === 0) {
    return null;
  }
  if (Math.sin(alpha1) * Math.sin(alpha2) < 0) {
    return null;
  }

  const alpha3 = Math.acos(-Math.cos(alpha1) * Math.cos(alpha2) +
    Math.sin(alpha1) * Math.sin(alpha2) * Math.cos(dist12));

  const dist13 = Math.atan2(
    Math.sin(dist12) * Math.sin(alpha1) * Math.sin(alpha2),
    Math.cos(alpha2) + Math.cos(alpha1) * Math.cos(alpha3)
  );

  const lat3 = Math.asin(
    Math.sin(lat1) * Math.cos(dist13) +
    Math.cos(lat1) * Math.sin(dist13) * Math.cos(brng13)
  );

  const dLng13 = Math.atan2(
    Math.sin(brng13) * Math.sin(dist13) * Math.cos(lat1),
    Math.cos(dist13) - Math.sin(lat1) * Math.sin(lat3)
  );

  const lng3 = lng1 + dLng13;

  return {
    lat: toDegrees(lat3),
    lng: toDegrees(lng3)
  };
}

export function calculateTriangleArea(vertices: GeoPoint[]): number {
  if (vertices.length !== 3) return 0;

  const area = Math.abs(
    (vertices[0].lng * (vertices[1].lat - vertices[2].lat) +
     vertices[1].lng * (vertices[2].lat - vertices[0].lat) +
     vertices[2].lng * (vertices[0].lat - vertices[1].lat)) / 2
  );

  return area;
}

export function calculateCentroid(vertices: GeoPoint[]): GeoPoint {
  if (vertices.length === 0) return { lat: 0, lng: 0 };

  const sum = vertices.reduce(
    (acc, v) => ({
      lat: acc.lat + v.lat,
      lng: acc.lng + v.lng
    }),
    { lat: 0, lng: 0 }
  );

  return {
    lat: sum.lat / vertices.length,
    lng: sum.lng / vertices.length
  };
}

export function formatLatLng(point: GeoPoint): string {
  const latDir = point.lat >= 0 ? 'N' : 'S';
  const lngDir = point.lng >= 0 ? 'E' : 'W';
  return `${Math.abs(point.lat).toFixed(4)}°${latDir}, ${Math.abs(point.lng).toFixed(4)}°${lngDir}`;
}

export function formatDistance(meters: number): string {
  if (meters >= 1000) {
    return `${(meters / 1000).toFixed(2)} km`;
  }
  return `${meters.toFixed(0)} m`;
}

export function calculateFinalError(truePosition: GeoPoint, estimatedPosition: GeoPoint): number {
  return calculateDistance(truePosition, estimatedPosition);
}

import type { BuoyLog, AffectedArea } from '../types';
import { mockBuoys } from '../data/mockBuoys';
import { calculateAnomalyLevel, getThreshold } from './anomalyDetector';

export function getBuoyById(buoyId: string) {
  return mockBuoys.find((b) => b.id === buoyId);
}

export function calculateAnomalyLevelFromLog(log: BuoyLog): number {
  const paramKeys = Object.keys(log.parameters) as (keyof typeof log.parameters)[];
  let maxLevel = 0;

  for (const param of paramKeys) {
    const value = log.parameters[param];
    const threshold = getThreshold(param);
    if (value > threshold) {
      const level = ['low', 'medium', 'high', 'critical'].indexOf(
        calculateAnomalyLevel(value, threshold)
      );
      maxLevel = Math.max(maxLevel, level);
    }
  }

  return maxLevel;
}

export function calculateAffectedArea(log: BuoyLog): AffectedArea {
  const buoy = getBuoyById(log.buoyId);
  if (!buoy) {
    return {
      latRange: [0, 0],
      lngRange: [0, 0],
      radius: 0,
    };
  }

  const anomalyLevel = calculateAnomalyLevelFromLog(log);
  const radius = 0.5 + anomalyLevel * 0.3;

  const latDelta = radius / 111;
  const lngDelta = radius / (111 * Math.cos((buoy.lat * Math.PI) / 180));

  return {
    latRange: [buoy.lat - latDelta, buoy.lat + latDelta],
    lngRange: [buoy.lng - lngDelta, buoy.lng + lngDelta],
    radius,
  };
}

export function formatLatitude(lat: number): string {
  const direction = lat >= 0 ? 'N' : 'S';
  const absLat = Math.abs(lat);
  const degrees = Math.floor(absLat);
  const minutes = ((absLat - degrees) * 60).toFixed(4);
  return `${degrees}°${minutes}'${direction}`;
}

export function formatLongitude(lng: number): string {
  const direction = lng >= 0 ? 'E' : 'W';
  const absLng = Math.abs(lng);
  const degrees = Math.floor(absLng);
  const minutes = ((absLng - degrees) * 60).toFixed(4);
  return `${degrees}°${minutes}'${direction}`;
}

export function formatCoordinates(lat: number, lng: number): string {
  return `${formatLatitude(lat)}, ${formatLongitude(lng)}`;
}

export function calculateDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function isPointInArea(
  lat: number,
  lng: number,
  area: AffectedArea
): boolean {
  return (
    lat >= area.latRange[0] &&
    lat <= area.latRange[1] &&
    lng >= area.lngRange[0] &&
    lng <= area.lngRange[1]
  );
}

export function latLngToWorldPosition(
  lat: number,
  lng: number,
  centerLat: number = 31.24,
  centerLng: number = 121.49,
  scale: number = 100
): [number, number, number] {
  const x = (lng - centerLng) * scale;
  const z = (centerLat - lat) * scale;
  const y = 0;

  return [x, y, z];
}

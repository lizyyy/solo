import * as THREE from 'three';
import type { Building } from '../data/types';

export interface SunPositionResult {
  position: [number, number, number];
  color: THREE.Color;
  intensity: number;
  ambientIntensity: number;
}

export function calculateSunPosition(
  hour: number,
  dayOfYear: number = 172,
  latitude: number = 39.9
): SunPositionResult {
  const hourAngle = ((hour - 12) * Math.PI) / 12;
  const declination = 0.409 * Math.sin(((2 * Math.PI) / 365) * (dayOfYear - 81));
  const latRad = (latitude * Math.PI) / 180;

  const sinAlt =
    Math.sin(latRad) * Math.sin(declination) +
    Math.cos(latRad) * Math.cos(declination) * Math.cos(hourAngle);
  const altitude = Math.asin(Math.max(-1, Math.min(1, sinAlt)));

  const cosAz =
    (Math.sin(declination) * Math.cos(latRad) -
      Math.cos(declination) * Math.sin(latRad) * Math.cos(hourAngle)) /
    Math.cos(altitude);
  const sinAz =
    (Math.cos(declination) * Math.sin(hourAngle)) / Math.cos(altitude);
  const azimuth = Math.atan2(sinAz, cosAz);

  const distance = 80;
  const x = distance * Math.cos(altitude) * Math.sin(azimuth);
  const y = distance * Math.sin(altitude);
  const z = distance * Math.cos(altitude) * Math.cos(azimuth);

  let color: THREE.Color;
  let intensity: number;
  let ambientIntensity: number;

  if (hour < 5 || hour > 19) {
    color = new THREE.Color(0x1a1a2e);
    intensity = 0.1;
    ambientIntensity = 0.1;
  } else if (hour < 7 || hour > 17) {
    color = new THREE.Color(0xff7e5f);
    intensity = 0.6;
    ambientIntensity = 0.3;
  } else if (hour < 9 || hour > 15) {
    color = new THREE.Color(0xffd93d);
    intensity = 1.0;
    ambientIntensity = 0.5;
  } else {
    color = new THREE.Color(0xfff5e6);
    intensity = 1.5;
    ambientIntensity = 0.7;
  }

  return {
    position: [x, Math.max(y, 5), z],
    color,
    intensity,
    ambientIntensity,
  };
}

export function calculateBuildingShadow(
  building: Building,
  sunPos: SunPositionResult
): number {
  const height = building.dimensions[1];
  const sunAltitude = Math.asin(sunPos.position[1] / 80);
  if (sunAltitude <= 0) return 0;
  return height / Math.tan(sunAltitude);
}

export function getHourLabel(hour: number): string {
  const h = Math.floor(hour);
  const m = Math.floor((hour - h) * 60);
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

export function getSkyGradient(hour: number): string {
  if (hour < 5 || hour > 19) {
    return 'linear-gradient(180deg, #0a0a1a 0%, #1a1a3a 100%)';
  } else if (hour < 7 || hour > 17) {
    return 'linear-gradient(180deg, #ff7e5f 0%, #feb47b 50%, #4a3f6b 100%)';
  } else if (hour < 9 || hour > 15) {
    return 'linear-gradient(180deg, #87ceeb 0%, #b0d4e8 50%, #e8d4b0 100%)';
  } else {
    return 'linear-gradient(180deg, #4a90d9 0%, #87ceeb 50%, #c4e0f5 100%)';
  }
}

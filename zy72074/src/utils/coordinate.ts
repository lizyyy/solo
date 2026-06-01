import * as THREE from 'three';
import type { CameraState } from '../types';

export const EARTH_RADIUS = 1;

export function latLngToVector3(lat: number, lng: number, radius: number = EARTH_RADIUS): THREE.Vector3 {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lng + 180) * (Math.PI / 180);

  const x = -radius * Math.sin(phi) * Math.cos(theta);
  const y = radius * Math.cos(phi);
  const z = radius * Math.sin(phi) * Math.sin(theta);

  return new THREE.Vector3(x, y, z);
}

export function vector3ToLatLng(position: THREE.Vector3, radius: number = EARTH_RADIUS): { lat: number; lng: number } {
  const normalized = position.clone().normalize();
  
  const lat = 90 - Math.acos(normalized.y) * (180 / Math.PI);
  const lng = Math.atan2(normalized.z, -normalized.x) * (180 / Math.PI) - 180;

  return { lat, lng };
}

export function cameraStateToSpherical(cameraState: CameraState): THREE.Spherical {
  const { lat, lng, altitude } = cameraState;
  
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lng + 180) * (Math.PI / 180);
  const radius = EARTH_RADIUS + altitude;

  return new THREE.Spherical(radius, phi, theta);
}

export function sphericalToCameraState(spherical: THREE.Spherical): CameraState {
  const lat = 90 - spherical.phi * (180 / Math.PI);
  const lng = spherical.theta * (180 / Math.PI) - 180;
  const altitude = spherical.radius - EARTH_RADIUS;

  return { lat, lng, altitude };
}

export function formatCoordinate(lat: number, lng: number): string {
  const latDir = lat >= 0 ? 'N' : 'S';
  const lngDir = lng >= 0 ? 'E' : 'W';
  
  return `${Math.abs(lat).toFixed(4)}°${latDir}, ${Math.abs(lng).toFixed(4)}°${lngDir}`;
}

export function formatChangeRate(rate: number): string {
  const sign = rate > 0 ? '+' : '';
  return `${sign}${rate.toFixed(1)}%`;
}

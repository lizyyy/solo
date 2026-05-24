import { SunPosition, Vector3Tuple } from '../types';

const LATITUDE = 31.23;
const LONGITUDE = 121.47;
const SUN_DISTANCE = 200;

const toRadians = (degrees: number): number => (degrees * Math.PI) / 180;
const toDegrees = (radians: number): number => (radians * 180) / Math.PI;

export const calculateSunPosition = (date: Date, timeMinutes: number): SunPosition => {
  const year = date.getFullYear();
  const month = date.getMonth();
  const day = date.getDate();
  
  const hours = Math.floor(timeMinutes / 60);
  const minutes = timeMinutes % 60;
  
  const hourAngle = (hours + minutes / 60 - 12) * 15;
  
  const dayOfYear = Math.floor(
    (date.getTime() - new Date(year, 0, 0).getTime()) / (1000 * 60 * 60 * 24)
  );
  
  const declination = 23.45 * Math.sin(toRadians((360 / 365) * (284 + dayOfYear)));
  
  const latRad = toRadians(LATITUDE);
  const decRad = toRadians(declination);
  const haRad = toRadians(hourAngle);
  
  const sinAltitude = 
    Math.sin(latRad) * Math.sin(decRad) + 
    Math.cos(latRad) * Math.cos(decRad) * Math.cos(haRad);
  
  const altitude = toDegrees(Math.asin(Math.max(-1, Math.min(1, sinAltitude))));
  
  const cosAzimuth = 
    (Math.sin(decRad) - Math.sin(latRad) * sinAltitude) / 
    (Math.cos(latRad) * Math.cos(Math.asin(sinAltitude)));
  
  let azimuth = toDegrees(Math.acos(Math.max(-1, Math.min(1, cosAzimuth))));
  
  if (hourAngle > 0) {
    azimuth = 360 - azimuth;
  }
  
  const altRad = toRadians(altitude);
  const azRad = toRadians(azimuth);
  
  const x = SUN_DISTANCE * Math.cos(altRad) * Math.sin(azRad);
  const y = SUN_DISTANCE * Math.sin(altRad);
  const z = SUN_DISTANCE * Math.cos(altRad) * Math.cos(azRad);
  
  const dirX = -x / SUN_DISTANCE;
  const dirY = -y / SUN_DISTANCE;
  const dirZ = -z / SUN_DISTANCE;
  
  return {
    azimuth,
    altitude,
    position: [x, y, z],
    direction: [dirX, dirY, dirZ],
  };
};

export const isSunVisible = (altitude: number): boolean => {
  return altitude > 0;
};

export const getSunlightColor = (altitude: number): string => {
  if (altitude < 5) return '#ff6b35';
  if (altitude < 15) return '#ff9f1c';
  if (altitude < 30) return '#ffd166';
  return '#fffbeb';
};

export const getSkyColor = (altitude: number): [number, number, number] => {
  if (altitude < 0) return [0.02, 0.02, 0.08];
  if (altitude < 5) return [0.15, 0.1, 0.2];
  if (altitude < 15) return [0.3, 0.4, 0.6];
  return [0.4, 0.6, 0.9];
};

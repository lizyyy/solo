import { SolarPosition } from '../types';

const LATITUDE = 39.9;
const DEG_TO_RAD = Math.PI / 180;
const RAD_TO_DEG = 180 / Math.PI;

export function calculateDayOfYear(month: number, day: number): number {
  const daysInMonth = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  let dayOfYear = day;
  for (let i = 0; i < month - 1; i++) {
    dayOfYear += daysInMonth[i];
  }
  return dayOfYear;
}

export function calculateDeclination(dayOfYear: number): number {
  return 23.45 * Math.sin((360 / 365) * (dayOfYear - 81) * DEG_TO_RAD);
}

export function calculateHourAngle(hour: number): number {
  return (hour - 12) * 15;
}

export function calculateAltitude(
  latitude: number,
  declination: number,
  hourAngle: number
): number {
  const latRad = latitude * DEG_TO_RAD;
  const decRad = declination * DEG_TO_RAD;
  const haRad = hourAngle * DEG_TO_RAD;

  const sinAlt =
    Math.sin(latRad) * Math.sin(decRad) +
    Math.cos(latRad) * Math.cos(decRad) * Math.cos(haRad);

  return Math.asin(Math.max(-1, Math.min(1, sinAlt))) * RAD_TO_DEG;
}

export function calculateAzimuth(
  latitude: number,
  declination: number,
  hourAngle: number,
  altitude: number
): number {
  const latRad = latitude * DEG_TO_RAD;
  const decRad = declination * DEG_TO_RAD;
  const haRad = hourAngle * DEG_TO_RAD;
  const altRad = altitude * DEG_TO_RAD;

  const cosAz =
    (Math.sin(decRad) - Math.sin(latRad) * Math.sin(altRad)) /
    (Math.cos(latRad) * Math.cos(altRad));

  let azimuth = Math.acos(Math.max(-1, Math.min(1, cosAz))) * RAD_TO_DEG;

  if (hourAngle > 0) {
    azimuth = 360 - azimuth;
  }

  return azimuth;
}

export function calculateSolarPosition(
  month: number,
  day: number,
  hour: number,
  latitude: number = LATITUDE
): SolarPosition {
  const dayOfYear = calculateDayOfYear(month, day);
  const declination = calculateDeclination(dayOfYear);
  const hourAngle = calculateHourAngle(hour);
  const altitude = calculateAltitude(latitude, declination, hourAngle);
  const azimuth = calculateAzimuth(latitude, declination, hourAngle, altitude);

  const altRad = altitude * DEG_TO_RAD;
  const azRad = azimuth * DEG_TO_RAD;
  const distance = 100;

  const x = distance * Math.cos(altRad) * Math.sin(azRad);
  const y = distance * Math.sin(altRad);
  const z = distance * Math.cos(altRad) * Math.cos(azRad);

  return {
    altitude,
    azimuth,
    x,
    y,
    z,
  };
}

export function isSunVisible(altitude: number): boolean {
  return altitude > 0;
}

export function getSunriseSunset(
  month: number,
  day: number,
  latitude: number = LATITUDE
): { sunrise: number; sunset: number } {
  const dayOfYear = calculateDayOfYear(month, day);
  const declination = calculateDeclination(dayOfYear);
  const latRad = latitude * DEG_TO_RAD;
  const decRad = declination * DEG_TO_RAD;

  const cosHA = -Math.tan(latRad) * Math.tan(decRad);
  const hourAngle = Math.acos(Math.max(-1, Math.min(1, cosHA))) * RAD_TO_DEG;

  const sunrise = 12 - hourAngle / 15;
  const sunset = 12 + hourAngle / 15;

  return { sunrise, sunset };
}

export function getDaylightHours(
  month: number,
  day: number,
  latitude: number = LATITUDE
): number {
  const { sunrise, sunset } = getSunriseSunset(month, day, latitude);
  return sunset - sunrise;
}

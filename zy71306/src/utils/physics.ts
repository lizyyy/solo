import { PHYSICAL_CONSTANTS, RadiusUnit } from '../types/calibration';

export const convertRadiusToCm = (radius: number, unit: RadiusUnit): number => {
  if (unit === 'inch') {
    return radius * 2.54;
  }
  return radius;
};

export const convertRadiusFromCm = (radiusCm: number, targetUnit: RadiusUnit): number => {
  if (targetUnit === 'inch') {
    return radiusCm / 2.54;
  }
  return radiusCm;
};

export const calculateEffectiveLength = (tonearmLength: number): number => {
  return tonearmLength * PHYSICAL_CONSTANTS.EFFECTIVE_LENGTH_RATIO;
};

export const calculateTonearmAngle = (tonearmLength: number): number => {
  return Math.asin(PHYSICAL_CONSTANTS.TONEARM_OFFSET / tonearmLength);
};

export const calculateIdealAntiSkating = (
  stylusPressure: number,
  tonearmLength: number
): number => {
  const angle = calculateTonearmAngle(tonearmLength);
  return stylusPressure * PHYSICAL_CONSTANTS.IDEAL_ANTISKATING_MULTIPLIER * Math.sin(angle);
};

export const calculateTorque = (
  stylusPressure: number,
  tonearmLength: number
): number => {
  const effectiveLength = calculateEffectiveLength(tonearmLength) / 1000;
  const forceNewtons = (stylusPressure / 1000) * PHYSICAL_CONSTANTS.GRAVITY;
  return forceNewtons * effectiveLength * 1000;
};

export const normalizeValue = (
  value: number,
  min: number,
  max: number
): number => {
  return Math.max(0, Math.min(1, (value - min) / (max - min)));
};

export const clamp = (value: number, min: number, max: number): number => {
  return Math.max(min, Math.min(max, value));
};

export const lerp = (a: number, b: number, t: number): number => {
  return a + (b - a) * t;
};

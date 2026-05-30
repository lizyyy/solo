import type { Calibration } from '../types';

export const DEFAULT_CALIBRATION: Calibration = {
  zero: 0.5,
  sensitivity: 2.0,
  gain: 50.0,
  unit: 'N·m'
};

export function calculateTorque(
  torqueRaw: number,
  calibration: Calibration = DEFAULT_CALIBRATION
): number {
  const torque = (torqueRaw - calibration.zero) * calibration.sensitivity * calibration.gain;
  return Math.round(torque * 1000) / 1000;
}

export function calculateTorqueFromSamples(
  torqueRaws: number[],
  calibration: Calibration = DEFAULT_CALIBRATION
): number[] {
  return torqueRaws.map(raw => calculateTorque(raw, calibration));
}

export function calculatePower(torque: number, speed: number): number {
  if (speed <= 0) return 0;
  const power = (torque * speed) / 9550;
  return Math.round(power * 1000) / 1000;
}

export function calculateTorqueStatistics(
  torques: number[]
): { avg: number; max: number; min: number; std: number } {
  if (torques.length === 0) {
    return { avg: 0, max: 0, min: 0, std: 0 };
  }
  
  const sum = torques.reduce((a, b) => a + b, 0);
  const avg = sum / torques.length;
  const max = Math.max(...torques);
  const min = Math.min(...torques);
  
  const squaredDiffs = torques.map(t => Math.pow(t - avg, 2));
  const avgSquaredDiff = squaredDiffs.reduce((a, b) => a + b, 0) / torques.length;
  const std = Math.sqrt(avgSquaredDiff);
  
  return {
    avg: Math.round(avg * 1000) / 1000,
    max: Math.round(max * 1000) / 1000,
    min: Math.round(min * 1000) / 1000,
    std: Math.round(std * 1000) / 1000
  };
}

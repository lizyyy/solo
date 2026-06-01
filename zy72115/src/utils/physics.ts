import type { PhysicsResult } from '@/types';

export function calculateFundamental(rpm: number): number {
  return rpm / 60;
}

export function calculateHarmonics(fundamentalHz: number, maxOrder: number = 6): number[] {
  const harmonics: number[] = [];
  for (let i = 1; i <= maxOrder; i++) {
    harmonics.push(fundamentalHz * i);
  }
  return harmonics;
}

export function velocityToDisplacement(velocityMmPerS: number, frequencyHz: number): number {
  if (frequencyHz <= 0) return 0;
  return (velocityMmPerS / (2 * Math.PI * frequencyHz)) * 1000;
}

export function rmsToPeak(rmsValue: number): number {
  return rmsValue * Math.SQRT2;
}

export function peakToRms(peakValue: number): number {
  return peakValue / Math.SQRT2;
}

export function calculatePhysics(amplitudeMmPerS: number, frequencyHz: number, rpm: number): PhysicsResult {
  const fundamentalHz = calculateFundamental(rpm);
  const harmonics = calculateHarmonics(fundamentalHz);
  const displacementUm = velocityToDisplacement(amplitudeMmPerS, frequencyHz);
  const peakMmPerS = rmsToPeak(amplitudeMmPerS);
  const rmsMmPerS = amplitudeMmPerS;

  return {
    fundamentalHz: Math.round(fundamentalHz * 100) / 100,
    harmonics: harmonics.map(h => Math.round(h * 100) / 100),
    displacementUm: Math.round(displacementUm * 100) / 100,
    peakMmPerS: Math.round(peakMmPerS * 100) / 100,
    rmsMmPerS: Math.round(rmsMmPerS * 100) / 100,
  };
}

export function identifyHarmonicOrder(frequencyHz: number, fundamentalHz: number): number | null {
  if (fundamentalHz <= 0) return null;
  const ratio = frequencyHz / fundamentalHz;
  const nearestOrder = Math.round(ratio);
  if (Math.abs(ratio - nearestOrder) < 0.05 && nearestOrder >= 1 && nearestOrder <= 10) {
    return nearestOrder;
  }
  return null;
}

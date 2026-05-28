import {
  calculateIdealAntiSkating,
  convertRadiusToCm,
} from '../utils/physics';
import { getTrackById } from '../data/testTracks';
import { CalibrationParams, WEAR_FACTORS, PHYSICAL_CONSTANTS } from '../types/calibration';

export interface WearBreakdown {
  totalWear: number;
  pressureWear: number;
  antiSkatingWear: number;
  lengthWear: number;
  trackWear: number;
  pressureFactor: number;
  antiSkatingFactor: number;
  lengthFactor: number;
  trackFactor: number;
  idealAntiSkating: number;
  antiSkatingGap: number;
  lengthDeviation: number;
}

export const calculateWearBreakdown = (
  params: CalibrationParams
): WearBreakdown => {
  const {
    stylusPressure,
    antiSkating,
    antiSkatingDirection,
    tonearmLength,
    recordRadius,
    recordRadiusUnit,
    testTrack,
  } = params;

  const radiusCm = convertRadiusToCm(recordRadius, recordRadiusUnit);
  const idealAntiSkating = calculateIdealAntiSkating(stylusPressure, tonearmLength);

  const directionMultiplier = antiSkatingDirection === 'reverse' ? -1 : 1;
  const actualAntiSkating = antiSkating * directionMultiplier;
  const antiSkatingGap = Math.abs(actualAntiSkating - idealAntiSkating);

  const lengthDeviation = Math.abs(tonearmLength - PHYSICAL_CONSTANTS.STANDARD_TONEARM_LENGTH);

  const track = getTrackById(testTrack);

  const pressureWear = stylusPressure * WEAR_FACTORS.pressureFactor;
  const antiSkatingWear = antiSkatingGap * WEAR_FACTORS.antiSkatingFactor;
  const lengthWear = lengthDeviation * WEAR_FACTORS.lengthFactor;
  const trackWear = track.difficultyFactor * WEAR_FACTORS.trackFactor;

  const radiusFactor = radiusCm / 14;
  const baseWear = pressureWear + antiSkatingWear + lengthWear;
  const totalWear = Math.min(
    100,
    (baseWear * trackWear * radiusFactor) / WEAR_FACTORS.maxExpectedWear * 100
  );

  return {
    totalWear,
    pressureWear,
    antiSkatingWear,
    lengthWear,
    trackWear,
    pressureFactor: WEAR_FACTORS.pressureFactor,
    antiSkatingFactor: WEAR_FACTORS.antiSkatingFactor,
    lengthFactor: WEAR_FACTORS.lengthFactor,
    trackFactor: WEAR_FACTORS.trackFactor,
    idealAntiSkating,
    antiSkatingGap,
    lengthDeviation,
  };
};

export const getWearLevelDescription = (level: number): string => {
  if (level < 20) return '极轻微磨损，唱片几乎不受影响';
  if (level < 40) return '轻微磨损，正常使用范围内';
  if (level < 60) return '中度磨损，长期使用可能产生杂音';
  if (level < 80) return '较高磨损，建议调整参数';
  return '严重磨损，可能导致唱片永久性损坏';
};

export const getWearRecommendations = (
  breakdown: WearBreakdown
): string[] => {
  const recommendations: string[] = [];

  if (breakdown.pressureWear > 30) {
    recommendations.push('建议降低唱针压力，理想范围通常为1.5-2.0g');
  }
  if (breakdown.antiSkatingWear > 25) {
    recommendations.push(
      `抗滑力偏差较大，建议调整至约 ${breakdown.idealAntiSkating.toFixed(2)}`
    );
  }
  if (breakdown.lengthWear > 15) {
    recommendations.push('唱臂长度偏差较大，请确认唱臂规格是否正确');
  }
  if (breakdown.trackWear > 1.4) {
    recommendations.push('测试曲目难度较高，正常播放时磨损会相对较低');
  }

  if (recommendations.length === 0) {
    recommendations.push('参数设置合理，继续保持');
  }

  return recommendations;
};

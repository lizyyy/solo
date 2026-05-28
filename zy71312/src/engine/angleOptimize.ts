import type { OptimizationStrategy } from '../types';

export function optimizeAngle(
  latitude: number,
  strategy: OptimizationStrategy = 'yearly'
): {
  angle: number;
  reason: string;
} {
  let angle: number;
  let reason: string;

  switch (strategy) {
    case 'winter':
      angle = latitude + 4;
      reason = `冬季优化策略：倾角=纬度+4°（${latitude}°+4°），最大化冬季低角度阳光接收`;
      break;
    case 'summer':
      angle = latitude - 10;
      reason = `夏季优化策略：倾角=纬度-10°（${latitude}°-10°），适应夏季高角度阳光`;
      break;
    default:
      angle = latitude * 0.87 + 3.1;
      reason = `全年优化策略：倾角=纬度×0.87+3.1°（${latitude}°×0.87+3.1°），平衡各季节发电效率`;
  }

  return {
    angle: Math.max(0, Math.min(90, Math.round(angle * 10) / 10)),
    reason,
  };
}

export function calculateAngleEfficiency(
  latitude: number,
  tiltAngle: number,
  dayOfYear: number = 172
): number {
  const declination = 23.45 * Math.sin((2 * Math.PI / 365) * (dayOfYear - 81));
  const incidenceAngle = Math.abs(latitude - declination - tiltAngle);
  const efficiency = Math.cos((incidenceAngle * Math.PI) / 180);
  return Math.max(0, Math.min(1, efficiency));
}

export function findOptimalAngleBySeason(
  latitude: number,
  seasonWeights: { spring: number; summer: number; autumn: number; winter: number }
): {
  angle: number;
  reason: string;
} {
  const totalWeight =
    seasonWeights.spring +
    seasonWeights.summer +
    seasonWeights.autumn +
    seasonWeights.winter;

  if (totalWeight === 0) {
    return optimizeAngle(latitude, 'yearly');
  }

  const normalizedWeights = {
    spring: seasonWeights.spring / totalWeight,
    summer: seasonWeights.summer / totalWeight,
    autumn: seasonWeights.autumn / totalWeight,
    winter: seasonWeights.winter / totalWeight,
  };

  const winterAngle = latitude + 4;
  const summerAngle = latitude - 10;
  const springAngle = latitude * 0.87 + 3.1;
  const autumnAngle = latitude * 0.87 + 3.1;

  const weightedAngle =
    winterAngle * normalizedWeights.winter +
    summerAngle * normalizedWeights.summer +
    springAngle * normalizedWeights.spring +
    autumnAngle * normalizedWeights.autumn;

  let reason = `基于季节权重优化：冬(${normalizedWeights.winter.toFixed(
    2
  )})夏(${normalizedWeights.summer.toFixed(2)})春秋(${normalizedWeights.spring.toFixed(2)})加权计算`;

  return {
    angle: Math.max(0, Math.min(90, Math.round(weightedAngle * 10) / 10)),
    reason,
  };
}

export function validateAngle(angle: number): {
  valid: boolean;
  warning?: string;
} {
  if (angle < 0 || angle > 90) {
    return {
      valid: false,
      warning: '倾角应在0°-90°之间',
    };
  }

  if (angle === 0) {
    return {
      valid: true,
      warning: '水平安装（0°）在高纬度地区冬季效率较低',
    };
  }

  if (angle > 60) {
    return {
      valid: true,
      warning: '倾角超过60°可能增加风阻和安装难度',
    };
  }

  return { valid: true };
}

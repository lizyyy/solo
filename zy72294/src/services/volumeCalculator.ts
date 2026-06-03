import type * as T from '@/types';

export const PARAM_VERSION = 'v1.2.0';

export function calculateCone(height: number, radius: number): T.CalculationResult {
  const volume = (1 / 3) * Math.PI * Math.pow(radius, 2) * height;
  return {
    volume: Number(volume.toFixed(4)),
    model: 'cone',
    paramVersion: PARAM_VERSION,
    tradeoffReason: '采用锥体模型计算，适用于顶部呈锥形的堆垛，计算公式：V = 1/3 × π × r² × h',
    params: { height, radius },
  };
}

export function calculateCuboid(
  length: number,
  width: number,
  height: number
): T.CalculationResult {
  const volume = length * width * height;
  return {
    volume: Number(volume.toFixed(4)),
    model: 'cuboid',
    paramVersion: PARAM_VERSION,
    tradeoffReason: '采用长方体模型计算，适用于形状规整的堆垛，计算公式：V = l × w × h',
    params: { length, width, height },
  };
}

export function autoSelectModel(record: T.RangefinderRecord): T.CalculationResult {
  const distance = record.distance;
  const height = distance;

  if (distance < 5) {
    const radius = distance * 0.6;
    const result = calculateCone(height, radius);
    result.tradeoffReason = `测距值${distance}米 < 5米，取锥体模型而非长方体，因近距离堆垛顶部呈锥形特征明显`;
    return result;
  } else {
    const length = distance * 0.8;
    const width = distance * 0.6;
    const result = calculateCuboid(length, width, height);
    result.tradeoffReason = `测距值${distance}米 >= 5米，取长方体模型，因远距离堆垛整体形状更趋近于规整长方体`;
    return result;
  }
}

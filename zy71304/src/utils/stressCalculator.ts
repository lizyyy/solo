import type {
  PrintBatch,
  StressResult,
  StressPoint,
  TemperaturePoint,
  RiskLevel,
  Material,
} from '../types';
import { getMaterialById } from '../data/materials';
import { normalizeToMm } from './unitConverter';
import { validateAll } from './dataValidator';

const GRID_SIZE = 10;

const SHRINKAGE_WEIGHT = 30;
const TEMP_DIFF_WEIGHT = 25;
const DIMENSION_WEIGHT = 20;
const COOLING_WEIGHT = 15;
const ADHESION_WEIGHT = 10;

export const calculateShrinkage = (
  thermalExpansionCoeff: number,
  nozzleTemp: number,
  ambientTemp: number,
  dimensionMm: number,
): { shrinkageRate: number; shrinkageMm: number } => {
  const temperatureDiff = nozzleTemp - ambientTemp;
  const shrinkageRate = thermalExpansionCoeff * temperatureDiff * 1e-4;
  const shrinkageMm = dimensionMm * (shrinkageRate / 100);
  return {
    shrinkageRate: Number(shrinkageRate.toFixed(2)),
    shrinkageMm: Number(shrinkageMm.toFixed(2)),
  };
};

export const calculateCoolingRate = (
  coolingFanSpeed: number,
  ambientTemp: number,
  layerHeight: number,
  printSpeed: number,
): number => {
  const fanFactor = coolingFanSpeed / 100;
  const layerFactor = 0.2 / layerHeight;
  const speedFactor = printSpeed / 50;
  return Number((fanFactor * 1.5 + layerFactor * 0.8 + speedFactor * 0.6).toFixed(2));
};

export const calculateRiskLevel = (score: number): RiskLevel => {
  if (score >= 75) return 'critical';
  if (score >= 55) return 'high';
  if (score >= 30) return 'medium';
  return 'low';
};

export const getRiskLevelColor = (level: RiskLevel): string => {
  const colors: Record<RiskLevel, string> = {
    low: '#00B42A',
    medium: '#FFAA00',
    high: '#FF7D00',
    critical: '#F53F3F',
  };
  return colors[level];
};

export const getRiskLevelLabel = (level: RiskLevel): string => {
  const labels: Record<RiskLevel, string> = {
    low: '低风险',
    medium: '中等风险',
    high: '高风险',
    critical: '极高风险',
  };
  return labels[level];
};

const generateStressDistribution = (
  widthMm: number,
  heightMm: number,
  baseScore: number,
): StressPoint[][] => {
  const grid: StressPoint[][] = [];
  const centerX = GRID_SIZE / 2;
  const centerY = GRID_SIZE / 2;

  for (let y = 0; y < GRID_SIZE; y++) {
    const row: StressPoint[] = [];
    for (let x = 0; x < GRID_SIZE; x++) {
      const edgeDistance = Math.max(
        Math.abs(x - centerX),
        Math.abs(y - centerY),
        GRID_SIZE - 1 - Math.max(x, y),
      );

      const cornerFactor =
        (x === 0 || x === GRID_SIZE - 1 ? 1 : 0) +
        (y === 0 || y === GRID_SIZE - 1 ? 1 : 0);
      const edgeFactor = edgeDistance / (GRID_SIZE / 2);
      const cornerMultiplier = cornerFactor > 0 ? 1.3 + cornerFactor * 0.15 : 1;

      const sizeFactor = Math.min(Math.max(widthMm, heightMm) / 300, 2);
      const baseValue =
        (baseScore / 100) *
        (0.4 + edgeFactor * 0.6) *
        cornerMultiplier *
        sizeFactor;

      const noise = (Math.random() - 0.5) * 0.1;
      const value = Math.max(0, Math.min(1, baseValue + noise));

      let riskLevel: RiskLevel = 'low';
      if (value >= 0.75) riskLevel = 'critical';
      else if (value >= 0.55) riskLevel = 'high';
      else if (value >= 0.3) riskLevel = 'medium';

      row.push({
        x,
        y,
        value: Number((value * 100).toFixed(1)),
        riskLevel,
        detailRowId: `row-${y * GRID_SIZE + x + 1}`,
      });
    }
    grid.push(row);
  }
  return grid;
};

const generateTemperatureCurve = (
  nozzleTemp: number,
  bedTemp: number,
  ambientTemp: number,
  layerCount: number,
): TemperaturePoint[] => {
  const points: TemperaturePoint[] = [];
  const totalLayers = layerCount;

  for (let i = 0; i <= totalLayers; i++) {
    const layerRatio = i / totalLayers;
    const nozzle = nozzleTemp - layerRatio * 10;
    const bedCooling = Math.max(ambientTemp, bedTemp - layerRatio * (bedTemp - ambientTemp) * 0.3);

    points.push({
      layer: i,
      nozzle: Number(nozzle.toFixed(1)),
      bed: Number(bedCooling.toFixed(1)),
      ambient: ambientTemp,
    });
  }
  return points;
};

export const calculateStress = (batch: PrintBatch): StressResult => {
  const material = getMaterialById(batch.materialId);
  const errors = validateAll(batch);

  if (!material) {
    return {
      id: `result-${Date.now()}`,
      batchId: batch.id,
      temperatureDiff: 0,
      tempDiffSign: 0,
      shrinkageRate: 0,
      totalShrinkage: 0,
      stressRiskScore: 0,
      riskLevel: 'low',
      stressDistribution: [],
      temperatureCurve: [],
      shrinkageByDimension: { width: 0, height: 0, depth: 0 },
      coolingRate: 0,
      validationErrors: errors,
      analysisTime: new Date().toISOString(),
    };
  }

  const dimensions = normalizeToMm(
    batch.modelWidth,
    batch.widthUnit,
    batch.modelHeight,
    batch.heightUnit,
    batch.modelDepth,
    batch.depthUnit,
  );

  const temperatureDiff = batch.nozzleTemp - batch.ambientTemp;
  const tempDiffSign = temperatureDiff >= 0 ? 1 : -1;

  const maxDimension = Math.max(dimensions.width, dimensions.height, dimensions.depth);
  const { shrinkageRate, shrinkageMm } = calculateShrinkage(
    material.thermalExpansionCoeff,
    batch.nozzleTemp,
    batch.ambientTemp,
    maxDimension,
  );

  const widthShrinkage = calculateShrinkage(
    material.thermalExpansionCoeff,
    batch.nozzleTemp,
    batch.ambientTemp,
    dimensions.width,
  ).shrinkageMm;

  const heightShrinkage = calculateShrinkage(
    material.thermalExpansionCoeff,
    batch.nozzleTemp,
    batch.ambientTemp,
    dimensions.height,
  ).shrinkageMm;

  const depthShrinkage = calculateShrinkage(
    material.thermalExpansionCoeff,
    batch.nozzleTemp,
    batch.ambientTemp,
    dimensions.depth,
  ).shrinkageMm;

  const coolingRate = calculateCoolingRate(
    batch.coolingFanSpeed,
    batch.ambientTemp,
    batch.layerHeight,
    batch.printSpeed,
  );

  const normalizedDiff = Math.min(Math.abs(temperatureDiff) / 250, 1) * 100;
  const normalizedSize = Math.min(maxDimension / 400, 1) * 100;
  const normalizedCooling = Math.min(coolingRate / 4, 1) * 100;
  const adhesionPenalty = (5 - material.adhesionStrength) * 20;

  const bedTempBonus =
    batch.bedTemp >= material.glassTransitionTemp * 0.8
      ? 15
      : batch.bedTemp >= material.glassTransitionTemp * 0.6
        ? 5
        : 0;

  let stressRiskScore =
    (shrinkageRate / 3) * SHRINKAGE_WEIGHT +
    normalizedDiff * (TEMP_DIFF_WEIGHT / 100) +
    normalizedSize * (DIMENSION_WEIGHT / 100) +
    normalizedCooling * (COOLING_WEIGHT / 100) +
    adhesionPenalty * (ADHESION_WEIGHT / 100) -
    bedTempBonus;

  stressRiskScore = Math.max(0, Math.min(100, Math.round(stressRiskScore)));
  const riskLevel = calculateRiskLevel(stressRiskScore);

  const layerCount = Math.max(10, Math.ceil(dimensions.height / batch.layerHeight));

  const stressDistribution = generateStressDistribution(
    dimensions.width,
    dimensions.depth,
    stressRiskScore,
  );

  const temperatureCurve = generateTemperatureCurve(
    batch.nozzleTemp,
    batch.bedTemp,
    batch.ambientTemp,
    Math.min(layerCount, 20),
  );

  return {
    id: `result-${Date.now()}`,
    batchId: batch.id,
    temperatureDiff: Math.abs(temperatureDiff),
    tempDiffSign,
    shrinkageRate,
    totalShrinkage: shrinkageMm,
    stressRiskScore,
    riskLevel,
    stressDistribution,
    temperatureCurve,
    shrinkageByDimension: {
      width: widthShrinkage,
      height: heightShrinkage,
      depth: depthShrinkage,
    },
    coolingRate,
    validationErrors: errors,
    analysisTime: new Date().toISOString(),
  };
};

export const getDetailRows = (
  stressDistribution: StressPoint[][],
): Array<{
  id: string;
  position: string;
  x: number;
  y: number;
  stressValue: number;
  riskLevel: RiskLevel;
  description: string;
}> => {
  const rows = [];
  for (let y = 0; y < stressDistribution.length; y++) {
    for (let x = 0; x < stressDistribution[y].length; x++) {
      const point = stressDistribution[y][x];
      const positionLabels = [];
      if (x === 0) positionLabels.push('左');
      if (x === GRID_SIZE - 1) positionLabels.push('右');
      if (y === 0) positionLabels.push('前');
      if (y === GRID_SIZE - 1) positionLabels.push('后');
      const position = positionLabels.length > 0 ? positionLabels.join('') : '中心区域';

      rows.push({
        id: point.detailRowId,
        position: `(${x},${y}) ${position}`,
        x,
        y,
        stressValue: point.value,
        riskLevel: point.riskLevel,
        description: `该位置应力值 ${point.value.toFixed(1)}，${getRiskLevelLabel(point.riskLevel)}`,
      });
    }
  }
  return rows.sort((a, b) => b.stressValue - a.stressValue);
};

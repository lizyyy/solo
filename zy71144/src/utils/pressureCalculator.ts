import type {
  PathNode,
  TrainingParams,
  CalculationResult,
  Warning,
  PressurePoint,
} from '../types';
import {
  calculateTotalLength,
  calculateVerticalHeight,
  countCorners,
  countStairs,
  distance3D,
} from './pathCalculator';

const FRICTION_COEFFICIENT = 0.028;
const GRAVITY = 9.81;
const WATER_DENSITY = 1000;

const CORNER_LOSS_FACTOR = 0.025;
const STAIR_LOSS_FACTOR = 0.015;
const VERTICAL_LOSS_PER_METER = 0.01;

export const calculateFlowVelocity = (
  flowRate: number,
  diameterMm: number
): number => {
  const diameterM = diameterMm / 1000;
  const area = Math.PI * Math.pow(diameterM / 2, 2);
  const flowRateM3s = flowRate / 60 / 1000;
  return flowRateM3s / area;
};

export const calculateFrictionLoss = (
  length: number,
  diameterMm: number,
  velocity: number
): number => {
  const diameterM = diameterMm / 1000;
  const lossPa =
    FRICTION_COEFFICIENT *
    (length / diameterM) *
    (Math.pow(velocity, 2) / (2 * GRAVITY)) *
    WATER_DENSITY *
    GRAVITY;
  return lossPa / 1000000;
};

export const calculateCornerLoss = (
  cornerCount: number,
  velocity: number
): number => {
  const lossPerCorner = 0.5 * (velocity * velocity / 2 / GRAVITY) * 1000 * 9.81;
  return (cornerCount * lossPerCorner * CORNER_LOSS_FACTOR) / 1000000;
};

export const calculateVerticalLoss = (height: number): number => {
  return height * VERTICAL_LOSS_PER_METER;
};

export const calculateStairLoss = (
  stairCount: number,
  velocity: number
): number => {
  return stairCount * STAIR_LOSS_FACTOR * (velocity * velocity / 20);
};

export const calculatePressureCurve = (
  nodes: PathNode[],
  initialPressure: number,
  params: TrainingParams
): PressurePoint[] => {
  if (nodes.length < 2) return [];

  const velocity = calculateFlowVelocity(params.flowRate, params.hoseDiameter);
  const curve: PressurePoint[] = [
    { distance: 0, pressure: initialPressure, nodeType: 'start' },
  ];

  let accumulatedDistance = 0;
  let accumulatedLoss = 0;

  for (let i = 1; i < nodes.length; i++) {
    const segmentLength = distance3D(nodes[i - 1].position, nodes[i].position);
    const segmentFrictionLoss = calculateFrictionLoss(
      segmentLength,
      params.hoseDiameter,
      velocity
    );

    accumulatedDistance += segmentLength;
    accumulatedLoss += segmentFrictionLoss;

    if (i > 1 && i < nodes.length - 1) {
      accumulatedLoss += CORNER_LOSS_FACTOR * 0.02;
    }

    if (nodes[i].type === 'stairs') {
      accumulatedLoss += STAIR_LOSS_FACTOR * 0.03;
    }

    const verticalChange = nodes[i].position.y - nodes[i - 1].position.y;
    if (verticalChange > 0) {
      accumulatedLoss += verticalChange * VERTICAL_LOSS_PER_METER;
    }

    curve.push({
      distance: Math.round(accumulatedDistance * 100) / 100,
      pressure: Math.round((initialPressure - accumulatedLoss) * 1000) / 1000,
      nodeType: nodes[i].type,
    });
  }

  return curve;
};

export const calculateAll = (
  nodes: PathNode[],
  params: TrainingParams,
  initialPressure: number = 0.6
): CalculationResult => {
  const warnings: Warning[] = [];

  if (nodes.length < 2) {
    return {
      totalLength: 0,
      cornerCount: 0,
      stairCount: 0,
      verticalHeight: 0,
      pressureLoss: 0,
      remainingPressure: initialPressure,
      initialPressure,
      warnings: [],
      isValid: false,
      pressureCurve: [],
    };
  }

  const totalLength = calculateTotalLength(nodes);
  const cornerCount = countCorners(nodes);
  const stairCount = countStairs(nodes);
  const verticalHeight = calculateVerticalHeight(nodes);

  const velocity = calculateFlowVelocity(params.flowRate, params.hoseDiameter);
  const frictionLoss = calculateFrictionLoss(
    totalLength,
    params.hoseDiameter,
    velocity
  );
  const cornerLoss = calculateCornerLoss(cornerCount, velocity);
  const verticalLoss = calculateVerticalLoss(verticalHeight);
  const stairLoss = calculateStairLoss(stairCount, velocity);

  const pressureLoss = frictionLoss + cornerLoss + verticalLoss + stairLoss;
  const remainingPressure = Math.max(0, initialPressure - pressureLoss);

  if (totalLength > params.maxHoseLength) {
    warnings.push({
      type: 'length',
      severity: 'error',
      message: `水带长度 ${totalLength.toFixed(1)}m 超过最大限制 ${params.maxHoseLength}m`,
    });
  } else if (totalLength > params.maxHoseLength * 0.85) {
    warnings.push({
      type: 'length',
      severity: 'warning',
      message: `水带长度已达限制的 ${((totalLength / params.maxHoseLength) * 100).toFixed(0)}%`,
    });
  }

  if (cornerCount > params.maxCorners) {
    warnings.push({
      type: 'corners',
      severity: 'error',
      message: `转角数量 ${cornerCount} 个超过最大限制 ${params.maxCorners} 个`,
    });
  } else if (cornerCount > params.maxCorners * 0.8) {
    warnings.push({
      type: 'corners',
      severity: 'warning',
      message: `转角数量已达限制的 ${((cornerCount / params.maxCorners) * 100).toFixed(0)}%`,
    });
  }

  if (remainingPressure < params.minPressure) {
    warnings.push({
      type: 'pressure',
      severity: 'error',
      message: `剩余压力 ${remainingPressure.toFixed(3)}MPa 低于最小要求 ${params.minPressure}MPa`,
    });
  } else if (remainingPressure < params.minPressure * 1.2) {
    warnings.push({
      type: 'pressure',
      severity: 'warning',
      message: `剩余压力接近下限，请注意`,
    });
  }

  const pressureCurve = calculatePressureCurve(nodes, initialPressure, params);

  const isValid = warnings.every((w) => w.severity !== 'error');

  return {
    totalLength: Math.round(totalLength * 100) / 100,
    cornerCount,
    stairCount,
    verticalHeight: Math.round(verticalHeight * 100) / 100,
    pressureLoss: Math.round(pressureLoss * 1000) / 1000,
    remainingPressure: Math.round(remainingPressure * 1000) / 1000,
    initialPressure,
    warnings,
    isValid,
    pressureCurve,
  };
};

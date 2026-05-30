import { FunctionCard, CurvePoint, Point } from '../types';

const EPSILON = 0.001;
const DEFAULT_STEP = 0.02;

export const calculateSlope = (
  fn: (x: number) => number,
  x: number,
  h: number = EPSILON
): number => {
  const y1 = fn(x - h);
  const y2 = fn(x + h);
  return (y2 - y1) / (2 * h);
};

export const calculateLeftDerivative = (
  fn: (x: number) => number,
  x: number,
  h: number = EPSILON
): number => {
  const y1 = fn(x - h);
  const y2 = fn(x);
  return (y2 - y1) / h;
};

export const calculateRightDerivative = (
  fn: (x: number) => number,
  x: number,
  h: number = EPSILON
): number => {
  const y1 = fn(x);
  const y2 = fn(x + h);
  return (y2 - y1) / h;
};

export const isDifferentiable = (
  fn: (x: number) => number,
  x: number,
  nonDifferentiablePoints: number[],
  tolerance: number = 0.1
): boolean => {
  const isNearNonDiffPoint = nonDifferentiablePoints.some(
    point => Math.abs(x - point) < EPSILON * 10
  );
  if (isNearNonDiffPoint) return false;

  const leftDeriv = calculateLeftDerivative(fn, x);
  const rightDeriv = calculateRightDerivative(fn, x);

  if (!isFinite(leftDeriv) || !isFinite(rightDeriv)) return false;

  return Math.abs(leftDeriv - rightDeriv) < tolerance;
};

export const isDiscontinuity = (
  fn: (x: number) => number,
  x: number,
  discontinuities: number[],
  h: number = EPSILON
): boolean => {
  const isNearDiscontinuity = discontinuities.some(
    point => Math.abs(x - point) < EPSILON * 10
  );
  if (isNearDiscontinuity) return true;

  const yLeft = fn(x - h);
  const yRight = fn(x + h);
  return Math.abs(yRight - yLeft) > 1;
};

export const generateCurvePoints = (
  functionCard: FunctionCard,
  step: number = DEFAULT_STEP
): CurvePoint[] => {
  const points: CurvePoint[] = [];
  const [minX, maxX] = functionCard.domain;

  for (let x = minX; x <= maxX; x += step) {
    const clampedX = Math.min(Math.max(x, minX), maxX);
    const y = functionCard.fn(clampedX);
    const slope = calculateSlope(functionCard.fn, clampedX);
    const differentiable = isDifferentiable(
      functionCard.fn,
      clampedX,
      functionCard.nonDifferentiablePoints
    );
    const discontinuity = isDiscontinuity(
      functionCard.fn,
      clampedX,
      functionCard.discontinuities
    );

    const trap = functionCard.traps.find(
      t => Math.abs(t.x - clampedX) < step
    );

    points.push({
      x: clampedX,
      y,
      slope,
      isDifferentiable: differentiable,
      isDiscontinuity: discontinuity,
      trap,
    });
  }

  return points;
};

export const fillMissingPoints = (
  existingPoints: CurvePoint[],
  functionCard: FunctionCard,
  missingIndices: number[]
): CurvePoint[] => {
  const allPoints = generateCurvePoints(functionCard);
  const result = [...existingPoints];

  missingIndices.forEach(index => {
    if (index >= 0 && index < allPoints.length) {
      result[index] = {
        ...allPoints[index],
      };
    }
  });

  return result;
};

export const rollbackToPoint = (
  points: CurvePoint[],
  rollbackIndex: number
): CurvePoint[] => {
  if (rollbackIndex < 0 || rollbackIndex >= points.length) {
    return points;
  }
  return points.slice(0, rollbackIndex + 1);
};

export const findDuplicatePoints = (
  points: CurvePoint[],
  tolerance: number = 0.0001
): number[] => {
  const duplicates: number[] = [];
  const seen = new Map<string, number>();

  points.forEach((point, index) => {
    const key = `${point.x.toFixed(5)},${point.y.toFixed(5)}`;
    if (seen.has(key)) {
      duplicates.push(index);
    } else {
      seen.set(key, index);
    }
  });

  return duplicates;
};

export const isOutOfBounds = (
  point: Point,
  domain: [number, number]
): boolean => {
  return point.x < domain[0] || point.x > domain[1];
};

export const findNearestCurveIndex = (
  curvePoints: CurvePoint[],
  targetX: number
): number => {
  let nearestIndex = 0;
  let minDistance = Infinity;

  curvePoints.forEach((point, index) => {
    const distance = Math.abs(point.x - targetX);
    if (distance < minDistance) {
      minDistance = distance;
      nearestIndex = index;
    }
  });

  return nearestIndex;
};

export const generateBatchId = (): string => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  return `BATCH-${year}${month}${day}-${hours}${minutes}${seconds}`;
};

export const generateId = (prefix: string = 'id'): string => {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

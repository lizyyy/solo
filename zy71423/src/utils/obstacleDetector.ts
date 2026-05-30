import { CurvePoint, Point, FunctionCard, Trap, ExceptionRecord, Severity } from '../types';
import { generateId } from './curveGenerator';

export const checkTrapCollision = (
  playerPosition: Point,
  trap: Trap,
  functionCard: FunctionCard
): boolean => {
  const trapY = functionCard.fn(trap.x);
  const distance = Math.sqrt(
    Math.pow(playerPosition.x - trap.x, 2) +
    Math.pow(playerPosition.y - trapY, 2)
  );
  return distance < trap.radius;
};

export const checkAnyTrapCollision = (
  playerPosition: Point,
  functionCard: FunctionCard
): Trap | null => {
  for (const trap of functionCard.traps) {
    if (checkTrapCollision(playerPosition, trap, functionCard)) {
      return trap;
    }
  }
  return null;
};

export const checkBoundaryCrossing = (
  prevPosition: Point,
  currentPosition: Point,
  domain: [number, number]
): boolean => {
  const prevOutOfBounds = prevPosition.x < domain[0] || prevPosition.x > domain[1];
  const currOutOfBounds = currentPosition.x < domain[0] || currentPosition.x > domain[1];
  return !prevOutOfBounds && currOutOfBounds;
};

export const checkBreakpointCrossing = (
  prevPosition: Point,
  currentPosition: Point,
  discontinuities: number[]
): number | null => {
  const minX = Math.min(prevPosition.x, currentPosition.x);
  const maxX = Math.max(prevPosition.x, currentPosition.x);

  for (const discontinuity of discontinuities) {
    if (discontinuity >= minX && discontinuity <= maxX) {
      return discontinuity;
    }
  }
  return null;
};

export const checkSlopeMisjudgment = (
  currentPoint: CurvePoint,
  playerSpeed: number,
  thresholdSpeed: number = 0.5
): boolean => {
  return !currentPoint.isDifferentiable && playerSpeed > thresholdSpeed;
};

export const createSlopeMisjudgmentException = (
  recordId: string,
  batchId: string,
  position: Point,
  trap: Trap | null
): ExceptionRecord => {
  const trapType = trap?.type || 'unknown';
  return {
    id: generateId('exc'),
    recordId,
    batchId,
    type: 'slope_misjudgment',
    severity: trap?.type === 'discontinuity' ? 'high' : 'medium',
    description: `斜率误判：在 ${trapType} 陷阱处未减速，位置 (${position.x.toFixed(2)}, ${position.y.toFixed(2)})`,
    position: { ...position },
    timestamp: Date.now(),
    confirmed: false,
  };
};

export const createOutOfBoundsException = (
  recordId: string,
  batchId: string,
  position: Point,
  domain: [number, number]
): ExceptionRecord => {
  return {
    id: generateId('exc'),
    recordId,
    batchId,
    type: 'out_of_bounds',
    severity: 'high',
    description: `坐标越界：超出定义域 [${domain[0]}, ${domain[1]}]，实际位置 x=${position.x.toFixed(2)}`,
    position: { ...position },
    timestamp: Date.now(),
    confirmed: false,
  };
};

export const createBreakpointCrossingException = (
  recordId: string,
  batchId: string,
  position: Point,
  breakpoint: number
): ExceptionRecord => {
  return {
    id: generateId('exc'),
    recordId,
    batchId,
    type: 'breakpoint_crossing',
    severity: 'high',
    description: `断点穿越：穿越间断点 x=${breakpoint.toFixed(2)}，位置 (${position.x.toFixed(2)}, ${position.y.toFixed(2)})`,
    position: { ...position },
    timestamp: Date.now(),
    confirmed: false,
  };
};

export const getSlopeFeedback = (slope: number): { color: string; text: string; level: string } => {
  if (!isFinite(slope)) {
    return { color: '#EF4444', text: '垂直切线', level: 'danger' };
  }

  const absSlope = Math.abs(slope);

  if (absSlope < 0.5) {
    return { color: '#10B981', text: '平缓', level: 'safe' };
  } else if (absSlope < 2) {
    return { color: '#F59E0B', text: '适中', level: 'warning' };
  } else if (absSlope < 5) {
    return { color: '#F97316', text: '陡峭', level: 'caution' };
  } else {
    return { color: '#EF4444', text: '极陡', level: 'danger' };
  }
};

export const getDifferentiabilityFeedback = (
  isDifferentiable: boolean,
  point: CurvePoint
): { color: string; text: string; icon: string } => {
  if (point.isDiscontinuity) {
    return { color: '#EF4444', text: '间断点', icon: '⚠️' };
  }
  if (!isDifferentiable) {
    if (point.trap) {
      const trapMessages: Record<string, string> = {
        corner: '角点不可导',
        cusp: '尖点不可导',
        verticalTangent: '垂直切线',
        discontinuity: '间断点',
      };
      return {
        color: '#EF4444',
        text: trapMessages[point.trap.type] || '不可导',
        icon: '🚫',
      };
    }
    return { color: '#EF4444', text: '不可导', icon: '🚫' };
  }
  return { color: '#10B981', text: '可导', icon: '✓' };
};

export const getSeverityColor = (severity: Severity): string => {
  const colors: Record<Severity, string> = {
    low: '#10B981',
    medium: '#F59E0B',
    high: '#EF4444',
  };
  return colors[severity];
};

export const getExceptionTypeLabel = (type: string): string => {
  const labels: Record<string, string> = {
    out_of_bounds: '坐标越界',
    slope_misjudgment: '斜率误判',
    breakpoint_crossing: '断点穿越',
  };
  return labels[type] || type;
};

export const getTrapTypeLabel = (type: string): string => {
  const labels: Record<string, string> = {
    discontinuity: '间断点',
    corner: '角点',
    cusp: '尖点',
    verticalTangent: '垂直切线',
  };
  return labels[type] || type;
};

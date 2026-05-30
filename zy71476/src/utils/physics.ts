import {
  ExperimentParams,
  ForceAnalysis,
  ThresholdResult,
  BlockStatus,
  ConflictRecord,
  PHYSICAL_CONSTANTS,
} from '../types';

const { GRAVITY, CRITICAL_THRESHOLD } = PHYSICAL_CONSTANTS;

function degToRad(degrees: number): number {
  return degrees * (Math.PI / 180);
}

function radToDeg(radians: number): number {
  return radians * (180 / Math.PI);
}

export function calculateForces(params: ExperimentParams): ForceAnalysis {
  const { angle, mass, frictionCoefficient } = params;
  const angleRad = degToRad(angle);

  const gravity = mass * GRAVITY;
  const parallelForce = gravity * Math.sin(angleRad);
  const perpendicularForce = gravity * Math.cos(angleRad);
  const normalForce = perpendicularForce;
  const maxStaticFriction = frictionCoefficient * normalForce;
  const frictionForce = Math.min(maxStaticFriction, parallelForce);

  return {
    gravity: roundTo(gravity, 4),
    normalForce: roundTo(normalForce, 4),
    frictionForce: roundTo(frictionForce, 4),
    parallelForce: roundTo(parallelForce, 4),
    perpendicularForce: roundTo(perpendicularForce, 4),
    maxStaticFriction: roundTo(maxStaticFriction, 4),
  };
}

export function calculateCriticalAngle(frictionCoefficient: number): number {
  const criticalRad = Math.atan(frictionCoefficient);
  return roundTo(radToDeg(criticalRad), 2);
}

export function determineStatus(params: ExperimentParams): ThresholdResult {
  const { angle, frictionCoefficient } = params;
  const criticalAngle = calculateCriticalAngle(frictionCoefficient);
  const angleDiff = angle - criticalAngle;

  let status: BlockStatus;
  let reason: string;

  if (Math.abs(angleDiff) < CRITICAL_THRESHOLD) {
    status = 'critical';
    reason = `当前角度 ${angle}° 等于临界角度 ${criticalAngle}°，物块处于即将滑动的临界状态。此时沿斜面分力等于最大静摩擦力，只要角度再增大一点点，物块就会开始下滑。`;
  } else if (angleDiff > 0) {
    status = 'sliding';
    reason = `当前角度 ${angle}° 大于临界角度 ${criticalAngle}°，沿斜面的分力超过了最大静摩擦力，所以物块会沿着斜面向下滑动。摩擦系数越小，临界角度越低，越容易滑动。`;
  } else {
    status = 'static';
    reason = `当前角度 ${angle}° 小于临界角度 ${criticalAngle}°，最大静摩擦力足以抵抗沿斜面向下的分力，所以物块保持静止不动。摩擦系数越大，临界角度越高，越不容易滑动。`;
  }

  return {
    status,
    criticalAngle,
    reason,
  };
}

export function detectConflicts(
  params: ExperimentParams,
  forces: ForceAnalysis,
  threshold: ThresholdResult
): ConflictRecord | null {
  const { angle, mass, frictionCoefficient } = params;

  const anglePrediction = angle >= threshold.criticalAngle ? 'sliding' : angle === threshold.criticalAngle ? 'critical' : 'static';
  const frictionPrediction = frictionCoefficient < Math.tan(degToRad(angle)) ? 'sliding' : frictionCoefficient === Math.tan(degToRad(angle)) ? 'critical' : 'static';
  const massPrediction: BlockStatus = 'static';

  const predictions = [anglePrediction, frictionPrediction, massPrediction];
  const hasConflict = !predictions.every(p => p === predictions[0]);

  if (!hasConflict) return null;

  return {
    id: generateId(),
    timestamp: Date.now(),
    angleEvidence: {
      param: 'angle',
      value: angle,
      priority: 1,
      evidence: `角度 ${angle}° ${angle >= threshold.criticalAngle ? '≥' : '<'} 临界角 ${threshold.criticalAngle}°，预测${anglePrediction === 'sliding' ? '滑动' : anglePrediction === 'critical' ? '临界' : '静止'}`,
    },
    massEvidence: {
      param: 'mass',
      value: mass,
      priority: 3,
      evidence: `质量 ${mass}kg 不影响临界角度（临界角公式 tanθ=μ 与质量无关），但影响力的大小`,
    },
    frictionEvidence: {
      param: 'frictionCoefficient',
      value: frictionCoefficient,
      priority: 2,
      evidence: `摩擦系数 ${frictionCoefficient} 对应临界角 ${threshold.criticalAngle}°，与角度比较预测${frictionPrediction === 'sliding' ? '滑动' : frictionPrediction === 'critical' ? '临界' : '静止'}`,
    },
    resolution: `检测到参数判定冲突：角度预测${anglePrediction === 'sliding' ? '滑动' : anglePrediction === 'critical' ? '临界' : '静止'}，摩擦系数预测${frictionPrediction === 'sliding' ? '滑动' : frictionPrediction === 'critical' ? '临界' : '静止'}。根据规则，优先以角度判定为准，最终状态为${threshold.status === 'sliding' ? '滑动' : threshold.status === 'critical' ? '临界' : '静止'}。`,
    finalJudgment: threshold.status,
  };
}

export function getObjectInfo(
  type: 'plane' | 'block',
  params: ExperimentParams
): { name: string; description: string; properties: Record<string, string | number> } {
  if (type === 'plane') {
    return {
      name: '斜面',
      description: '倾斜的平面，用于研究物体在斜面上的运动规律。斜面的角度是影响物体是否滑动的关键因素之一。',
      properties: {
        '倾斜角度': `${params.angle}°`,
        '摩擦系数': params.frictionCoefficient,
        '材质': '木质表面',
        '长度': '5m',
        '临界角度': `${calculateCriticalAngle(params.frictionCoefficient)}°`,
      },
    };
  } else {
    return {
      name: '物块',
      description: '放置在斜面上的研究对象，用于观察受力和运动状态。物块的质量影响受力大小，但不影响是否滑动的临界条件。',
      properties: {
        '质量': `${params.mass} kg`,
        '重力': `${roundTo(params.mass * GRAVITY, 2)} N`,
        '材质': '金属块',
        '体积': '0.001 m³',
        '状态': '待计算',
      },
    };
  }
}

export function formatForceValue(value: number): string {
  return roundTo(value, 2).toString();
}

function roundTo(value: number, decimals: number): number {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

export function calculateBlockPosition(
  status: BlockStatus,
  time: number,
  params: ExperimentParams,
  forces: ForceAnalysis
): number {
  if (status !== 'sliding') return 0;

  const { mass } = params;
  const netForce = forces.parallelForce - forces.maxStaticFriction * 0.8;
  const acceleration = netForce / mass;
  const position = 0.5 * acceleration * time * time;

  return Math.min(position, 3);
}

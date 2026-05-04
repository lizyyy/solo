import { g, PI } from '../constants';
import { getParamValue, formatValue } from '../units';
import {
  PhysicsParameter,
  PhysicsSolution,
  Equation,
  DerivationStep,
  SubstitutionStep,
  CalculationResult,
  TrajectoryPoint,
  KeyQuantity,
  DiagramInfo,
  FinalAnswer,
  ValidationResult,
} from '../../../../shared/types';

export interface InclineParams {
  mass: number;
  angle: number;
  frictionCoeff: number;
  hasFriction: boolean;
  initialVelocity: number;
  slideLength: number;
}

export const inclineValidParams = [
  { name: 'mass', min: 0.001, positive: true },
  { name: 'angle', min: 0, max: 90 },
  { name: 'frictionCoeff', min: 0, max: 10, positive: false, required: false },
  { name: 'hasFriction', positive: false, required: false },
  { name: 'initialVelocity', positive: false, required: false },
  { name: 'slideLength', min: 0.01, positive: true },
];

export function solveIncline(
  problemId: string,
  params: PhysicsParameter[],
  normalizedParams: PhysicsParameter[]
): PhysicsSolution {
  const mass = getParamValue(normalizedParams, 'mass');
  const angle = getParamValue(normalizedParams, 'angle');
  const angleRad = (angle * PI) / 180;
  const hasFrictionParam = normalizedParams.find(p => p.name === 'hasFriction');
  const hasFriction = hasFrictionParam ? hasFrictionParam.value > 0 : true;
  const frictionCoeffParam = normalizedParams.find(p => p.name === 'frictionCoeff');
  const frictionCoeff = frictionCoeffParam ? frictionCoeffParam.value : 0;
  const initialVelocityParam = normalizedParams.find(p => p.name === 'initialVelocity');
  const v0 = initialVelocityParam ? getParamValue(normalizedParams, 'initialVelocity') : 0;
  const slideLength = getParamValue(normalizedParams, 'slideLength');

  const sinTheta = Math.sin(angleRad);
  const cosTheta = Math.cos(angleRad);

  const weight = mass * g;
  const normalForce = mass * g * cosTheta;
  const frictionForce = hasFriction ? frictionCoeff * normalForce : 0;
  const componentParallel = mass * g * sinTheta;
  const netForce = componentParallel - frictionForce;
  const acceleration = netForce / mass;

  const vfSquared = v0 * v0 + 2 * acceleration * slideLength;
  const vf = vfSquared > 0 ? Math.sqrt(vfSquared) : 0;

  let time: number;
  if (Math.abs(acceleration) < 0.0001) {
    if (Math.abs(v0) < 0.0001) {
      time = Infinity;
    } else {
      time = slideLength / v0;
    }
  } else {
    const discriminant = v0 * v0 + 2 * acceleration * slideLength;
    if (discriminant < 0) {
      time = Infinity;
    } else {
      time = (-v0 + Math.sqrt(discriminant)) / acceleration;
    }
  }

  const trajectory = generateTrajectory(v0, acceleration, slideLength, angleRad);

  const equations: Equation[] = [
    {
      id: 'eq1',
      latex: 'F_{net} = ma',
      description: '牛顿第二定律',
      type: 'principle',
    },
    {
      id: 'eq2',
      latex: 'F_g = mg',
      description: '重力公式',
      type: 'definition',
    },
    {
      id: 'eq3',
      latex: 'F_{parallel} = mg \\sin\\theta',
      description: '重力沿斜面的分力',
      type: 'derived',
    },
    {
      id: 'eq4',
      latex: 'F_{perpendicular} = mg \\cos\\theta',
      description: '重力垂直斜面的分力',
      type: 'derived',
    },
    {
      id: 'eq5',
      latex: 'F_f = \\mu F_N',
      description: '滑动摩擦力公式',
      type: 'definition',
    },
    {
      id: 'eq6',
      latex: 'v_f^2 = v_0^2 + 2as',
      description: '匀变速直线运动公式',
      type: 'derived',
    },
    {
      id: 'eq7',
      latex: 's = v_0 t + \\frac{1}{2} a t^2',
      description: '位移公式',
      type: 'derived',
    },
  ];

  const derivations: DerivationStep[] = [
    {
      step: 1,
      equation: 'F_{net} = F_{parallel} - F_f',
      latex: 'F_{net} = F_{parallel} - F_f',
      explanation: '沿斜面方向的合力等于重力分力减去摩擦力',
      rule: '力的合成',
    },
    {
      step: 2,
      equation: `F_{parallel} = mg sin(${angle}°)`,
      latex: `F_{parallel} = mg \\sin${angle}^\\circ`,
      explanation: '重力沿斜面方向的分力',
      rule: '力的分解',
    },
    {
      step: 3,
      equation: `F_N = mg cos(${angle}°)`,
      latex: `F_N = mg \\cos${angle}^\\circ`,
      explanation: '支持力等于重力垂直斜面的分力',
      rule: '力的平衡',
    },
    {
      step: 4,
      equation: hasFriction ? `F_f = ${frictionCoeff} * F_N` : 'F_f = 0 (无摩擦)',
      latex: hasFriction ? `F_f = \\mu F_N = ${frictionCoeff} F_N` : 'F_f = 0',
      explanation: hasFriction ? '滑动摩擦力等于摩擦系数乘以支持力' : '忽略摩擦力',
      rule: '滑动摩擦公式',
    },
    {
      step: 5,
      equation: 'a = F_net / m',
      latex: 'a = \\frac{F_{net}}{m}',
      explanation: '根据牛顿第二定律计算加速度',
      rule: 'F = ma',
    },
    {
      step: 6,
      equation: 'v_f^2 = v_0^2 + 2as',
      latex: 'v_f^2 = v_0^2 + 2as',
      explanation: '使用匀变速直线运动公式计算末速度',
      rule: '运动学公式',
    },
    {
      step: 7,
      equation: 's = v_0 t + 1/2 a t^2',
      latex: 's = v_0 t + \\frac{1}{2} a t^2',
      explanation: '解二次方程求运动时间',
      rule: '运动学公式',
    },
  ];

  const substitutions: SubstitutionStep[] = [
    {
      step: 1,
      equation: `F_g = ${mass} kg * ${g} m/s²`,
      latex: `F_g = ${mass} \\cdot ${g}`,
      values: { m: mass, g: g },
      explanation: '计算重力',
    },
    {
      step: 2,
      equation: `F_{parallel} = ${mass} * ${g} * sin(${angle}°) = ${formatValue(componentParallel)} N`,
      latex: `F_{\\parallel} = ${mass} \\cdot ${g} \\cdot \\sin${angle}^\\circ = ${formatValue(componentParallel)} \\text{ N}`,
      values: { m: mass, g: g, theta: angleRad },
      explanation: '计算重力沿斜面的分力',
    },
    {
      step: 3,
      equation: `F_N = ${mass} * ${g} * cos(${angle}°) = ${formatValue(normalForce)} N`,
      latex: `F_N = ${mass} \\cdot ${g} \\cdot \\cos${angle}^\\circ = ${formatValue(normalForce)} \\text{ N}`,
      values: { m: mass, g: g, theta: angleRad },
      explanation: '计算支持力',
    },
    ...(hasFriction ? [{
      step: 4,
      equation: `F_f = ${frictionCoeff} * ${formatValue(normalForce)} = ${formatValue(frictionForce)} N`,
      latex: `F_f = ${frictionCoeff} \\cdot ${formatValue(normalForce)} = ${formatValue(frictionForce)} \\text{ N}`,
      values: { mu: frictionCoeff, F_N: normalForce },
      explanation: '计算滑动摩擦力',
    }] : []),
    {
      step: hasFriction ? 5 : 4,
      equation: `F_{net} = ${formatValue(componentParallel)} - ${formatValue(frictionForce)} = ${formatValue(netForce)} N`,
      latex: `F_{net} = ${formatValue(componentParallel)} - ${formatValue(frictionForce)} = ${formatValue(netForce)} \\text{ N}`,
      values: { F_parallel: componentParallel, F_f: frictionForce },
      explanation: '计算沿斜面方向的合力',
    },
    {
      step: hasFriction ? 6 : 5,
      equation: `a = ${formatValue(netForce)} / ${mass} = ${formatValue(acceleration)} m/s²`,
      latex: `a = \\frac{${formatValue(netForce)}}{${mass}} = ${formatValue(acceleration)} \\text{ m/s}^2`,
      values: { F_net: netForce, m: mass },
      explanation: '计算加速度',
    },
    {
      step: hasFriction ? 7 : 6,
      equation: `v_f^2 = ${v0}^2 + 2 * ${formatValue(acceleration)} * ${slideLength}`,
      latex: `v_f^2 = ${v0}^2 + 2 \\cdot ${formatValue(acceleration)} \\cdot ${slideLength}`,
      values: { v0: v0, a: acceleration, s: slideLength },
      explanation: '代入数值计算末速度的平方',
    },
    {
      step: hasFriction ? 8 : 7,
      equation: `v_f = ${formatValue(vf)} m/s`,
      latex: `v_f = ${formatValue(vf)} \\text{ m/s}`,
      values: { vf: vf },
      explanation: '计算末速度',
    },
  ];

  const results: CalculationResult[] = [
    { name: 'weight', label: '重力', value: weight, unit: 'N', description: '物体所受重力' },
    { name: 'normalForce', label: '支持力', value: normalForce, unit: 'N', description: '斜面对物体的支持力' },
    { name: 'frictionForce', label: '摩擦力', value: frictionForce, unit: 'N', description: '滑动摩擦力' },
    { name: 'componentParallel', label: '重力分力(平行)', value: componentParallel, unit: 'N', description: '重力沿斜面方向的分力' },
    { name: 'netForce', label: '合力', value: netForce, unit: 'N', description: '沿斜面方向的合力' },
    { name: 'acceleration', label: '加速度', value: acceleration, unit: 'm/s²', description: '沿斜面方向的加速度' },
    { name: 'finalVelocity', label: '末速度', value: vf, unit: 'm/s', description: '滑到斜面底端的速度' },
    { name: 'time', label: '运动时间', value: time, unit: 's', description: '下滑总时间' },
  ];

  const keyQuantities: KeyQuantity[] = [
    { name: 'maxVelocity', label: '最大速度', value: vf, unit: 'm/s', phase: '底端' },
    { name: 'maxAcceleration', label: '加速度', value: acceleration, unit: 'm/s²', phase: '全程' },
    { name: 'totalTime', label: '总时间', value: time, unit: 's', phase: '全程' },
    { name: 'totalDistance', label: '滑行距离', value: slideLength, unit: 'm', phase: '全程' },
  ];

  const diagrams: DiagramInfo[] = [
    { type: 'force', description: '受力分析图：重力、支持力、摩擦力' },
    { type: 'coordinate', description: '坐标系：沿斜面为x轴，垂直斜面为y轴' },
    { type: 'trajectory', description: '速度-时间图和位移-时间图' },
  ];

  const finalAnswers: FinalAnswer[] = [
    { label: '加速度', value: acceleration, unit: 'm/s²', latex: `a = ${formatValue(acceleration)} \\text{ m/s}^2` },
    { label: '末速度', value: vf, unit: 'm/s', latex: `v_f = ${formatValue(vf)} \\text{ m/s}` },
    { label: '运动时间', value: time, unit: 's', latex: `t = ${formatValue(time)} \\text{ s}` },
  ];

  return {
    problemId,
    problemType: 'incline',
    parameters: normalizedParams,
    equations,
    derivations,
    substitutions,
    results,
    trajectory,
    keyQuantities,
    diagrams,
    finalAnswers,
  };
}

function generateTrajectory(
  v0: number,
  a: number,
  s: number,
  angleRad: number
): TrajectoryPoint[] {
  const points: TrajectoryPoint[] = [];
  
  let totalTime: number;
  if (Math.abs(a) < 0.0001) {
    if (Math.abs(v0) < 0.0001) {
      totalTime = 10;
    } else {
      totalTime = s / v0;
    }
  } else {
    const discriminant = v0 * v0 + 2 * a * s;
    if (discriminant < 0) {
      totalTime = 10;
    } else {
      totalTime = (-v0 + Math.sqrt(discriminant)) / a;
    }
  }

  if (!isFinite(totalTime) || totalTime <= 0) {
    totalTime = 10;
  }

  const numPoints = 100;
  const dt = totalTime / numPoints;

  for (let i = 0; i <= numPoints; i++) {
    const t = i * dt;
    const distance = v0 * t + 0.5 * a * t * t;
    const v = v0 + a * t;

    const clampedDistance = Math.min(distance, s);
    const x = clampedDistance * Math.cos(angleRad);
    const y = clampedDistance * Math.sin(angleRad);
    const vx = v * Math.cos(angleRad);
    const vy = v * Math.sin(angleRad);

    points.push({
      time: t,
      x,
      y,
      vx,
      vy,
      ax: a * Math.cos(angleRad),
      ay: a * Math.sin(angleRad),
      velocity: v,
      acceleration: a,
    });

    if (distance >= s) {
      break;
    }
  }

  return points;
}

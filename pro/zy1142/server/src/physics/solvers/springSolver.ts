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
} from '../../../../shared/types';

export const springValidParams = [
  { name: 'mass', min: 0.001, positive: true },
  { name: 'springConstant', min: 0.01, positive: true },
  { name: 'amplitude', min: 0, positive: false, required: false },
  { name: 'initialDisplacement', min: undefined, max: undefined, positive: false, required: false },
  { name: 'initialVelocity', min: undefined, max: undefined, positive: false, required: false },
  { name: 'dampingCoeff', min: 0, max: 10, positive: false, required: false },
  { name: 'hasDamping', positive: false, required: false },
];

export function solveSpring(
  problemId: string,
  params: PhysicsParameter[],
  normalizedParams: PhysicsParameter[]
): PhysicsSolution {
  const mass = getParamValue(normalizedParams, 'mass');
  const k = getParamValue(normalizedParams, 'springConstant');
  
  const amplitudeParam = normalizedParams.find(p => p.name === 'amplitude');
  const initialDisplacementParam = normalizedParams.find(p => p.name === 'initialDisplacement');
  const initialVelocityParam = normalizedParams.find(p => p.name === 'initialVelocity');
  const dampingCoeffParam = normalizedParams.find(p => p.name === 'dampingCoeff');
  const hasDampingParam = normalizedParams.find(p => p.name === 'hasDamping');
  
  const x0 = initialDisplacementParam ? getParamValue(normalizedParams, 'initialDisplacement') : 0;
  const v0 = initialVelocityParam ? getParamValue(normalizedParams, 'initialVelocity') : 0;
  const hasDamping = hasDampingParam ? hasDampingParam.value > 0 : false;
  const b = dampingCoeffParam ? dampingCoeffParam.value : 0;

  let amplitude: number;
  if (amplitudeParam !== undefined) {
    amplitude = getParamValue(normalizedParams, 'amplitude');
  } else {
    const omega0 = Math.sqrt(k / mass);
    if (Math.abs(v0) < 0.0001) {
      amplitude = Math.abs(x0);
    } else if (Math.abs(x0) < 0.0001) {
      amplitude = Math.abs(v0 / omega0);
    } else {
      amplitude = Math.sqrt(x0 * x0 + (v0 / omega0) * (v0 / omega0));
    }
  }

  const omega0 = Math.sqrt(k / mass);
  const T0 = (2 * PI) / omega0;
  const f0 = 1 / T0;

  const maxVelocity = omega0 * amplitude;
  const maxAcceleration = omega0 * omega0 * amplitude;
  const maxForce = k * amplitude;
  const maxPotentialEnergy = 0.5 * k * amplitude * amplitude;
  const maxKineticEnergy = 0.5 * mass * maxVelocity * maxVelocity;
  const totalEnergy = maxPotentialEnergy;

  let phase: number;
  if (Math.abs(v0) < 0.0001) {
    phase = x0 >= 0 ? 0 : PI;
  } else if (Math.abs(x0) < 0.0001) {
    phase = v0 > 0 ? -PI / 2 : PI / 2;
  } else {
    phase = Math.atan2(-v0 / omega0, x0);
  }

  const trajectory = generateTrajectory(
    mass,
    k,
    amplitude,
    x0,
    v0,
    phase,
    omega0,
    hasDamping,
    b,
    T0 * 3
  );

  const equations: Equation[] = [
    {
      id: 'eq1',
      latex: 'F = -kx',
      description: '胡克定律',
      type: 'principle',
    },
    {
      id: 'eq2',
      latex: 'm \\ddot{x} + kx = 0',
      description: '简谐运动微分方程（无阻尼）',
      type: 'principle',
    },
    {
      id: 'eq3',
      latex: 'x(t) = A \\cos(\\omega t + \\phi)',
      description: '简谐运动位移公式',
      type: 'derived',
    },
    {
      id: 'eq4',
      latex: 'v(t) = -A \\omega \\sin(\\omega t + \\phi)',
      description: '简谐运动速度公式',
      type: 'derived',
    },
    {
      id: 'eq5',
      latex: 'a(t) = -A \\omega^2 \\cos(\\omega t + \\phi)',
      description: '简谐运动加速度公式',
      type: 'derived',
    },
    {
      id: 'eq6',
      latex: '\\omega = \\sqrt{\\frac{k}{m}}',
      description: '角频率公式',
      type: 'definition',
    },
    {
      id: 'eq7',
      latex: 'T = \\frac{2\\pi}{\\omega} = 2\\pi \\sqrt{\\frac{m}{k}}',
      description: '周期公式',
      type: 'derived',
    },
    {
      id: 'eq8',
      latex: 'E = \\frac{1}{2} k A^2',
      description: '系统总机械能（无阻尼）',
      type: 'derived',
    },
    {
      id: 'eq9',
      latex: 'U = \\frac{1}{2} k x^2',
      description: '弹性势能',
      type: 'definition',
    },
    {
      id: 'eq10',
      latex: 'K = \\frac{1}{2} m v^2',
      description: '动能',
      type: 'definition',
    },
  ];

  const derivations: DerivationStep[] = [
    {
      step: 1,
      equation: 'F = -kx',
      latex: 'F = -kx',
      explanation: '根据胡克定律，弹簧弹力与位移成正比，方向相反',
      rule: '胡克定律',
    },
    {
      step: 2,
      equation: 'F = ma = m * d²x/dt²',
      latex: 'F = ma = m \\ddot{x}',
      explanation: '根据牛顿第二定律',
      rule: 'F = ma',
    },
    {
      step: 3,
      equation: 'm * d²x/dt² + kx = 0',
      latex: 'm \\ddot{x} + kx = 0',
      explanation: '联立得到简谐运动微分方程',
      rule: '联立方程',
    },
    {
      step: 4,
      equation: 'ω = sqrt(k/m)',
      latex: '\\omega = \\sqrt{\\frac{k}{m}}',
      explanation: '定义角频率',
      rule: '定义',
    },
    {
      step: 5,
      equation: 'x(t) = A cos(ωt + φ)',
      latex: 'x(t) = A \\cos(\\omega t + \\phi)',
      explanation: '微分方程的解，A为振幅，φ为初相位',
      rule: '微分方程求解',
    },
    {
      step: 6,
      equation: 'v(t) = dx/dt = -Aω sin(ωt + φ)',
      latex: 'v(t) = -A\\omega \\sin(\\omega t + \\phi)',
      explanation: '对位移求导得到速度',
      rule: '导数',
    },
    {
      step: 7,
      equation: 'a(t) = dv/dt = -Aω² cos(ωt + φ)',
      latex: 'a(t) = -A\\omega^2 \\cos(\\omega t + \\phi)',
      explanation: '对速度求导得到加速度',
      rule: '导数',
    },
    {
      step: 8,
      equation: 'T = 2π/ω = 2π * sqrt(m/k)',
      latex: 'T = \\frac{2\\pi}{\\omega} = 2\\pi \\sqrt{\\frac{m}{k}}',
      explanation: '计算运动周期',
      rule: '周期与角频率关系',
    },
    {
      step: 9,
      equation: 'E = U + K = 1/2 kx² + 1/2 mv² = 1/2 kA²',
      latex: 'E = \\frac{1}{2} k x^2 + \\frac{1}{2} m v^2 = \\frac{1}{2} k A^2',
      explanation: '系统总机械能守恒（无阻尼）',
      rule: '能量守恒',
    },
  ];

  const substitutions: SubstitutionStep[] = [
    {
      step: 1,
      equation: `ω = sqrt(${k} / ${mass}) = ${formatValue(omega0)} rad/s`,
      latex: `\\omega = \\sqrt{\\frac{${k}}{${mass}}} = ${formatValue(omega0)} \\text{ rad/s}`,
      values: { k: k, m: mass },
      explanation: '计算角频率',
    },
    {
      step: 2,
      equation: `T = 2π / ${formatValue(omega0)} = ${formatValue(T0)} s`,
      latex: `T = \\frac{2\\pi}{${formatValue(omega0)}} = ${formatValue(T0)} \\text{ s}`,
      values: { omega: omega0 },
      explanation: '计算周期',
    },
    {
      step: 3,
      equation: `f = 1 / ${formatValue(T0)} = ${formatValue(f0)} Hz`,
      latex: `f = \\frac{1}{${formatValue(T0)}} = ${formatValue(f0)} \\text{ Hz}`,
      values: { T: T0 },
      explanation: '计算频率',
    },
    {
      step: 4,
      equation: `v_max = ${formatValue(omega0)} * ${amplitude} = ${formatValue(maxVelocity)} m/s`,
      latex: `v_{max} = ${formatValue(omega0)} \\cdot ${amplitude} = ${formatValue(maxVelocity)} \\text{ m/s}`,
      values: { omega: omega0, A: amplitude },
      explanation: '计算最大速度',
    },
    {
      step: 5,
      equation: `a_max = (${formatValue(omega0)})² * ${amplitude} = ${formatValue(maxAcceleration)} m/s²`,
      latex: `a_{max} = (${formatValue(omega0)})^2 \\cdot ${amplitude} = ${formatValue(maxAcceleration)} \\text{ m/s}^2`,
      values: { omega: omega0, A: amplitude },
      explanation: '计算最大加速度',
    },
    {
      step: 6,
      equation: `F_max = ${k} * ${amplitude} = ${formatValue(maxForce)} N`,
      latex: `F_{max} = ${k} \\cdot ${amplitude} = ${formatValue(maxForce)} \\text{ N}`,
      values: { k: k, A: amplitude },
      explanation: '计算最大弹力',
    },
    {
      step: 7,
      equation: `E_total = 1/2 * ${k} * (${amplitude})² = ${formatValue(totalEnergy)} J`,
      latex: `E_{total} = \\frac{1}{2} \\cdot ${k} \\cdot (${amplitude})^2 = ${formatValue(totalEnergy)} \\text{ J}`,
      values: { k: k, A: amplitude },
      explanation: '计算系统总机械能',
    },
  ];

  const results: CalculationResult[] = [
    { name: 'angularFrequency', label: '角频率', value: omega0, unit: 'rad/s', description: '简谐运动的角频率' },
    { name: 'period', label: '周期', value: T0, unit: 's', description: '完成一次完整振动的时间' },
    { name: 'frequency', label: '频率', value: f0, unit: 'Hz', description: '单位时间内的振动次数' },
    { name: 'amplitude', label: '振幅', value: amplitude, unit: 'm', description: '最大位移' },
    { name: 'maxVelocity', label: '最大速度', value: maxVelocity, unit: 'm/s', description: '平衡位置时的速度' },
    { name: 'maxAcceleration', label: '最大加速度', value: maxAcceleration, unit: 'm/s²', description: '最大位移时的加速度' },
    { name: 'maxForce', label: '最大弹力', value: maxForce, unit: 'N', description: '最大位移时的弹力' },
    { name: 'maxPotentialEnergy', label: '最大弹性势能', value: maxPotentialEnergy, unit: 'J', description: '最大位移时的弹性势能' },
    { name: 'maxKineticEnergy', label: '最大动能', value: maxKineticEnergy, unit: 'J', description: '平衡位置时的动能' },
    { name: 'totalEnergy', label: '总机械能', value: totalEnergy, unit: 'J', description: '系统总机械能（守恒）' },
    { name: 'phase', label: '初相位', value: phase, unit: 'rad', description: '振动的初相位' },
  ];

  const keyQuantities: KeyQuantity[] = [
    { name: 'amplitude', label: '振幅', value: amplitude, unit: 'm', phase: '最大位移' },
    { name: 'period', label: '周期', value: T0, unit: 's', phase: '全程' },
    { name: 'maxVelocity', label: '最大速度', value: maxVelocity, unit: 'm/s', phase: '平衡位置' },
    { name: 'totalEnergy', label: '总机械能', value: totalEnergy, unit: 'J', phase: '全程' },
  ];

  const diagrams: DiagramInfo[] = [
    { type: 'spring', description: '弹簧振子示意图：弹簧、振子、平衡位置' },
    { type: 'coordinate', description: '坐标系：以平衡位置为原点，向右为正方向' },
    { type: 'force', description: '受力分析：弹簧弹力 F = -kx' },
    { type: 'trajectory', description: '位移-时间图、速度-时间图、加速度-时间图' },
  ];

  const finalAnswers: FinalAnswer[] = [
    { label: '角频率', value: omega0, unit: 'rad/s', latex: `\\omega = ${formatValue(omega0)} \\text{ rad/s}` },
    { label: '周期', value: T0, unit: 's', latex: `T = ${formatValue(T0)} \\text{ s}` },
    { label: '频率', value: f0, unit: 'Hz', latex: `f = ${formatValue(f0)} \\text{ Hz}` },
    { label: '最大速度', value: maxVelocity, unit: 'm/s', latex: `v_{max} = ${formatValue(maxVelocity)} \\text{ m/s}` },
    { label: '总机械能', value: totalEnergy, unit: 'J', latex: `E = ${formatValue(totalEnergy)} \\text{ J}` },
  ];

  return {
    problemId,
    problemType: 'spring',
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
  mass: number,
  k: number,
  amplitude: number,
  x0: number,
  v0: number,
  phase: number,
  omega0: number,
  hasDamping: boolean,
  b: number,
  totalTime: number
): TrajectoryPoint[] {
  const points: TrajectoryPoint[] = [];
  const numPoints = 200;
  const dt = totalTime / numPoints;

  for (let i = 0; i <= numPoints; i++) {
    const t = i * dt;
    let x: number;
    let v: number;
    let a: number;
    let dampingFactor = 1;

    if (hasDamping && b > 0) {
      const gamma = b / (2 * mass);
      const omegaDamped = Math.sqrt(omega0 * omega0 - gamma * gamma);
      
      if (Math.abs(omega0 - gamma) < 0.0001) {
        dampingFactor = Math.exp(-gamma * t);
        x = (x0 + (v0 + gamma * x0) * t) * dampingFactor;
        v = ((v0 + gamma * x0) - gamma * (x0 + (v0 + gamma * x0) * t)) * dampingFactor;
      } else if (gamma > omega0) {
        const s1 = -gamma + Math.sqrt(gamma * gamma - omega0 * omega0);
        const s2 = -gamma - Math.sqrt(gamma * gamma - omega0 * omega0);
        const c1 = (v0 - s2 * x0) / (s1 - s2);
        const c2 = (s1 * x0 - v0) / (s1 - s2);
        x = c1 * Math.exp(s1 * t) + c2 * Math.exp(s2 * t);
        v = c1 * s1 * Math.exp(s1 * t) + c2 * s2 * Math.exp(s2 * t);
        dampingFactor = Math.exp(-gamma * t);
      } else {
        dampingFactor = Math.exp(-gamma * t);
        x = amplitude * dampingFactor * Math.cos(omegaDamped * t + phase);
        v = -amplitude * dampingFactor * (gamma * Math.cos(omegaDamped * t + phase) + omegaDamped * Math.sin(omegaDamped * t + phase));
      }
    } else {
      x = amplitude * Math.cos(omega0 * t + phase);
      v = -amplitude * omega0 * Math.sin(omega0 * t + phase);
    }

    a = -(k / mass) * x;
    const extension = x;

    points.push({
      time: t,
      x,
      y: 0,
      vx: v,
      vy: 0,
      ax: a,
      ay: 0,
      extension,
      velocity: v,
      acceleration: a,
    });
  }

  return points;
}

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

export const projectileValidParams = [
  { name: 'initialVelocity', min: 0.01, positive: true },
  { name: 'angle', min: 0, max: 90 },
  { name: 'initialHeight', min: 0, positive: false, required: false },
  { name: 'initialX', min: 0, positive: false, required: false },
  { name: 'initialY', min: 0, positive: false, required: false },
];

export function solveProjectile(
  problemId: string,
  params: PhysicsParameter[],
  normalizedParams: PhysicsParameter[]
): PhysicsSolution {
  const v0 = getParamValue(normalizedParams, 'initialVelocity');
  const angle = getParamValue(normalizedParams, 'angle');
  const angleRad = (angle * PI) / 180;
  
  const initialHeightParam = normalizedParams.find(p => p.name === 'initialHeight');
  const h0 = initialHeightParam ? getParamValue(normalizedParams, 'initialHeight') : 0;
  
  const initialXParam = normalizedParams.find(p => p.name === 'initialX');
  const x0 = initialXParam ? getParamValue(normalizedParams, 'initialX') : 0;
  
  const v0x = v0 * Math.cos(angleRad);
  const v0y = v0 * Math.sin(angleRad);

  const tUp = v0y / g;
  const hMax = h0 + v0y * tUp - 0.5 * g * tUp * tUp;

  const discriminant = v0y * v0y + 2 * g * h0;
  const tFall = (v0y + Math.sqrt(discriminant)) / g;
  const totalTime = tFall;

  const xRange = x0 + v0x * totalTime;
  const vyLanding = v0y - g * totalTime;
  const vLanding = Math.sqrt(v0x * v0x + vyLanding * vyLanding);
  const landingAngle = Math.atan2(vyLanding, v0x) * (180 / PI);

  const trajectory = generateTrajectory(v0x, v0y, x0, h0, totalTime);

  const equations: Equation[] = [
    {
      id: 'eq1',
      latex: 'v_x = v_0 \\cos\\theta',
      description: '水平方向初速度分量',
      type: 'derived',
    },
    {
      id: 'eq2',
      latex: 'v_y = v_0 \\sin\\theta',
      description: '竖直方向初速度分量',
      type: 'derived',
    },
    {
      id: 'eq3',
      latex: 'x(t) = x_0 + v_x t',
      description: '水平方向位移公式（匀速）',
      type: 'derived',
    },
    {
      id: 'eq4',
      latex: 'y(t) = y_0 + v_y t - \\frac{1}{2} g t^2',
      description: '竖直方向位移公式（匀减速）',
      type: 'derived',
    },
    {
      id: 'eq5',
      latex: 'v_y(t) = v_{0y} - g t',
      description: '竖直方向速度公式',
      type: 'derived',
    },
    {
      id: 'eq6',
      latex: 'H_{max} = y_0 + \\frac{v_{0y}^2}{2g}',
      description: '最大高度公式',
      type: 'derived',
    },
    {
      id: 'eq7',
      latex: 'R = \\frac{v_0^2 \\sin2\\theta}{g} \\quad (当 y_0=0 时)',
      description: '射程公式（初末高度相同）',
      type: 'derived',
    },
  ];

  const derivations: DerivationStep[] = [
    {
      step: 1,
      equation: `v_0x = v_0 cos(${angle}°)`,
      latex: `v_{0x} = v_0 \\cos${angle}^\\circ`,
      explanation: '将初速度分解为水平分量',
      rule: '矢量分解',
    },
    {
      step: 2,
      equation: `v_0y = v_0 sin(${angle}°)`,
      latex: `v_{0y} = v_0 \\sin${angle}^\\circ`,
      explanation: '将初速度分解为竖直分量',
      rule: '矢量分解',
    },
    {
      step: 3,
      equation: 'x(t) = x0 + v0x * t',
      latex: 'x(t) = x_0 + v_{0x} t',
      explanation: '水平方向匀速运动（忽略空气阻力）',
      rule: '匀速直线运动',
    },
    {
      step: 4,
      equation: 'y(t) = h0 + v0y * t - 1/2 * g * t²',
      latex: 'y(t) = h_0 + v_{0y} t - \\frac{1}{2} g t^2',
      explanation: '竖直方向匀变速运动（受重力加速度影响）',
      rule: '匀变速直线运动',
    },
    {
      step: 5,
      equation: 'v_y(t) = v0y - g * t',
      latex: 'v_y(t) = v_{0y} - g t',
      explanation: '竖直方向速度随时间变化',
      rule: '匀变速直线运动',
    },
    {
      step: 6,
      equation: '到达最高点时：v_y = 0',
      latex: 'v_y = 0 \\quad (最高点)',
      explanation: '在最高点竖直方向速度为0',
      rule: '运动学特征',
    },
    {
      step: 7,
      equation: 't_up = v0y / g',
      latex: 't_{up} = \\frac{v_{0y}}{g}',
      explanation: '计算上升到最高点的时间',
      rule: '速度公式变形',
    },
    {
      step: 8,
      equation: 'H_max = h0 + v0y * t_up - 1/2 * g * t_up²',
      latex: 'H_{max} = h_0 + v_{0y} t_{up} - \\frac{1}{2} g t_{up}^2',
      explanation: '计算最大高度',
      rule: '位移公式',
    },
    {
      step: 9,
      equation: '落地时：y(t) = 0',
      latex: 'y(t) = 0 \\quad (落地)',
      explanation: '落地时竖直位移为0（相对地面）',
      rule: '边界条件',
    },
    {
      step: 10,
      equation: '解方程：h0 + v0y * t - 1/2 * g * t² = 0',
      latex: 'h_0 + v_{0y} t - \\frac{1}{2} g t^2 = 0',
      explanation: '解二次方程求落地时间',
      rule: '一元二次方程',
    },
  ];

  const substitutions: SubstitutionStep[] = [
    {
      step: 1,
      equation: `v_0x = ${formatValue(v0)} * cos(${angle}°) = ${formatValue(v0x)} m/s`,
      latex: `v_{0x} = ${formatValue(v0)} \\cdot \\cos${angle}^\\circ = ${formatValue(v0x)} \\text{ m/s}`,
      values: { v0: v0, theta: angleRad },
      explanation: '计算水平方向初速度分量',
    },
    {
      step: 2,
      equation: `v_0y = ${formatValue(v0)} * sin(${angle}°) = ${formatValue(v0y)} m/s`,
      latex: `v_{0y} = ${formatValue(v0)} \\cdot \\sin${angle}^\\circ = ${formatValue(v0y)} \\text{ m/s}`,
      values: { v0: v0, theta: angleRad },
      explanation: '计算竖直方向初速度分量',
    },
    {
      step: 3,
      equation: `t_up = ${formatValue(v0y)} / ${g} = ${formatValue(tUp)} s`,
      latex: `t_{up} = \\frac{${formatValue(v0y)}}{${g}} = ${formatValue(tUp)} \\text{ s}`,
      values: { v0y: v0y, g: g },
      explanation: '计算上升到最高点的时间',
    },
    {
      step: 4,
      equation: `H_max = ${h0} + ${formatValue(v0y)} * ${formatValue(tUp)} - 0.5 * ${g} * (${formatValue(tUp)})² = ${formatValue(hMax)} m`,
      latex: `H_{max} = ${h0} + ${formatValue(v0y)} \\cdot ${formatValue(tUp)} - 0.5 \\cdot ${g} \\cdot (${formatValue(tUp)})^2 = ${formatValue(hMax)} \\text{ m}`,
      values: { h0: h0, v0y: v0y, tUp: tUp, g: g },
      explanation: '计算最大高度',
    },
    {
      step: 5,
      equation: `总时间 t = ${formatValue(totalTime)} s`,
      latex: `t = ${formatValue(totalTime)} \\text{ s}`,
      values: { t: totalTime },
      explanation: '计算总飞行时间',
    },
    {
      step: 6,
      equation: `射程 R = ${formatValue(v0x)} * ${formatValue(totalTime)} = ${formatValue(xRange)} m`,
      latex: `R = ${formatValue(v0x)} \\cdot ${formatValue(totalTime)} = ${formatValue(xRange)} \\text{ m}`,
      values: { v0x: v0x, t: totalTime },
      explanation: '计算水平射程',
    },
    {
      step: 7,
      equation: `落地时竖直速度 v_y = ${formatValue(v0y)} - ${g} * ${formatValue(totalTime)} = ${formatValue(vyLanding)} m/s`,
      latex: `v_y = ${formatValue(v0y)} - ${g} \\cdot ${formatValue(totalTime)} = ${formatValue(vyLanding)} \\text{ m/s}`,
      values: { v0y: v0y, g: g, t: totalTime },
      explanation: '计算落地时竖直方向速度',
    },
    {
      step: 8,
      equation: `落地速率 v = sqrt((${formatValue(v0x)})² + (${formatValue(vyLanding)})²) = ${formatValue(vLanding)} m/s`,
      latex: `v = \\sqrt{(${formatValue(v0x)})^2 + (${formatValue(vyLanding)})^2} = ${formatValue(vLanding)} \\text{ m/s}`,
      values: { v0x: v0x, vyLanding: vyLanding },
      explanation: '计算落地时的速率',
    },
  ];

  const results: CalculationResult[] = [
    { name: 'v0x', label: '水平初速度', value: v0x, unit: 'm/s', description: '水平方向初速度分量' },
    { name: 'v0y', label: '竖直初速度', value: v0y, unit: 'm/s', description: '竖直方向初速度分量' },
    { name: 'tUp', label: '上升时间', value: tUp, unit: 's', description: '上升到最高点的时间' },
    { name: 'hMax', label: '最大高度', value: hMax, unit: 'm', description: '抛体运动的最大高度' },
    { name: 'totalTime', label: '总飞行时间', value: totalTime, unit: 's', description: '从发射到落地的总时间' },
    { name: 'xRange', label: '射程', value: xRange, unit: 'm', description: '水平方向飞行距离' },
    { name: 'vyLanding', label: '落地竖直速度', value: vyLanding, unit: 'm/s', description: '落地时竖直方向速度分量' },
    { name: 'vLanding', label: '落地速率', value: vLanding, unit: 'm/s', description: '落地时的速率' },
    { name: 'landingAngle', label: '落地角度', value: landingAngle, unit: '°', description: '落地时速度方向与水平方向的夹角' },
  ];

  const keyQuantities: KeyQuantity[] = [
    { name: 'maxHeight', label: '最大高度', value: hMax, unit: 'm', phase: '最高点' },
    { name: 'maxTime', label: '总飞行时间', value: totalTime, unit: 's', phase: '全程' },
    { name: 'range', label: '射程', value: xRange, unit: 'm', phase: '落地' },
    { name: 'maxSpeed', label: '最大速率', value: vLanding, unit: 'm/s', phase: '落地' },
  ];

  const diagrams: DiagramInfo[] = [
    { type: 'coordinate', description: '坐标系：水平为x轴，竖直为y轴' },
    { type: 'trajectory', description: '抛体运动轨迹图（抛物线）' },
    { type: 'force', description: '受力分析：仅受重力（忽略空气阻力）' },
  ];

  const finalAnswers: FinalAnswer[] = [
    { label: '最大高度', value: hMax, unit: 'm', latex: `H_{max} = ${formatValue(hMax)} \\text{ m}` },
    { label: '总飞行时间', value: totalTime, unit: 's', latex: `t_{total} = ${formatValue(totalTime)} \\text{ s}` },
    { label: '射程', value: xRange, unit: 'm', latex: `R = ${formatValue(xRange)} \\text{ m}` },
    { label: '落地速率', value: vLanding, unit: 'm/s', latex: `v_{landing} = ${formatValue(vLanding)} \\text{ m/s}` },
  ];

  return {
    problemId,
    problemType: 'projectile',
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
  v0x: number,
  v0y: number,
  x0: number,
  h0: number,
  totalTime: number
): TrajectoryPoint[] {
  const points: TrajectoryPoint[] = [];
  const numPoints = 100;
  const dt = totalTime / numPoints;

  for (let i = 0; i <= numPoints; i++) {
    const t = i * dt;
    const x = x0 + v0x * t;
    const y = h0 + v0y * t - 0.5 * g * t * t;
    const vx = v0x;
    const vy = v0y - g * t;
    const ax = 0;
    const ay = -g;

    const velocity = Math.sqrt(vx * vx + vy * vy);

    points.push({
      time: t,
      x,
      y,
      vx,
      vy,
      ax,
      ay,
      velocity,
      acceleration: g,
    });

    if (y < 0 && t > 0.01) {
      break;
    }
  }

  return points;
}

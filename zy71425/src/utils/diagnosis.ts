import {
  SimulationResult,
  DiagnosisResult,
  TrajectoryPoint,
  MagneticField,
  TrackElement,
  ParticleConfig,
  calculateGyroradius,
  calculateSpeed,
  TRACK_WIDTH,
} from '../types';
import { findEndElement } from '../engine/collision/detector';

export function diagnoseFailure(
  result: SimulationResult,
  trajectory: TrajectoryPoint[],
  trackElements: TrackElement[],
  magneticFields: MagneticField[],
  particleConfig: ParticleConfig
): DiagnosisResult {
  if (result.success) {
    return diagnoseSuccess(result, trajectory, particleConfig);
  }

  const failureType = result.failureType;
  const collisionPoint = result.collisionPoint;

  switch (failureType) {
    case 'magnetic_direction':
      return diagnoseWrongMagnetic(trajectory, magneticFields, collisionPoint, particleConfig);
    case 'high_energy':
      return diagnoseHighEnergy(trajectory, magneticFields, trackElements, collisionPoint, particleConfig);
    case 'track_broken':
      return diagnoseBrokenTrack(trajectory, trackElements, collisionPoint);
    case 'wall_collision':
    default:
      return diagnoseWallCollision(trajectory, magneticFields, trackElements, collisionPoint, particleConfig);
  }
}

export function diagnoseSuccess(
  result: SimulationResult,
  trajectory: TrajectoryPoint[],
  particleConfig: ParticleConfig
): DiagnosisResult {
  const lastPoint = trajectory[trajectory.length - 1];
  const speed = Math.sqrt(lastPoint.velocity.x ** 2 + lastPoint.velocity.y ** 2);
  const magneticFieldPoint = trajectory.find((p) => p.magneticField !== null);

  const calculations: Array<{ label: string; value: string }> = [];

  calculations.push({
    label: '平均速度',
    value: `${speed.toExponential(2)} m/s`,
  });

  calculations.push({
    label: '飞行距离',
    value: `${result.totalFrames} 帧`,
  });

  calculations.push({
    label: '飞行时间',
    value: `${(result.totalTime * 1e6).toFixed(2)} μs`,
  });

  if (magneticFieldPoint?.magneticField) {
    const b = magneticFieldPoint.magneticField.strength;
    const r = calculateGyroradius(speed, particleConfig.mass, particleConfig.charge, b);
    calculations.push({
      label: '偏转半径',
      value: `${r.toExponential(2)} m`,
    });
  }

  return {
    success: true,
    failureType: null,
    summary: '粒子成功通过加速器到达终点靶区域！',
    formula: 'F = q(v × B)',
    explanation: '洛伦兹力正确偏转了粒子轨迹，使其沿设计的轨道前进并顺利到达终点。这是一个成功的粒子加速器配置。',
    evidence: [
      `粒子最终位置: (${result.finalPosition.x.toFixed(1)}, ${result.finalPosition.y.toFixed(1)})`,
      `总飞行帧数: ${result.totalFrames}`,
      `最终能量: ${(result.finalEnergy / 1e-15).toFixed(2)} × 10⁻¹⁵ J`,
    ],
    suggestions: [
      '尝试调整磁场强度，观察轨迹变化',
      '修改粒子能量，分析偏转半径的变化',
      '尝试设计更复杂的轨道形状',
    ],
    calculations,
  };
}

function diagnoseWrongMagnetic(
  trajectory: TrajectoryPoint[],
  magneticFields: MagneticField[],
  collisionPoint: { x: number; y: number } | null,
  particleConfig: ParticleConfig
): DiagnosisResult {
  const fieldEntryPoint = trajectory.find((p) => p.magneticField !== null);
  const startVel = trajectory[0].velocity;
  const expectedDirection = startVel.x > 0 ? 'outof' : 'into';
  const actualDirection = fieldEntryPoint?.magneticField?.direction || 'unknown';

  const evidence: string[] = [];
  evidence.push(`磁场方向: ${actualDirection} (应为 ${expectedDirection})`);
  evidence.push(`初始速度方向: vₓ = ${startVel.x.toExponential(2)} m/s`);
  if (collisionPoint) {
    evidence.push(`碰撞点: (${collisionPoint.x.toFixed(1)}, ${collisionPoint.y.toFixed(1)})`);
  }

  return {
    success: false,
    failureType: 'magnetic_direction',
    summary: '磁场方向与预期相反，导致粒子向错误方向偏转并撞壁。',
    formula: 'F = q(v × B)',
    explanation: `根据左手定则，正电荷${particleConfig.name}以速度v向右运动时，为了使其向正确方向偏转，磁场方向应为"${expectedDirection}"。当前磁场方向为"${actualDirection}"，导致洛伦兹力方向反转，粒子向相反方向偏转。`,
    evidence,
    suggestions: [
      '点击磁场块，将方向反转（into ↔ outof）',
      '记住左手定则：正电荷向右运动时，向外的磁场使粒子向上偏转',
      '观察模拟中的受力矢量（红色箭头）确认受力方向',
    ],
    calculations: [],
  };
}

function diagnoseHighEnergy(
  trajectory: TrajectoryPoint[],
  magneticFields: MagneticField[],
  trackElements: TrackElement[],
  collisionPoint: { x: number; y: number } | null,
  particleConfig: ParticleConfig
): DiagnosisResult {
  const pointInField = trajectory.find((p) => p.magneticField !== null && p.magneticField.strength > 0);

  let gyroradius = 0;
  let speed = 0;
  let bStrength = 0;

  if (pointInField && pointInField.magneticField) {
    speed = calculateSpeed(pointInField.velocity);
    bStrength = pointInField.magneticField.strength;
    gyroradius = calculateGyroradius(
      speed,
      particleConfig.mass,
      particleConfig.charge,
      bStrength
    );
  }

  const evidence: string[] = [
    `初始能量: ${(particleConfig.initialEnergy / 1e-15).toFixed(2)} × 10⁻¹⁵ J`,
    `粒子速度: ${speed.toExponential(2)} m/s`,
    `磁场强度: ${bStrength.toFixed(1)} T`,
    `偏转半径: ${gyroradius.toExponential(2)} m`,
    `轨道半宽: ${TRACK_WIDTH / 2} px`,
  ];

  if (collisionPoint) {
    evidence.push(`碰撞点: (${collisionPoint.x.toFixed(1)}, ${collisionPoint.y.toFixed(1)})`);
  }

  return {
    success: false,
    failureType: 'high_energy',
    summary: '粒子初始能量过大，偏转半径超过轨道宽度，无法完成转弯。',
    formula: 'r = mv / (qB)',
    explanation: `偏转半径公式 r = mv/(qB) 表明：速度越大，偏转半径越大。当前粒子速度 v = ${speed.toExponential(2)} m/s，在 B = ${bStrength.toFixed(1)} T 的磁场中，偏转半径 r = ${gyroradius.toExponential(2)} m。这个半径过大，粒子无法在宽度仅为 ${TRACK_WIDTH} px 的轨道内完成转弯。`,
    evidence,
    suggestions: [
      '降低初始能量（参数面板滑块向左）',
      '增强磁场强度以减小偏转半径',
      '或拓宽轨道转弯处的曲率半径',
    ],
    calculations: [],
  };
}

function diagnoseBrokenTrack(
  trajectory: TrajectoryPoint[],
  trackElements: TrackElement[],
  collisionPoint: { x: number; y: number } | null
): DiagnosisResult {
  const firstOutOfTrack = trajectory.find((p) => !p.inTrack);
  const endElement = findEndElement(trackElements);

  const evidence: string[] = [
    `轨道元素数量: ${trackElements.length}`,
    `是否有终点: ${endElement ? '是' : '否'}`,
  ];

  if (firstOutOfTrack) {
    evidence.push(`脱离轨道点: (${firstOutOfTrack.position.x.toFixed(1)}, ${firstOutOfTrack.position.y.toFixed(1)})`);
    evidence.push(`脱离轨道帧: ${firstOutOfTrack.frame}`);
  }

  return {
    success: false,
    failureType: 'track_broken',
    summary: '轨道段之间存在间隙，粒子运动到断开位置后失去约束。',
    formula: '轨道连续性检测',
    explanation: `在第 ${firstOutOfTrack?.frame || 0} 帧，粒子在位置 (${firstOutOfTrack?.position.x.toFixed(0)}, ${firstOutOfTrack?.position.y.toFixed(0)}) 附近飞出轨道范围。${!endElement ? '未找到终点靶元素。' : '请检查所有轨道片是否正确连接，确保网格对齐（开启吸附网格）。'}`,
    evidence,
    suggestions: [
      '添加轨道片填补间隙',
      '确保所有轨道片在网格上对齐（拖拽时自动吸附）',
      '检查起点到终点的完整路径是否连续',
    ],
    calculations: [],
  };
}

function diagnoseWallCollision(
  trajectory: TrajectoryPoint[],
  magneticFields: MagneticField[],
  trackElements: TrackElement[],
  collisionPoint: { x: number; y: number } | null,
  particleConfig: ParticleConfig
): DiagnosisResult {
  const lastPoint = trajectory[trajectory.length - 1];
  const evidence: string[] = [];

  if (collisionPoint) {
    evidence.push(`碰撞点: (${collisionPoint.x.toFixed(1)}, ${collisionPoint.y.toFixed(1)})`);
  }

  evidence.push(`粒子最终速度: (${lastPoint.velocity.x.toExponential(2)}, ${lastPoint.velocity.y.toExponential(2)}) m/s`);
  evidence.push(`碰撞时帧号: ${trajectory.length}`);

  const pointInField = trajectory.find((p) => p.magneticField !== null);
  if (pointInField && pointInField.magneticField) {
    const speed = calculateSpeed(lastPoint.velocity);
    const expectedGyroradius = calculateGyroradius(
      speed,
      particleConfig.mass,
      particleConfig.charge,
      pointInField.magneticField.strength
    );
    evidence.push(`理论偏转半径: ${expectedGyroradius.toExponential(2)} m`);
    evidence.push(`实际磁场强度: ${pointInField.magneticField.strength.toFixed(1)} T`);
  }

  return {
    success: false,
    failureType: 'wall_collision',
    summary: '粒子碰撞到了轨道管壁，未能到达终点。',
    formula: 'd > TRACK_WIDTH / 2',
    explanation: `粒子到轨道中心线的距离超过了轨道半宽（${TRACK_WIDTH / 2} px），判定为碰撞管壁。这通常是因为磁场配置与轨道形状不匹配，或粒子能量与磁场强度不匹配。`,
    evidence,
    suggestions: [
      '检查轨道曲率是否匹配粒子偏转半径',
      '调整磁场强度或粒子能量使轨迹沿轨道中心前进',
      '开启模拟中的矢量显示，观察每一点的受力和速度方向',
    ],
    calculations: [],
  };
}

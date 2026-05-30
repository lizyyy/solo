import { GameRecord, PARTICLE_PROPERTIES, SampleDefinition } from '../types';
import { runFullSimulation } from '../engine/physics/lorentz';
import {
  checkTrackCollision,
  checkSuccess,
  isPointInTrack,
  findStartElement,
  findEndElement,
} from '../engine/collision/detector';

function runSimulationForSample(
  trackElements: GameRecord['trackElements'],
  magneticFields: GameRecord['magneticFields'],
  particleConfig: GameRecord['particleConfig'],
  sampleId: string,
  name: string
): GameRecord {
  const startElement = findStartElement(trackElements);
  const endElement = findEndElement(trackElements);

  const startPos = startElement
    ? { x: startElement.x + startElement.width / 2, y: startElement.y + startElement.height / 2 }
    : { x: 80, y: 300 };

  particleConfig.startPosition = startPos;

  const simResult = runFullSimulation(
    particleConfig,
    magneticFields,
    5000,
    (point) => checkTrackCollision(point, trackElements),
    (point) => checkSuccess(point, endElement),
    (point) => isPointInTrack(point.position, trackElements)
  );

  const trajectory = simResult.trajectory;
  const lastPoint = trajectory[trajectory.length - 1];

  let failureType: GameRecord['result']['failureType'] = null;
  let failureReason: string | null = null;

  if (!simResult.result.success) {
    if (simResult.result.collision) {
      const fieldEntry = trajectory.find((p) => p.magneticField !== null);
      if (fieldEntry && fieldEntry.magneticField) {
        const velStart = trajectory[0].velocity;
        const expectedDir = velStart.x > 0 ? 'outof' : 'into';

        if (
          (fieldEntry.magneticField.direction === 'into' && expectedDir === 'outof') ||
          (fieldEntry.magneticField.direction === 'outof' && expectedDir === 'into')
        ) {
          failureType = 'magnetic_direction';
          failureReason = '磁场方向与预期相反，导致粒子向错误方向偏转。';
        } else {
          const speed = Math.sqrt(
            lastPoint.velocity.x ** 2 + lastPoint.velocity.y ** 2
          );
          if (speed > 8e5) {
            failureType = 'high_energy';
            failureReason = '粒子初始能量过大，偏转半径超过轨道宽度。';
          } else {
            const outOfTrack = trajectory.find((p) => !p.inTrack);
            if (outOfTrack) {
              failureType = 'track_broken';
              failureReason = '轨道不连续，粒子飞出轨道范围。';
            } else {
              failureType = 'wall_collision';
              failureReason = '粒子碰撞轨道管壁。';
            }
          }
        }
      }
    }
  }

  return {
    id: `sample_${sampleId}_${Date.now()}`,
    name,
    timestamp: Date.now(),
    sampleSource: sampleId,
    trackElements,
    magneticFields,
    particleConfig,
    trajectory,
    result: {
      success: simResult.result.success,
      failureType,
      failureReason,
      collisionPoint: simResult.result.collisionPoint,
      totalFrames: trajectory.length,
      totalTime: trajectory.length * 0.000001,
      finalEnergy: 0.5 * particleConfig.mass * (lastPoint.velocity.x ** 2 + lastPoint.velocity.y ** 2),
      finalPosition: { ...lastPoint.position },
    },
  };
}

const sampleMagneticDirection: SampleDefinition = {
  id: 'sample-wrong-magnetic',
  name: '磁场方向错误',
  description: '磁场方向装反了，粒子会向相反方向偏转并撞壁。观察洛伦兹力方向与磁场方向的关系。',
  type: 'magnetic_direction',
  typeLabel: '磁场方向错误',
  category: 'error',
  expectedFailure: 'magnetic_direction',
  difficulty: 'easy',
  learningObjective: '理解洛伦兹力 F = q(v × B) 的方向关系，掌握左手定则。',
  trackElements: [
    {
      id: 'el_start',
      type: 'start',
      x: 40,
      y: 280,
      rotation: 0,
      sourceToolId: 'tool-track-start',
      width: 80,
      height: 80,
    },
    {
      id: 'el_straight1',
      type: 'straight',
      x: 120,
      y: 280,
      rotation: 0,
      sourceToolId: 'tool-track-straight',
      width: 120,
      height: 80,
    },
    {
      id: 'el_straight2',
      type: 'straight',
      x: 480,
      y: 280,
      rotation: 0,
      sourceToolId: 'tool-track-straight',
      width: 120,
      height: 80,
    },
    {
      id: 'el_end',
      type: 'end',
      x: 680,
      y: 280,
      rotation: 0,
      sourceToolId: 'tool-track-end',
      width: 80,
      height: 80,
    },
  ],
  magneticFields: [
    {
      id: 'mf_1',
      x: 280,
      y: 180,
      width: 160,
      height: 280,
      strength: 3,
      direction: 'into',
      sourceToolId: 'tool-magnetic-into',
    },
  ],
  particleConfig: {
    type: 'proton',
    name: PARTICLE_PROPERTIES.proton.name,
    symbol: PARTICLE_PROPERTIES.proton.symbol,
    charge: PARTICLE_PROPERTIES.proton.charge,
    mass: PARTICLE_PROPERTIES.proton.mass,
    initialEnergy: 1e-15,
    initialVelocity: { x: 3e5, y: 0 },
    startPosition: { x: 80, y: 320 },
  },
};

const sampleHighEnergy: SampleDefinition = {
  id: 'sample-high-energy',
  name: '能量过高',
  description: '粒子初始能量太大，偏转半径超过轨道宽度，无法完成转弯。学习 r = mv/(qB) 公式。',
  type: 'high_energy',
  typeLabel: '能量过高',
  category: 'error',
  expectedFailure: 'high_energy',
  difficulty: 'medium',
  learningObjective: '掌握偏转半径公式 r = mv/(qB)，理解能量与磁场强度的匹配关系。',
  trackElements: [
    {
      id: 'el_start',
      type: 'start',
      x: 40,
      y: 80,
      rotation: 0,
      sourceToolId: 'tool-track-start',
      width: 80,
      height: 80,
    },
    {
      id: 'el_straight1',
      type: 'straight',
      x: 120,
      y: 80,
      rotation: 0,
      sourceToolId: 'tool-track-straight',
      width: 160,
      height: 80,
    },
    {
      id: 'el_curve_right',
      type: 'curve-right',
      x: 280,
      y: 80,
      rotation: 0,
      sourceToolId: 'tool-track-curve-right',
      width: 160,
      height: 160,
    },
    {
      id: 'el_straight2',
      type: 'straight',
      x: 280,
      y: 240,
      rotation: 0,
      sourceToolId: 'tool-track-straight',
      width: 160,
      height: 80,
    },
    {
      id: 'el_end',
      type: 'end',
      x: 440,
      y: 240,
      rotation: 0,
      sourceToolId: 'tool-track-end',
      width: 80,
      height: 80,
    },
  ],
  magneticFields: [
    {
      id: 'mf_1',
      x: 280,
      y: 80,
      width: 200,
      height: 200,
      strength: 2,
      direction: 'outof',
      sourceToolId: 'tool-magnetic-outof',
    },
  ],
  particleConfig: {
    type: 'proton',
    name: PARTICLE_PROPERTIES.proton.name,
    symbol: PARTICLE_PROPERTIES.proton.symbol,
    charge: PARTICLE_PROPERTIES.proton.charge,
    mass: PARTICLE_PROPERTIES.proton.mass,
    initialEnergy: 5e-15,
    initialVelocity: { x: 8e5, y: 0 },
    startPosition: { x: 80, y: 120 },
  },
};

const sampleBrokenTrack: SampleDefinition = {
  id: 'sample-broken-track',
  name: '轨道断开',
  description: '轨道之间有间隙，粒子飞到一半失去约束。检查轨道连续性的重要性。',
  type: 'track_broken',
  typeLabel: '轨道断开',
  category: 'error',
  expectedFailure: 'track_broken',
  difficulty: 'easy',
  learningObjective: '理解轨道连续性对粒子约束的重要性，学会检查轨道间隙。',
  trackElements: [
    {
      id: 'el_start',
      type: 'start',
      x: 40,
      y: 280,
      rotation: 0,
      sourceToolId: 'tool-track-start',
      width: 80,
      height: 80,
    },
    {
      id: 'el_straight1',
      type: 'straight',
      x: 120,
      y: 280,
      rotation: 0,
      sourceToolId: 'tool-track-straight',
      width: 120,
      height: 80,
    },
    {
      id: 'el_straight2',
      type: 'straight',
      x: 520,
      y: 280,
      rotation: 0,
      sourceToolId: 'tool-track-straight',
      width: 160,
      height: 80,
    },
    {
      id: 'el_end',
      type: 'end',
      x: 680,
      y: 280,
      rotation: 0,
      sourceToolId: 'tool-track-end',
      width: 80,
      height: 80,
    },
  ],
  magneticFields: [
    {
      id: 'mf_1',
      x: 280,
      y: 200,
      width: 160,
      height: 200,
      strength: 2,
      direction: 'outof',
      sourceToolId: 'tool-magnetic-outof',
    },
  ],
  particleConfig: {
    type: 'proton',
    name: PARTICLE_PROPERTIES.proton.name,
    symbol: PARTICLE_PROPERTIES.proton.symbol,
    charge: PARTICLE_PROPERTIES.proton.charge,
    mass: PARTICLE_PROPERTIES.proton.mass,
    initialEnergy: 1e-15,
    initialVelocity: { x: 3e5, y: 0 },
    startPosition: { x: 80, y: 320 },
  },
};

const sampleCircularMotion: SampleDefinition = {
  id: 'sample-circular-motion',
  name: '圆周运动',
  description: '正确配置的磁场使粒子做匀速圆周运动。观察洛伦兹力提供向心力。',
  type: 'success',
  typeLabel: '成功样例',
  category: 'success',
  expectedFailure: null,
  difficulty: 'medium',
  learningObjective: '理解洛伦兹力提供向心力的圆周运动条件，掌握 qvB = mv²/r。',
  trackElements: [
    {
      id: 'el_start',
      type: 'start',
      x: 360,
      y: 440,
      rotation: 0,
      sourceToolId: 'tool-track-start',
      width: 80,
      height: 80,
    },
    {
      id: 'el_curve1',
      type: 'curve-right',
      x: 240,
      y: 320,
      rotation: 90,
      sourceToolId: 'tool-track-curve-right',
      width: 160,
      height: 160,
    },
    {
      id: 'el_straight1',
      type: 'straight',
      x: 80,
      y: 240,
      rotation: 0,
      sourceToolId: 'tool-track-straight',
      width: 160,
      height: 80,
    },
    {
      id: 'el_curve2',
      type: 'curve-right',
      x: 240,
      y: 120,
      rotation: 180,
      sourceToolId: 'tool-track-curve-right',
      width: 160,
      height: 160,
    },
    {
      id: 'el_straight2',
      type: 'straight',
      x: 400,
      y: 80,
      rotation: 0,
      sourceToolId: 'tool-track-straight',
      width: 160,
      height: 80,
    },
    {
      id: 'el_curve3',
      type: 'curve-right',
      x: 400,
      y: 120,
      rotation: 270,
      sourceToolId: 'tool-track-curve-right',
      width: 160,
      height: 160,
    },
    {
      id: 'el_end',
      type: 'end',
      x: 560,
      y: 280,
      rotation: 0,
      sourceToolId: 'tool-track-end',
      width: 80,
      height: 80,
    },
  ],
  magneticFields: [
    {
      id: 'mf_1',
      x: 80,
      y: 80,
      width: 560,
      height: 440,
      strength: 3,
      direction: 'into',
      sourceToolId: 'tool-magnetic-into',
    },
  ],
  particleConfig: {
    type: 'proton',
    name: PARTICLE_PROPERTIES.proton.name,
    symbol: PARTICLE_PROPERTIES.proton.symbol,
    charge: PARTICLE_PROPERTIES.proton.charge,
    mass: PARTICLE_PROPERTIES.proton.mass,
    initialEnergy: 1.5e-15,
    initialVelocity: { x: -3e5, y: 0 },
    startPosition: { x: 400, y: 480 },
  },
};

const sampleHelixMotion: SampleDefinition = {
  id: 'sample-helix-motion',
  name: '螺旋运动',
  description: '组合两个不同方向的磁场，观察粒子的螺旋运动轨迹。',
  type: 'success',
  typeLabel: '成功样例',
  category: 'success',
  expectedFailure: null,
  difficulty: 'hard',
  learningObjective: '理解复合磁场中粒子的运动轨迹，掌握多个磁场区域的叠加效应。',
  trackElements: [
    {
      id: 'el_start',
      type: 'start',
      x: 40,
      y: 280,
      rotation: 0,
      sourceToolId: 'tool-track-start',
      width: 80,
      height: 80,
    },
    {
      id: 'el_straight1',
      type: 'straight',
      x: 120,
      y: 280,
      rotation: 0,
      sourceToolId: 'tool-track-straight',
      width: 120,
      height: 80,
    },
    {
      id: 'el_curve_left',
      type: 'curve-left',
      x: 240,
      y: 160,
      rotation: 0,
      sourceToolId: 'tool-track-curve-left',
      width: 160,
      height: 160,
    },
    {
      id: 'el_straight2',
      type: 'straight',
      x: 240,
      y: 80,
      rotation: 0,
      sourceToolId: 'tool-track-straight',
      width: 160,
      height: 80,
    },
    {
      id: 'el_curve_right',
      type: 'curve-right',
      x: 400,
      y: 80,
      rotation: 0,
      sourceToolId: 'tool-track-curve-right',
      width: 160,
      height: 160,
    },
    {
      id: 'el_straight3',
      type: 'straight',
      x: 400,
      y: 240,
      rotation: 0,
      sourceToolId: 'tool-track-straight',
      width: 160,
      height: 80,
    },
    {
      id: 'el_curve_right2',
      type: 'curve-right',
      x: 560,
      y: 160,
      rotation: 270,
      sourceToolId: 'tool-track-curve-right',
      width: 160,
      height: 160,
    },
    {
      id: 'el_straight4',
      type: 'straight',
      x: 640,
      y: 280,
      rotation: 0,
      sourceToolId: 'tool-track-straight',
      width: 80,
      height: 80,
    },
    {
      id: 'el_end',
      type: 'end',
      x: 680,
      y: 280,
      rotation: 0,
      sourceToolId: 'tool-track-end',
      width: 80,
      height: 80,
    },
  ],
  magneticFields: [
    {
      id: 'mf_1',
      x: 200,
      y: 100,
      width: 180,
      height: 180,
      strength: 3,
      direction: 'outof',
      sourceToolId: 'tool-magnetic-outof',
    },
    {
      id: 'mf_2',
      x: 400,
      y: 100,
      width: 180,
      height: 180,
      strength: 3,
      direction: 'into',
      sourceToolId: 'tool-magnetic-into',
    },
  ],
  particleConfig: {
    type: 'proton',
    name: PARTICLE_PROPERTIES.proton.name,
    symbol: PARTICLE_PROPERTIES.proton.symbol,
    charge: PARTICLE_PROPERTIES.proton.charge,
    mass: PARTICLE_PROPERTIES.proton.mass,
    initialEnergy: 1.2e-15,
    initialVelocity: { x: 3e5, y: 0 },
    startPosition: { x: 80, y: 320 },
  },
};

export const SAMPLES: SampleDefinition[] = [
  sampleMagneticDirection,
  sampleHighEnergy,
  sampleBrokenTrack,
  sampleCircularMotion,
  sampleHelixMotion,
];

export function getSampleById(id: string): SampleDefinition | undefined {
  return SAMPLES.find((s) => s.id === id);
}

export function getSamplesByCategory(category: SampleDefinition['category']): SampleDefinition[] {
  return SAMPLES.filter((s) => s.category === category);
}

export function createSampleRecord(sampleId: string): GameRecord | null {
  const sample = getSampleById(sampleId);
  if (!sample) return null;

  return runSimulationForSample(
    JSON.parse(JSON.stringify(sample.trackElements)),
    JSON.parse(JSON.stringify(sample.magneticFields)),
    JSON.parse(JSON.stringify(sample.particleConfig)),
    sample.id,
    sample.name
  );
}

export function getAllSamplePreviews(): Array<{
  id: string;
  name: string;
  description: string;
  category: SampleDefinition['category'];
  expectedFailure: string | null;
  difficulty: SampleDefinition['difficulty'];
}> {
  return SAMPLES.map((s) => ({
    id: s.id,
    name: s.name,
    description: s.description,
    category: s.category,
    expectedFailure: s.expectedFailure,
    difficulty: s.difficulty,
  }));
}

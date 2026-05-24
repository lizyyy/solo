import type { SceneData, IntersectionGeometry, SignalPhase, Direction } from '../types'

export function loadSampleData(): SceneData {
  const totalDuration = 60

  const intersection: IntersectionGeometry = {
    id: 'intersection-001',
    name: '中山路与人民路交叉口',
    center: { x: 0, y: 0 },
    lanes: [
      { id: 'lane-n1', direction: 'north' as Direction, turnType: 'straight', position: [{ x: -3, y: -20 }, { x: -3, y: -5 }] },
      { id: 'lane-n2', direction: 'north' as Direction, turnType: 'left', position: [{ x: -6, y: -20 }, { x: -6, y: -5 }] },
      { id: 'lane-s1', direction: 'south' as Direction, turnType: 'straight', position: [{ x: 3, y: 20 }, { x: 3, y: 5 }] },
      { id: 'lane-s2', direction: 'south' as Direction, turnType: 'left', position: [{ x: 6, y: 20 }, { x: 6, y: 5 }] },
      { id: 'lane-e1', direction: 'east' as Direction, turnType: 'straight', position: [{ x: 20, y: 3 }, { x: 5, y: 3 }] },
      { id: 'lane-e2', direction: 'east' as Direction, turnType: 'left', position: [{ x: 20, y: 6 }, { x: 5, y: 6 }] },
      { id: 'lane-w1', direction: 'west' as Direction, turnType: 'straight', position: [{ x: -20, y: -3 }, { x: -5, y: -3 }] },
      { id: 'lane-w2', direction: 'west' as Direction, turnType: 'left', position: [{ x: -20, y: -6 }, { x: -5, y: -6 }] },
    ],
    crosswalks: [
      { id: 'cross-n', position: [{ x: -10, y: -8 }, { x: 10, y: -8 }], width: 3 },
      { id: 'cross-s', position: [{ x: -10, y: 8 }, { x: 10, y: 8 }], width: 3 },
      { id: 'cross-e', position: [{ x: 8, y: -10 }, { x: 8, y: 10 }], width: 3 },
      { id: 'cross-w', position: [{ x: -8, y: -10 }, { x: -8, y: 10 }], width: 3 },
    ],
    trafficLights: [
      { id: 'light-n', direction: 'north' as Direction, position: { x: -10, y: -10, z: 5 } },
      { id: 'light-s', direction: 'south' as Direction, position: { x: 10, y: 10, z: 5 } },
      { id: 'light-e', direction: 'east' as Direction, position: { x: 10, y: -10, z: 5 } },
      { id: 'light-w', direction: 'west' as Direction, position: { x: -10, y: 10, z: 5 } },
    ],
  }

  const signalPhases: SignalPhase[] = [
    {
      id: 'phase-n',
      direction: 'north' as Direction,
      name: '北进口',
      timing: [
        { startTime: 0, endTime: 25, state: 'green' as const },
        { startTime: 25, endTime: 28, state: 'yellow' as const },
        { startTime: 28, endTime: 60, state: 'red' as const },
      ],
    },
    {
      id: 'phase-s',
      direction: 'south' as Direction,
      name: '南进口',
      timing: [
        { startTime: 0, endTime: 25, state: 'green' as const },
        { startTime: 25, endTime: 28, state: 'yellow' as const },
        { startTime: 28, endTime: 60, state: 'red' as const },
      ],
    },
    {
      id: 'phase-e',
      direction: 'east' as Direction,
      name: '东进口',
      timing: [
        { startTime: 0, endTime: 28, state: 'red' as const },
        { startTime: 28, endTime: 53, state: 'green' as const },
        { startTime: 53, endTime: 56, state: 'yellow' as const },
        { startTime: 56, endTime: 60, state: 'red' as const },
      ],
    },
    {
      id: 'phase-w',
      direction: 'west' as Direction,
      name: '西进口',
      timing: [
        { startTime: 0, endTime: 28, state: 'red' as const },
        { startTime: 28, endTime: 53, state: 'green' as const },
        { startTime: 53, endTime: 56, state: 'yellow' as const },
        { startTime: 56, endTime: 60, state: 'red' as const },
      ],
    },
  ]

  const vehicles = [
    {
      id: 'car-001',
      type: 'car' as const,
      color: '#3b82f6',
      plateNumber: '京A12345',
      points: [
        { time: 0, x: 3, y: 18, angle: 270 },
        { time: 10, x: 3, y: 10, angle: 270 },
        { time: 15, x: 3, y: 5, angle: 270 },
        { time: 20, x: 3, y: -5, angle: 270 },
        { time: 25, x: 3, y: -15, angle: 270 },
      ],
    },
    {
      id: 'car-002',
      type: 'car' as const,
      color: '#ef4444',
      plateNumber: '京B67890',
      points: [
        { time: 5, x: -3, y: -18, angle: 90 },
        { time: 15, x: -3, y: -10, angle: 90 },
        { time: 20, x: -3, y: -5, angle: 90 },
        { time: 25, x: -3, y: 5, angle: 90 },
        { time: 30, x: -3, y: 15, angle: 90 },
      ],
    },
    {
      id: 'car-003',
      type: 'truck' as const,
      color: '#22c55e',
      plateNumber: '京C11111',
      points: [
        { time: 30, x: -18, y: -3, angle: 0 },
        { time: 38, x: -10, y: -3, angle: 0 },
        { time: 42, x: -5, y: -3, angle: 0 },
        { time: 48, x: 5, y: -3, angle: 0 },
        { time: 55, x: 15, y: -3, angle: 0 },
      ],
    },
    {
      id: 'car-004',
      type: 'motorcycle' as const,
      color: '#f59e0b',
      plateNumber: '京D22222',
      points: [
        { time: 32, x: 15, y: 3, angle: 180 },
        { time: 40, x: 8, y: 3, angle: 180 },
        { time: 45, x: 2, y: 3, angle: 180 },
        { time: 50, x: -8, y: 3, angle: 180 },
      ],
    },
  ]

  const pedestrians = [
    {
      id: 'ped-001',
      name: '行人甲',
      points: [
        { time: 12, x: -8, y: -12 },
        { time: 15, x: -4, y: -8 },
        { time: 18, x: 0, y: -8 },
        { time: 21, x: 4, y: -8 },
        { time: 24, x: 8, y: -8 },
      ],
    },
    {
      id: 'ped-002',
      name: '行人乙',
      points: [
        { time: 35, x: -12, y: 6 },
        { time: 40, x: -8, y: 6 },
        { time: 45, x: -8, y: 0 },
        { time: 50, x: -8, y: -6 },
      ],
    },
  ]

  const accidentPoints = [
    {
      id: 'accident-001',
      time: 22,
      x: 2,
      y: -3,
      type: '碰撞事故',
      description: '车辆与行人在斑马线附近发生碰撞',
    },
  ]

  return {
    intersection,
    signalPhases,
    vehicles,
    pedestrians,
    accidentPoints,
    totalDuration,
  }
}

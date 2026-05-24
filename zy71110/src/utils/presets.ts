import { PresetScenario } from '../types';

export const presetScenarios: PresetScenario[] = [
  {
    id: 'flat-optimal',
    name: '平地最优布局',
    description: '标准矩形地块，4个喷头均匀分布，无风无坡度，展示理想覆盖效果',
    field: { width: 40, height: 30, resolution: 0.2 },
    sprinklers: [
      { id: 's1', x: -10, z: -7.5, radius: 12, flowRate: 100, pressure: 1.0, angle: 45 },
      { id: 's2', x: 10, z: -7.5, radius: 12, flowRate: 100, pressure: 1.0, angle: 45 },
      { id: 's3', x: -10, z: 7.5, radius: 12, flowRate: 100, pressure: 1.0, angle: 45 },
      { id: 's4', x: 10, z: 7.5, radius: 12, flowRate: 100, pressure: 1.0, angle: 45 },
    ],
    environment: { slope: 0, slopeDirection: 0, windSpeed: 0, windDirection: 0, globalPressure: 1.0 },
  },
  {
    id: 'slope-missed',
    name: '坡地漏浇案例',
    description: '15度斜坡展示，上坡方向射程明显缩短，造成上坡区域漏浇',
    field: { width: 40, height: 30, resolution: 0.2 },
    sprinklers: [
      { id: 's1', x: -10, z: -7.5, radius: 12, flowRate: 100, pressure: 1.0, angle: 45 },
      { id: 's2', x: 10, z: -7.5, radius: 12, flowRate: 100, pressure: 1.0, angle: 45 },
      { id: 's3', x: -10, z: 7.5, radius: 12, flowRate: 100, pressure: 1.0, angle: 45 },
      { id: 's4', x: 10, z: 7.5, radius: 12, flowRate: 100, pressure: 1.0, angle: 45 },
    ],
    environment: { slope: 15, slopeDirection: 180, windSpeed: 0, windDirection: 0, globalPressure: 1.0 },
  },
  {
    id: 'wind-effect',
    name: '强风偏斜案例',
    description: '5m/s强风，展示风向对覆盖范围的偏斜影响，逆风侧出现漏浇带',
    field: { width: 40, height: 30, resolution: 0.2 },
    sprinklers: [
      { id: 's1', x: -10, z: -7.5, radius: 12, flowRate: 100, pressure: 1.0, angle: 45 },
      { id: 's2', x: 10, z: -7.5, radius: 12, flowRate: 100, pressure: 1.0, angle: 45 },
      { id: 's3', x: -10, z: 7.5, radius: 12, flowRate: 100, pressure: 1.0, angle: 45 },
      { id: 's4', x: 10, z: 7.5, radius: 12, flowRate: 100, pressure: 1.0, angle: 45 },
    ],
    environment: { slope: 0, slopeDirection: 0, windSpeed: 5, windDirection: 90, globalPressure: 1.0 },
  },
  {
    id: 'low-pressure',
    name: '水压不足案例',
    description: '水压降至0.6，所有喷头射程缩短，中心和边角出现大面积漏浇',
    field: { width: 40, height: 30, resolution: 0.2 },
    sprinklers: [
      { id: 's1', x: -10, z: -7.5, radius: 12, flowRate: 100, pressure: 0.6, angle: 45 },
      { id: 's2', x: 10, z: -7.5, radius: 12, flowRate: 100, pressure: 0.6, angle: 45 },
      { id: 's3', x: -10, z: 7.5, radius: 12, flowRate: 100, pressure: 0.6, angle: 45 },
      { id: 's4', x: 10, z: 7.5, radius: 12, flowRate: 100, pressure: 0.6, angle: 45 },
    ],
    environment: { slope: 0, slopeDirection: 0, windSpeed: 0, windDirection: 0, globalPressure: 0.6 },
  },
  {
    id: 'corner-missed',
    name: '边角漏浇经典案例',
    description: '3喷头三角形布局，四个边角覆盖不足，展示叠加半径误算问题',
    field: { width: 40, height: 40, resolution: 0.2 },
    sprinklers: [
      { id: 's1', x: 0, z: -10, radius: 15, flowRate: 100, pressure: 1.0, angle: 45 },
      { id: 's2', x: -12, z: 10, radius: 15, flowRate: 100, pressure: 1.0, angle: 45 },
      { id: 's3', x: 12, z: 10, radius: 15, flowRate: 100, pressure: 1.0, angle: 45 },
    ],
    environment: { slope: 0, slopeDirection: 0, windSpeed: 0, windDirection: 0, globalPressure: 1.0 },
  },
  {
    id: 'complex-terrain',
    name: '复杂场景综合',
    description: '坡地+风向+水压不足的综合场景，展示多因素叠加影响',
    field: { width: 50, height: 40, resolution: 0.2 },
    sprinklers: [
      { id: 's1', x: -15, z: -10, radius: 12, flowRate: 100, pressure: 0.7, angle: 45 },
      { id: 's2', x: 0, z: -10, radius: 12, flowRate: 100, pressure: 0.7, angle: 45 },
      { id: 's3', x: 15, z: -10, radius: 12, flowRate: 100, pressure: 0.7, angle: 45 },
      { id: 's4', x: -15, z: 10, radius: 12, flowRate: 100, pressure: 0.7, angle: 45 },
      { id: 's5', x: 0, z: 10, radius: 12, flowRate: 100, pressure: 0.7, angle: 45 },
      { id: 's6', x: 15, z: 10, radius: 12, flowRate: 100, pressure: 0.7, angle: 45 },
    ],
    environment: { slope: 10, slopeDirection: 200, windSpeed: 3, windDirection: 45, globalPressure: 0.8 },
  },
];

export const defaultScenario = presetScenarios[0];

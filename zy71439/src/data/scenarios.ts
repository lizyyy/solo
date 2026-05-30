import { Scenario } from '../types';

export const SCENARIOS: Scenario[] = [
  {
    id: 'scenario-001',
    name: '珠江口遇险救援',
    description: '一艘渔船在珠江口附近海域遇险，需要根据三座灯塔的方位角确定其位置并实施救援。',
    hint: '建议先输入所有三个灯塔的方位角，观察三条线的交点，误差三角形越小说明定位越准确。',
    lighthouseIds: ['lh-001', 'lh-002', 'lh-003'],
    trueShipPosition: { lat: 22.2012, lng: 113.5512 },
    rescueStation: {
      lat: 22.2089,
      lng: 113.5321,
      name: '香港海上救援中心'
    },
    bearingHints: [
      { lighthouseId: 'lh-001', bearing: 45.32, unit: 'decimal' },
      { lighthouseId: 'lh-002', bearing: 120.15, unit: 'decimal' },
      { lighthouseId: 'lh-003', bearing: 280.45, unit: 'decimal' }
    ],
    difficulty: 'beginner'
  },
  {
    id: 'scenario-002',
    name: '夜间航行定位',
    description: '夜间浓雾中航行，能见度极低，仅能通过灯塔信号确定方位。注意角度单位可能混淆。',
    hint: '本次训练使用度分秒格式，注意不要与十进制度混淆。例如30°30\'等于30.5°。',
    lighthouseIds: ['lh-001', 'lh-003', 'lh-004'],
    trueShipPosition: { lat: 22.1945, lng: 113.5623 },
    rescueStation: {
      lat: 22.2010,
      lng: 113.5480,
      name: '澳门海事救援站'
    },
    bearingHints: [
      { lighthouseId: 'lh-001', bearing: 30, unit: 'dms' },
      { lighthouseId: 'lh-003', bearing: 250, unit: 'dms' },
      { lighthouseId: 'lh-004', bearing: 135, unit: 'dms' }
    ],
    difficulty: 'intermediate'
  },
  {
    id: 'scenario-003',
    name: '复杂海况救援',
    description: '台风来临前，一艘货船发出求救信号。海面波涛汹涌，方位角测量存在较大误差。',
    hint: '恶劣海况下方位角会有误差，请注意分析误差三角形的形状，合理估算遇险船位置。',
    lighthouseIds: ['lh-002', 'lh-004', 'lh-005'],
    trueShipPosition: { lat: 22.2100, lng: 113.5350 },
    rescueStation: {
      lat: 22.2200,
      lng: 113.5200,
      name: '深圳海上搜救中心'
    },
    bearingHints: [
      { lighthouseId: 'lh-002', bearing: 95.25, unit: 'decimal' },
      { lighthouseId: 'lh-004', bearing: 320.10, unit: 'decimal' },
      { lighthouseId: 'lh-005', bearing: 185.45, unit: 'decimal' }
    ],
    difficulty: 'advanced'
  }
];

export function getRandomScenario(): Scenario {
  const index = Math.floor(Math.random() * SCENARIOS.length);
  return SCENARIOS[index];
}

export function getScenarioById(id: string): Scenario | undefined {
  return SCENARIOS.find(s => s.id === id);
}

export { SCENARIOS as scenarios };

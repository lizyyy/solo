import { Container, Yard } from '../types';

export const sampleYard: Yard = {
  id: 'yard-001',
  name: 'A区堆场',
  bays: 6,
  rows: 4,
  maxTiers: 5,
  gantryPositions: [0, 5],
};

const containerColors = [
  '#3B82F6',
  '#10B981',
  '#F59E0B',
  '#EF4444',
  '#8B5CF6',
  '#EC4899',
  '#06B6D4',
  '#F97316',
];

function generateContainerId(bay: number, row: number, tier: number): string {
  return `CNT-${bay.toString().padStart(2, '0')}-${row.toString().padStart(2, '0')}-${tier.toString().padStart(2, '0')}`;
}

function getRandomColor(): string {
  return containerColors[Math.floor(Math.random() * containerColors.length)];
}

function getRandomWeight(): number {
  return Math.floor(Math.random() * 20) + 10;
}

export function generateSampleContainers(): Container[] {
  const containers: Container[] = [];
  
  const layout = [
    [[1, 1, 1, 1, 0], [1, 1, 1, 0, 0], [1, 1, 0, 0, 0], [1, 1, 1, 1, 1]],
    [[1, 1, 0, 0, 0], [1, 1, 1, 1, 0], [1, 1, 1, 0, 0], [1, 1, 0, 0, 0]],
    [[1, 1, 1, 0, 0], [1, 1, 1, 1, 1], [1, 1, 1, 1, 0], [1, 1, 1, 0, 0]],
    [[1, 1, 0, 0, 0], [1, 1, 1, 0, 0], [1, 1, 1, 1, 0], [1, 1, 1, 1, 1]],
    [[1, 1, 1, 1, 0], [1, 1, 1, 0, 0], [1, 1, 0, 0, 0], [1, 1, 1, 0, 0]],
    [[1, 1, 0, 0, 0], [1, 1, 1, 1, 0], [1, 1, 1, 1, 1], [1, 1, 1, 0, 0]],
  ];

  for (let bay = 0; bay < layout.length; bay++) {
    for (let row = 0; row < layout[bay].length; row++) {
      for (let tier = 0; tier < layout[bay][row].length; tier++) {
        if (layout[bay][row][tier] === 1) {
          containers.push({
            id: generateContainerId(bay, row, tier),
            bay,
            row,
            tier,
            size: Math.random() > 0.7 ? '40ft' : '20ft',
            weight: getRandomWeight(),
            status: 'normal',
            color: getRandomColor(),
          });
        }
      }
    }
  }

  return containers;
}

export const sampleScenarios = [
  {
    id: 'scenario-1',
    name: '基础样例 - 单层遮挡',
    description: '目标箱上方有2个遮挡箱，需要倒箱后取箱',
    targetContainerId: 'CNT-02-01-00',
  },
  {
    id: 'scenario-2',
    name: '复杂样例 - 多层遮挡',
    description: '目标箱位于箱堆深处，多层多列遮挡',
    targetContainerId: 'CNT-03-02-00',
  },
  {
    id: 'scenario-3',
    name: '边界样例 - 边缘箱子',
    description: '目标箱位于箱区边缘，单侧可达',
    targetContainerId: 'CNT-00-00-00',
  },
];

export function importScenarioData(scenarioId: string): {
  yard: Yard;
  containers: Container[];
  targetId: string | null;
} {
  const scenario = sampleScenarios.find((s) => s.id === scenarioId);
  return {
    yard: sampleYard,
    containers: generateSampleContainers(),
    targetId: scenario?.targetContainerId || null,
  };
}


import { Level } from '../types';

export const LEVELS: Level[] = [
  {
    id: 'level-1',
    name: '基础曝光训练',
    difficulty: 1,
    sourceImage: 'https://picsum.photos/id/64/800/450',
    targetImage: 'https://picsum.photos/id/65/800/450',
    targetParams: {
      exposure: 0.8,
      temperature: 7500,
      lutId: 'cinematic',
      lutIntensity: 60,
    },
    description: '学习基础曝光调整，将偏暗的画面调整至合适亮度',
  },
  {
    id: 'level-2',
    name: '色温平衡',
    difficulty: 1,
    sourceImage: 'https://picsum.photos/id/1067/800/450',
    targetImage: 'https://picsum.photos/id/1068/800/450',
    targetParams: {
      exposure: 0.3,
      temperature: 5600,
      lutId: 'none',
      lutIntensity: 0,
    },
    description: '练习色温校正，消除色偏获得自然的色彩表现',
  },
  {
    id: 'level-3',
    name: '电影风格调色',
    difficulty: 2,
    sourceImage: 'https://picsum.photos/id/1040/800/450',
    targetImage: 'https://picsum.photos/id/1041/800/450',
    targetParams: {
      exposure: -0.2,
      temperature: 4200,
      lutId: 'cinematic',
      lutIntensity: 85,
    },
    description: '运用LUT创造电影级的城市夜景风格',
  },
  {
    id: 'level-4',
    name: '复古胶片感',
    difficulty: 2,
    sourceImage: 'https://picsum.photos/id/1050/800/450',
    targetImage: 'https://picsum.photos/id/1051/800/450',
    targetParams: {
      exposure: 0.5,
      temperature: 3800,
      lutId: 'vintage',
      lutIntensity: 75,
    },
    description: '模拟70年代复古胶片的褪色质感',
  },
  {
    id: 'level-5',
    name: '高难度人像精修',
    difficulty: 3,
    sourceImage: 'https://picsum.photos/id/1027/800/450',
    targetImage: 'https://picsum.photos/id/1025/800/450',
    targetParams: {
      exposure: 0.6,
      temperature: 6500,
      lutId: 'bw',
      lutIntensity: 90,
    },
    description: '挑战高对比度黑白人像的专业级调色',
  },
];

export function getLevelById(id: string): Level | undefined {
  return LEVELS.find((level) => level.id === id);
}

export function getDifficultyLabel(difficulty: number): string {
  switch (difficulty) {
    case 1:
      return '入门';
    case 2:
      return '进阶';
    case 3:
      return '专业';
    default:
      return '未知';
  }
}

export function getDifficultyColor(difficulty: number): string {
  switch (difficulty) {
    case 1:
      return '#00ff88';
    case 2:
      return '#ffd700';
    case 3:
      return '#ff3333';
    default:
      return '#888';
  }
}

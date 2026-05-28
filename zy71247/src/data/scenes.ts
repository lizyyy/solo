import { SceneConfig } from '../types';

function generateCircleTarget(size: number, centerX: number, centerY: number, radius: number): number[][] {
  const image: number[][] = [];
  for (let y = 0; y < size; y++) {
    const row: number[] = [];
    for (let x = 0; x < size; x++) {
      const dist = Math.sqrt((x - centerX) ** 2 + (y - centerY) ** 2);
      if (dist < radius) {
        row.push(0.9 - (dist / radius) * 0.5);
      } else {
        row.push(0.1);
      }
    }
    image.push(row);
  }
  return image;
}

function generateTriangleTarget(size: number): number[][] {
  const image: number[][] = [];
  const cx = size / 2;
  const cy = size / 2;
  for (let y = 0; y < size; y++) {
    const row: number[] = [];
    for (let x = 0; x < size; x++) {
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const angle = Math.atan2(dy, dx);
      const normalizedAngle = ((angle + Math.PI) / (Math.PI * 2)) * 3;
      const sector = Math.floor(normalizedAngle) % 3;
      if (dist < size * 0.35) {
        row.push(0.6 + sector * 0.15);
      } else {
        row.push(0.1);
      }
    }
    image.push(row);
  }
  return image;
}

function generateGridTarget(size: number): number[][] {
  const image: number[][] = [];
  for (let y = 0; y < size; y++) {
    const row: number[] = [];
    for (let x = 0; x < size; x++) {
      const inGrid = (x % 20 < 3 || y % 20 < 3);
      const inCenter = x > size * 0.4 && x < size * 0.6 && y > size * 0.4 && y < size * 0.6;
      if (inCenter) {
        row.push(0.95);
      } else if (inGrid) {
        row.push(0.6);
      } else {
        row.push(0.15);
      }
    }
    image.push(row);
  }
  return image;
}

export const scenes: SceneConfig[] = [
  {
    id: 'circle',
    name: '圆形地物',
    description: '简单的圆形目标，适合初学者理解SAR成像基本原理',
    difficulty: 'easy',
    targetImage: generateCircleTarget(128, 64, 64, 35),
    idealParams: {
      trackOffset: { x: 0, y: 0 },
      samplingInterval: 5,
      noiseThreshold: 20,
    },
    thresholds: {
      sampling: { warning: 8, critical: 15 },
      track: { warning: 20, critical: 40 },
      noise: { warning: 25, critical: 45 },
    },
  },
  {
    id: 'triangle',
    name: '扇形地物',
    description: '包含三个扇形区域，对成像分辨率要求更高',
    difficulty: 'medium',
    targetImage: generateTriangleTarget(128),
    idealParams: {
      trackOffset: { x: 0, y: 0 },
      samplingInterval: 4,
      noiseThreshold: 15,
    },
    thresholds: {
      sampling: { warning: 6, critical: 12 },
      track: { warning: 15, critical: 30 },
      noise: { warning: 20, critical: 35 },
    },
  },
  {
    id: 'grid',
    name: '网格地物',
    description: '复杂的网格结构，对航迹精度和采样率要求最高',
    difficulty: 'hard',
    targetImage: generateGridTarget(128),
    idealParams: {
      trackOffset: { x: 0, y: 0 },
      samplingInterval: 3,
      noiseThreshold: 10,
    },
    thresholds: {
      sampling: { warning: 5, critical: 10 },
      track: { warning: 10, critical: 25 },
      noise: { warning: 15, critical: 30 },
    },
  },
];

export function getSceneById(id: string): SceneConfig | undefined {
  return scenes.find(scene => scene.id === id);
}

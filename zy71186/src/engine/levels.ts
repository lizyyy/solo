import type { Level } from './types';

function generateSmoothCurve(baseValue: number, peaks: { time: number; height: number; width: number }[], duration: number): number[] {
  const curve: number[] = [];
  for (let t = 0; t < duration; t++) {
    let value = baseValue;
    for (const peak of peaks) {
      const distance = Math.abs(t - peak.time);
      if (distance < peak.width) {
        const factor = 1 - distance / peak.width;
        value += peak.height * factor * factor;
      }
    }
    curve.push(Math.round(value));
  }
  return curve;
}

const LEVELS: Level[] = [
  {
    id: 'level-1',
    name: '新手入门',
    difficulty: 'easy',
    description: '平缓的来水过程，学习基本的闸门操作。保持水库水位在正常范围内，下游不超警。',
    duration: 48,
    inflowCurve: generateSmoothCurve(100, [{ time: 24, height: 150, width: 12 }], 48),
    initialStorage: 5000,
    targetStorage: 6000,
    maxStorage: 10000,
    normalStorage: 8000,
    deadStorage: 2000,
    safeDischarge: 500,
    warningDischarge: 400,
    maxDischarge: 800,
  },
  {
    id: 'level-2',
    name: '单峰洪水',
    difficulty: 'easy',
    description: '一次明显的洪峰过程。需要提前泄水腾出库容，洪峰过后及时回蓄。',
    duration: 72,
    inflowCurve: generateSmoothCurve(80, [{ time: 36, height: 320, width: 18 }], 72),
    initialStorage: 6000,
    targetStorage: 7000,
    maxStorage: 10000,
    normalStorage: 8000,
    deadStorage: 2000,
    safeDischarge: 500,
    warningDischarge: 400,
    maxDischarge: 800,
  },
  {
    id: 'level-3',
    name: '双峰洪水',
    difficulty: 'medium',
    description: '两次洪峰接踵而至。第一次洪峰后不能回蓄太多，为第二次洪峰预留库容。',
    duration: 96,
    inflowCurve: generateSmoothCurve(100, [
      { time: 24, height: 280, width: 12 },
      { time: 60, height: 350, width: 16 },
    ], 96),
    initialStorage: 5500,
    targetStorage: 6500,
    maxStorage: 10000,
    normalStorage: 8000,
    deadStorage: 2000,
    safeDischarge: 450,
    warningDischarge: 350,
    maxDischarge: 800,
  },
  {
    id: 'level-4',
    name: '特大洪水',
    difficulty: 'hard',
    description: '历史罕见大洪水。必须精准控制，在水库安全和下游防护之间找到最佳平衡。',
    duration: 120,
    inflowCurve: generateSmoothCurve(120, [
      { time: 30, height: 200, width: 10 },
      { time: 60, height: 450, width: 24 },
      { time: 90, height: 180, width: 12 },
    ], 120),
    initialStorage: 5000,
    targetStorage: 6000,
    maxStorage: 10000,
    normalStorage: 8000,
    deadStorage: 2000,
    safeDischarge: 400,
    warningDischarge: 300,
    maxDischarge: 700,
  },
  {
    id: 'level-5',
    name: '枯水调度',
    difficulty: 'medium',
    description: '来水偏少，需要节约用水。既要保证下游生态流量，又要维持必要的蓄水。',
    duration: 120,
    inflowCurve: generateSmoothCurve(50, [{ time: 60, height: 80, width: 20 }], 120),
    initialStorage: 7000,
    targetStorage: 5000,
    maxStorage: 10000,
    normalStorage: 8000,
    deadStorage: 3000,
    safeDischarge: 300,
    warningDischarge: 200,
    maxDischarge: 500,
  },
];

export function getLevels(): Level[] {
  return LEVELS;
}

export function getLevelById(id: string): Level | undefined {
  return LEVELS.find(level => level.id === id);
}

export function getInflowAtTime(inflowCurve: number[], time: number): number {
  const index = Math.floor(Math.max(0, Math.min(time, inflowCurve.length - 1)));
  return inflowCurve[index] || 0;
}

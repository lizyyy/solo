import { Level } from '../types';

export const LEVELS: Level[] = [
  {
    id: 'level-1',
    name: '基础正弦波',
    description: '使用单个正弦波振荡器匹配目标音色。这是最简单的波形，频率决定音高。',
    difficulty: 1,
    passThreshold: 85,
    unlocked: true,
    hint: '提示：目标是一个纯净的440Hz正弦波（A4音）',
    targetOscillators: [
      {
        id: 'target-1',
        enabled: true,
        waveform: 'sine',
        frequency: 440,
        volume: 0.5,
        phase: 0
      }
    ]
  },
  {
    id: 'level-2',
    name: '方波挑战',
    description: '方波含有丰富的奇次谐波，听起来更有电子感。调节频率和音量来匹配。',
    difficulty: 1,
    passThreshold: 80,
    unlocked: true,
    hint: '提示：方波的频率约为220Hz，注意方波听起来比正弦波更"尖锐"',
    targetOscillators: [
      {
        id: 'target-1',
        enabled: true,
        waveform: 'square',
        frequency: 220,
        volume: 0.4,
        phase: 0
      }
    ]
  },
  {
    id: 'level-3',
    name: '双波叠加',
    description: '两个振荡器叠加可以产生更丰富的音色。尝试混合正弦波和三角波。',
    difficulty: 2,
    passThreshold: 75,
    unlocked: true,
    hint: '提示：一个高频正弦波 + 一个低频三角波，注意两个频率的比例',
    targetOscillators: [
      {
        id: 'target-1',
        enabled: true,
        waveform: 'sine',
        frequency: 440,
        volume: 0.4,
        phase: 0
      },
      {
        id: 'target-2',
        enabled: true,
        waveform: 'triangle',
        frequency: 220,
        volume: 0.3,
        phase: 0
      }
    ]
  },
  {
    id: 'level-4',
    name: '相位探秘',
    description: '相位影响波形叠加效果。当两个相同频率的波相位相反时会产生抵消！',
    difficulty: 2,
    passThreshold: 70,
    unlocked: true,
    hint: '提示：两个相同频率的正弦波，但相位不同。仔细听音色的变化。',
    targetOscillators: [
      {
        id: 'target-1',
        enabled: true,
        waveform: 'sine',
        frequency: 330,
        volume: 0.35,
        phase: 0
      },
      {
        id: 'target-2',
        enabled: true,
        waveform: 'sine',
        frequency: 330,
        volume: 0.35,
        phase: 0.25
      }
    ]
  },
  {
    id: 'level-5',
    name: '和声合成',
    description: '三个振荡器创造和弦音色。这是最接近真实乐器的合成方式。',
    difficulty: 3,
    passThreshold: 65,
    unlocked: true,
    hint: '提示：大三和弦 - 根音、大三度、纯五度。三个频率比为 4:5:6',
    targetOscillators: [
      {
        id: 'target-1',
        enabled: true,
        waveform: 'sine',
        frequency: 261.63,
        volume: 0.3,
        phase: 0
      },
      {
        id: 'target-2',
        enabled: true,
        waveform: 'triangle',
        frequency: 329.63,
        volume: 0.25,
        phase: 0
      },
      {
        id: 'target-3',
        enabled: true,
        waveform: 'sine',
        frequency: 392,
        volume: 0.2,
        phase: 0
      }
    ]
  },
  {
    id: 'level-6',
    name: '终极合成',
    description: '四个振荡器的复杂音色混合。包含多种波形和精确的频率关系。',
    difficulty: 3,
    passThreshold: 60,
    unlocked: true,
    hint: '提示：基础音 + 八度音 + 五度音 + 一个调制用的锯齿波',
    targetOscillators: [
      {
        id: 'target-1',
        enabled: true,
        waveform: 'sine',
        frequency: 220,
        volume: 0.25,
        phase: 0
      },
      {
        id: 'target-2',
        enabled: true,
        waveform: 'sine',
        frequency: 440,
        volume: 0.2,
        phase: 0
      },
      {
        id: 'target-3',
        enabled: true,
        waveform: 'square',
        frequency: 330,
        volume: 0.15,
        phase: 0
      },
      {
        id: 'target-4',
        enabled: true,
        waveform: 'sawtooth',
        frequency: 110,
        volume: 0.1,
        phase: 0
      }
    ]
  }
];

export const getDefaultOscillators = (count: number = 4) => {
  return Array.from({ length: count }, (_, i) => ({
    id: `osc-${i + 1}`,
    enabled: i === 0,
    waveform: 'sine' as const,
    frequency: 440,
    volume: i === 0 ? 0.5 : 0,
    phase: 0
  }));
};

import { TestTrack } from '../types/calibration';

export const TEST_TRACKS: TestTrack[] = [
  {
    id: 'blank-groove',
    name: '空白带',
    difficulty: 'easy',
    description: '标准测试音轨，无信号的空白音轨',
    difficultyFactor: 1.0,
  },
  {
    id: '1khz-tone',
    name: '1kHz测试音',
    difficulty: 'medium',
    description: '标准1kHz正弦波测试信号',
    difficultyFactor: 1.2,
  },
  {
    id: 'silent-passage',
    name: '沉默段落',
    difficulty: 'hard',
    description: '包含微动态和弱信号的复杂段落',
    difficultyFactor: 1.5,
  },
  {
    id: 'high-freq-sweep',
    name: '高频扫频',
    difficulty: 'hard',
    description: '20Hz-20kHz扫频信号，测试频率响应',
    difficultyFactor: 1.6,
  },
  {
    id: 'low-freq-drums',
    name: '低频鼓声',
    difficulty: 'medium',
    description: '包含强烈低频瞬态的鼓乐段落',
    difficultyFactor: 1.3,
  },
];

export const getTrackById = (id: string): TestTrack => {
  return TEST_TRACKS.find(t => t.id === id) || TEST_TRACKS[0];
};

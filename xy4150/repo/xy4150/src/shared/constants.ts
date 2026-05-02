import { HandAction } from './types';

export const HAND_ACTIONS: HandAction[] = [
  {
    id: 'fist',
    type: 'fist',
    label: '握拳',
    description: '手指弯曲，握紧拳头',
  },
  {
    id: 'palm',
    type: 'palm',
    label: '张掌',
    description: '手指伸直，手掌张开',
  },
  {
    id: 'pinch',
    type: 'pinch',
    label: '捏合',
    description: '拇指与其他手指轻轻捏合',
  },
];

export const ACTION_TYPE_TO_LABEL: Record<string, string> = {
  fist: '握拳',
  palm: '张掌',
  pinch: '捏合',
};

export const KEYBOARD_MAPPINGS: Record<string, string> = {
  KeyF: 'fist',
  KeyP: 'palm',
  KeyN: 'pinch',
  Space: 'pause',
};

export const DEFAULT_BPM = 60;
export const DEFAULT_BEATS_PER_MEASURE = 4;
export const DEFAULT_REPEAT_COUNT = 3;

export const MIN_BPM = 40;
export const MAX_BPM = 180;
export const MIN_BEATS_PER_MEASURE = 2;
export const MAX_BEATS_PER_MEASURE = 8;

export const COUNTDOWN_SECONDS = 3;

export const MAX_TIMING_TOLERANCE_MS = 500;
export const IDEAL_TIMING_TOLERANCE_MS = 100;

export const PAIN_LEVELS = [
  { value: 0, label: '无疼痛' },
  { value: 1, label: '轻微' },
  { value: 2, label: '轻度' },
  { value: 3, label: '中度' },
  { value: 4, label: '较重' },
  { value: 5, label: '严重' },
];

export const SCORE_WEIGHTS = {
  accuracy: 0.5,
  timing: 0.3,
  rhythm: 0.2,
};

import type { GameConfig } from '../types';

export const DEFAULT_CONFIG: GameConfig = {
  id: 'default-bridge-load-v1',
  name: '桥梁载荷闯关 - 标准模式',
  totalRounds: 10,
  maxLoad: 1000,
  targetLoad: 800,
  loadPerRound: 80,
  timeLimitPerRound: 5000,
  boundaryThreshold: 5,
  duplicateWindow: 3000,
  misoperationThreshold: 300,
  slowOperationThreshold: 5000,
  ruleViolationPatterns: ['超过', '超了', '不对', '错', '违规', '无效'],
  createdBy: '系统默认',
  createdAt: Date.now(),
};

export const TEST_CONFIG_WITH_ERRORS: GameConfig = {
  id: 'test-bad-config',
  name: '',
  totalRounds: 0,
  maxLoad: -100,
  targetLoad: 2000,
  loadPerRound: 100,
  timeLimitPerRound: 500,
  boundaryThreshold: 60,
  duplicateWindow: 3000,
  misoperationThreshold: 300,
  slowOperationThreshold: 5000,
  ruleViolationPatterns: [],
  createdBy: '测试',
  createdAt: Date.now(),
};

export const FLAG_COLORS: Record<string, string> = {
  normal: 'bg-emerald-500',
  empty: 'bg-amber-500',
  duplicate: 'bg-orange-500',
  boundary: 'bg-blue-500',
  misoperation: 'bg-purple-500',
  interrupted: 'bg-red-500',
};

export const OPERATOR = '课堂组织者';
export const CONFIG_VERSION = 'v1.0';

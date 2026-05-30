import type { RatingLevelConfig, AnomalyTypeConfig } from '@/types';

export const RATING_LEVELS: RatingLevelConfig[] = [
  { level: 'AAA', score: 7, riskWeight: 0.1, color: '#2A9D8F' },
  { level: 'AA', score: 6, riskWeight: 0.2, color: '#4CAF50' },
  { level: 'A', score: 5, riskWeight: 0.35, color: '#8BC34A' },
  { level: 'BBB', score: 4, riskWeight: 0.5, color: '#CDDC39' },
  { level: 'BB', score: 3, riskWeight: 0.7, color: '#FFC107' },
  { level: 'B', score: 2, riskWeight: 0.85, color: '#FF9800' },
  { level: 'CCC', score: 1, riskWeight: 1.0, color: '#E63946' },
] as const;

export const ANOMALY_TYPES: Record<string, AnomalyTypeConfig> = {
  DATA_ISSUE: {
    code: 'DATA_ISSUE',
    label: '数据问题',
    color: '#D62828',
    icon: '🔴',
    examples: [
      '评级倒退超过3档',
      '净值计算不一致',
      '债券市值异常波动',
    ],
  },
  RULE_ISSUE: {
    code: 'RULE_ISSUE',
    label: '规则问题',
    color: '#F77F00',
    icon: '🟠',
    examples: [
      '同一新闻重复触发评级',
      '评级调整与新闻方向矛盾',
      '违反评级调整间隔规则',
    ],
  },
  MATERIAL_ISSUE: {
    code: 'MATERIAL_ISSUE',
    label: '材料问题',
    color: '#FCBF49',
    icon: '🟡',
    examples: [
      '调整理由为空',
      '必要评级依据未填写',
      '缺少关键参考材料',
    ],
  },
} as const;

export const SCORING_RULES = {
  perfectMatch: 100,
  directionCorrect: 50,
  nearMiss: 30,
  wrongDirection: -50,
  timeoutPenalty: -30,
  anomalyPenalty: -20,
  speedBonus: 20,
  speedBonusThreshold: 0.5,
  correctBonus: 5,
  wrongPenalty: -10,
  trustCorrectBonus: 5,
  trustWrongPenalty: -5,
  trustTimeoutPenalty: -10,
  trustAnomalyPenalty: -5,
} as const;

export type ScoringRules = typeof SCORING_RULES;

export const GAME_CONFIG = {
  TOTAL_ROUNDS: 5,
  INITIAL_NAV: 10000000,
  INITIAL_CASH: 1000000,
  INITIAL_TRUST: 80,
  TIME_LIMITS: {
    tutorial: 90,
    standard: 60,
    sample: 60,
  },
  standardTimeLimit: 60,
  tutorialTimeLimit: 90,
  RATING_REGRESSION_THRESHOLD: 3,
  MIN_REASON_LENGTH: 5,
  SCORING: SCORING_RULES,
  TRUST: {
    correctBonus: SCORING_RULES.trustCorrectBonus,
    wrongPenalty: SCORING_RULES.trustWrongPenalty,
    timeoutPenalty: SCORING_RULES.trustTimeoutPenalty,
    anomalyPenalty: SCORING_RULES.trustAnomalyPenalty,
  },
} as const;

export const getRatingLevel = (rating: string): RatingLevelConfig => {
  return RATING_LEVELS.find((r) => r.level === rating) || RATING_LEVELS[3];
};

export const getRatingScore = (rating: string): number => {
  return getRatingLevel(rating).score;
};

export const getRiskWeight = (rating: string): number => {
  return getRatingLevel(rating).riskWeight;
};

export const getRatingColor = (rating: string): string => {
  return getRatingLevel(rating).color;
};

export const getRatingDelta = (oldRating: string, newRating: string): number => {
  return getRatingScore(newRating) - getRatingScore(oldRating);
};

export const isRatingDowngrade = (oldRating: string, newRating: string): boolean => {
  return getRatingDelta(oldRating, newRating) < 0;
};

export const isRatingUpgrade = (oldRating: string, newRating: string): boolean => {
  return getRatingDelta(oldRating, newRating) > 0;
};

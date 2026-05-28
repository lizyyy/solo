export const GAME_CONFIG = {
  TOTAL_TIME: 600,
  TIME_SCALES: [1, 2, 4] as const,
  DEFAULT_TIME_SCALE: 1,
  MOVE_SPEED: 50,
  DECISION_TIME_COST: 10,
  ANOMALY_COUNT_MIN: 3,
  ANOMALY_COUNT_MAX: 5,
  TRUE_ANOMALY_RATIO: 0.7,
  CORNER_CHECK_RADIUS: 30,
} as const;

export const SCORE_CONFIG = {
  MAX_TOTAL: 100,
  ACCURACY: {
    MAX: 40,
    CORRECT_BONUS: 10,
    WRONG_PENALTY: 15,
  },
  COVERAGE: {
    MAX: 20,
    FULL_COVERAGE_BONUS: 20,
    MISSED_CORNER_PENALTY: 5,
  },
  TIMELINESS: {
    MAX: 20,
    FAST_BONUS: 5,
    FAST_THRESHOLD: 30,
    SLOW_PENALTY: 5,
    SLOW_THRESHOLD: 120,
  },
  FALSE_ALARM: {
    MAX: 10,
    CORRECT_IDENTIFY_BONUS: 10,
    WRONG_MISS_PENALTY: 10,
  },
  CROSS_VALIDATION: {
    MAX: 10,
    GOOD_BONUS: 10,
    GOOD_THRESHOLD: 3,
    BAD_PENALTY: 5,
    BAD_THRESHOLD: 1,
  },
} as const;

export const ANOMALY_WEIGHTS: Record<string, number> = {
  missed_corner: 30,
  door_false_alarm: 30,
  art_vibration: 30,
  light_abnormal: 10,
} as const;

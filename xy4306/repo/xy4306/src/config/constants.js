const path = require('path');

const CONFIG = {
  TEMPERATURE: {
    THRESHOLD: {
      SAFE_MAX: 4,
      DANGER_MAX: 8,
      MIN: -20
    },
    RULES: {
      CONTINUOUS_OVERTEMP_MINUTES: 30,
      SHORT_FLUCTUATION_MINUTES: 10,
      SENSOR_GAP_MINUTES: 60,
      DRIFT_THRESHOLD: 2
    },
    SAMPLING_INTERVAL_MINUTES: 5
  },
  DOOR: {
    ACCEPTABLE_OPEN_MINUTES: 5,
    IMPACT_DURATION_AFTER_CLOSE_MINUTES: 30
  },
  ANALYSIS: {
    MERGE_GAP_MINUTES: 5
  },
  OUTPUT: {
    CHARTS_FOLDER: 'charts',
    REPORTS_FOLDER: 'reports',
    ISSUES_FOLDER: 'issues'
  },
  PATHS: {
    DATA_DIR: path.join(__dirname, '../../data'),
    OUTPUT_DIR: path.join(__dirname, '../../output'),
    SAMPLE_DATA_DIR: path.join(__dirname, '../../data/sample')
  }
};

const ISSUE_TYPES = {
  CONTINUOUS_OVERTEMP: 'continuous_overtemp',
  SHORT_FLUCTUATION: 'short_fluctuation',
  DOOR_OPEN_EXCEEDED: 'door_open_exceeded',
  SENSOR_GAP: 'sensor_gap',
  SENSOR_DRIFT: 'sensor_drift',
  NOTE_MENTIONED: 'note_mentioned'
};

const ISSUE_SEVERITY = {
  CRITICAL: 'critical',
  HIGH: 'high',
  MEDIUM: 'medium',
  LOW: 'low'
};

const ISSUE_DESCRIPTIONS = {
  [ISSUE_TYPES.CONTINUOUS_OVERTEMP]: '连续超温',
  [ISSUE_TYPES.SHORT_FLUCTUATION]: '短时波动（可能与开门相关）',
  [ISSUE_TYPES.DOOR_OPEN_EXCEEDED]: '开门时间超出合理范围',
  [ISSUE_TYPES.SENSOR_GAP]: '传感器数据断点',
  [ISSUE_TYPES.SENSOR_DRIFT]: '传感器漂移',
  [ISSUE_TYPES.NOTE_MENTIONED]: '人工备注提及的异常'
};

module.exports = {
  CONFIG,
  ISSUE_TYPES,
  ISSUE_SEVERITY,
  ISSUE_DESCRIPTIONS
};

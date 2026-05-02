export const TASK_TYPES = {
  RESCUE: 'rescue',
  HOSPITAL: 'hospital',
  STATION: 'station'
};

export const PRIORITY_LEVELS = {
  HIGH: 'high',
  MEDIUM: 'medium',
  LOW: 'low'
};

export const TASK_TYPE_INFO = {
  [TASK_TYPES.RESCUE]: {
    name: '救援队',
    icon: '🚒',
    defaultPriority: PRIORITY_LEVELS.HIGH,
    color: '#ff6363',
    powerConsumption: 15,
    coverageRadius: 3
  },
  [TASK_TYPES.HOSPITAL]: {
    name: '医院',
    icon: '🏥',
    defaultPriority: PRIORITY_LEVELS.HIGH,
    color: '#64ff96',
    powerConsumption: 10,
    coverageRadius: 5
  },
  [TASK_TYPES.STATION]: {
    name: '临时基站',
    icon: '📡',
    defaultPriority: PRIORITY_LEVELS.MEDIUM,
    color: '#ffc863',
    powerConsumption: 20,
    coverageRadius: 8
  }
};

export const PRIORITY_WEIGHTS = {
  [PRIORITY_LEVELS.HIGH]: 3,
  [PRIORITY_LEVELS.MEDIUM]: 2,
  [PRIORITY_LEVELS.LOW]: 1
};

export const SCORING_RULES = {
  TASK_PLACED: 100,
  HIGH_PRIORITY_FIRST: 50,
  NO_INTERFERENCE: 200,
  COVERAGE_EFFICIENT: 100,
  POWER_EFFICIENT: 50,
  INTERFERENCE_PENALTY: -150,
  DUPLICATE_PENALTY: -100,
  LOW_COVERAGE_PENALTY: -75,
  HIGH_POWER_PENALTY: -50
};

export const STORAGE_KEYS = {
  GAME_SAVES: 'emergency_scheduler_saves',
  LEADERBOARD: 'emergency_scheduler_leaderboard',
  CURRENT_STATE: 'emergency_scheduler_current',
  SAVE_VERSION: '1.0.0'
};

export const GAME_STATES = {
  IDLE: 'idle',
  PLAYING: 'playing',
  PAUSED: 'paused',
  COMPLETED: 'completed',
  ERROR: 'error'
};

export const MAX_HISTORY_LENGTH = 50;
export const MAX_SAVES = 10;

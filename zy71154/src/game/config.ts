import type { UserPriority, WeatherType, Weather } from './types';

export const PRIORITY_CONFIG: Record<UserPriority, {
  name: string;
  maxOutageTime: number;
  scoreMultiplier: number;
  penaltyPerTurn: number;
  color: string;
}> = {
  critical: {
    name: '特级保障',
    maxOutageTime: 3,
    scoreMultiplier: 10,
    penaltyPerTurn: 50,
    color: '#e53e3e'
  },
  important: {
    name: '重要用户',
    maxOutageTime: 5,
    scoreMultiplier: 5,
    penaltyPerTurn: 20,
    color: '#ed8936'
  },
  normal: {
    name: '普通用户',
    maxOutageTime: 10,
    scoreMultiplier: 2,
    penaltyPerTurn: 5,
    color: '#38a169'
  }
};

export const WEATHER_CONFIG: Record<WeatherType, Weather> = {
  clear: {
    type: 'clear',
    duration: 3,
    damageMultiplier: 0,
    repairPenalty: 0,
    description: '晴朗',
    icon: '☀️'
  },
  rain: {
    type: 'rain',
    duration: 2,
    damageMultiplier: 0.1,
    repairPenalty: 0.2,
    description: '小雨',
    icon: '🌧️'
  },
  storm: {
    type: 'storm',
    duration: 2,
    damageMultiplier: 0.3,
    repairPenalty: 0.4,
    description: '暴风雨',
    icon: '⛈️'
  },
  heavy_storm: {
    type: 'heavy_storm',
    duration: 1,
    damageMultiplier: 0.5,
    repairPenalty: 0.6,
    description: '强风暴',
    icon: '🌪️'
  }
};

export const TEAM_STATUS_CONFIG: Record<string, {
  name: string;
  color: string;
}> = {
  idle: {
    name: '待命',
    color: '#38a169'
  },
  moving: {
    name: '移动中',
    color: '#3182ce'
  },
  repairing: {
    name: '抢修中',
    color: '#ed8936'
  },
  cooling: {
    name: '休整中',
    color: '#718096'
  }
};

export const NODE_STATUS_CONFIG: Record<string, {
  name: string;
  color: string;
}> = {
  operational: {
    name: '正常运行',
    color: '#38a169'
  },
  damaged: {
    name: '故障',
    color: '#e53e3e'
  },
  repairing: {
    name: '抢修中',
    color: '#ed8936'
  },
  destroyed: {
    name: '损毁',
    color: '#1a202c'
  }
};

export const GAME_CONFIG = {
  victoryConditions: {
    criticalUsersPowered: 1,
    importantUsersPowered: 1,
    normalUsersPoweredRatio: 0.9
  },
  defeatConditions: {
    criticalUserMaxOutage: true,
    maxImportantUsersOutage: 2,
    maxOutageRatio: 0.8,
    maxOutageRatioTurns: 3,
    maxTurns: true
  },
  scoring: {
    baseScorePerUser: 10,
    speedBonusPerTurn: 50,
    difficultyMultiplier: {
      easy: 0.7,
      normal: 1,
      hard: 1.5
    }
  },
  team: {
    defaultCooldown: 1,
    defaultEfficiency: 1
  }
};

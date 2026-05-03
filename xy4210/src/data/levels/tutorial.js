/**
 * 教程关卡数据
 */

import {
  UnitType,
  EventType,
  CellType
} from '../../types/index.js';

export const TutorialLevel = {
  name: '救援调度夜班 - 教程',
  description: '欢迎来到救援调度夜班！学习如何调度单位处理各种紧急事件。',
  config: {
    mapWidth: 10,
    mapHeight: 10,
    initialReputation: 100,
    maxTurns: 30,
    eventDrawsPerTurn: 1
  },
  map: null, // 使用默认地图
  units: [
    {
      type: UnitType.AMBULANCE,
      position: { x: 0, y: 0 }
    },
    {
      type: UnitType.REPAIR,
      position: { x: 9, y: 0 }
    },
    {
      type: UnitType.VOLUNTEER,
      position: { x: 0, y: 9 }
    }
  ],
  initialEvents: [
    {
      type: EventType.INJURY,
      position: { x: 5, y: 5 }
    },
    {
      type: EventType.POWER,
      position: { x: 7, y: 7 }
    }
  ]
};

export const EasyLevel = {
  name: '救援调度夜班 - 简单模式',
  description: '适合新手的简单关卡，事件较少，时间限制较宽松。',
  config: {
    mapWidth: 10,
    mapHeight: 10,
    initialReputation: 100,
    maxTurns: 40,
    eventDrawsPerTurn: 1
  },
  map: null,
  units: [
    {
      type: UnitType.AMBULANCE,
      position: { x: 0, y: 0 }
    },
    {
      type: UnitType.AMBULANCE,
      position: { x: 9, y: 0 }
    },
    {
      type: UnitType.REPAIR,
      position: { x: 0, y: 9 }
    },
    {
      type: UnitType.VOLUNTEER,
      position: { x: 9, y: 9 }
    }
  ],
  initialEvents: [
    {
      type: EventType.INJURY,
      position: { x: 4, y: 4 }
    }
  ]
};

export const MediumLevel = {
  name: '救援调度夜班 - 普通模式',
  description: '中等难度关卡，需要合理规划单位行动。',
  config: {
    mapWidth: 10,
    mapHeight: 10,
    initialReputation: 80,
    maxTurns: 30,
    eventDrawsPerTurn: 1
  },
  map: null,
  units: [
    {
      type: UnitType.AMBULANCE,
      position: { x: 0, y: 0 }
    },
    {
      type: UnitType.REPAIR,
      position: { x: 9, y: 0 }
    },
    {
      type: UnitType.VOLUNTEER,
      position: { x: 0, y: 9 }
    }
  ],
  initialEvents: [
    {
      type: EventType.INJURY,
      position: { x: 5, y: 5 }
    },
    {
      type: EventType.BLOCKAGE,
      position: { x: 3, y: 3 }
    },
    {
      type: EventType.POWER,
      position: { x: 7, y: 7 }
    }
  ]
};

export const HardLevel = {
  name: '救援调度夜班 - 困难模式',
  description: '高难度关卡，事件频繁，需要精确调度。',
  config: {
    mapWidth: 10,
    mapHeight: 10,
    initialReputation: 60,
    maxTurns: 25,
    eventDrawsPerTurn: 2
  },
  map: null,
  units: [
    {
      type: UnitType.AMBULANCE,
      position: { x: 0, y: 0 }
    },
    {
      type: UnitType.REPAIR,
      position: { x: 9, y: 0 }
    },
    {
      type: UnitType.VOLUNTEER,
      position: { x: 0, y: 9 }
    }
  ],
  initialEvents: [
    {
      type: EventType.INJURY,
      position: { x: 2, y: 2 }
    },
    {
      type: EventType.INJURY,
      position: { x: 7, y: 7 }
    },
    {
      type: EventType.BLOCKAGE,
      position: { x: 5, y: 5 }
    },
    {
      type: EventType.POWER,
      position: { x: 3, y: 6 }
    },
    {
      type: EventType.SHORTAGE,
      position: { x: 8, y: 3 }
    }
  ]
};

export default TutorialLevel;

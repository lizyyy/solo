/**
 * 游戏类型定义
 */

// 单元格类型
export const CellType = {
  ROAD: 'road',
  BUILDING: 'building',
  BLOCKED: 'blocked'
};

// 单位类型
export const UnitType = {
  AMBULANCE: 'ambulance',
  REPAIR: 'repair',
  VOLUNTEER: 'volunteer'
};

// 事件类型
export const EventType = {
  INJURY: 'injury',
  POWER: 'power',
  BLOCKAGE: 'blockage',
  SHORTAGE: 'shortage'
};

// 单位状态
export const UnitStatus = {
  IDLE: 'idle',
  MOVING: 'moving',
  WORKING: 'working'
};

// 事件状态
export const EventStatus = {
  ACTIVE: 'active',
  RESOLVED: 'resolved',
  EXPIRED: 'expired'
};

// 游戏状态
export const GameStatus = {
  PLAYING: 'playing',
  WON: 'won',
  LOST: 'lost'
};

/**
 * 坐标点
 * @typedef {Object} Position
 * @property {number} x - X坐标
 * @property {number} y - Y坐标
 */

/**
 * 地图单元格
 * @typedef {Object} Cell
 * @property {Position} position - 单元格位置
 * @property {CellType} type - 单元格类型
 * @property {boolean} isBlocked - 是否被堵塞
 * @property {string|null} eventId - 关联的事件ID
 */

/**
 * 游戏单位
 * @typedef {Object} Unit
 * @property {string} id - 单位唯一ID
 * @property {UnitType} type - 单位类型
 * @property {Position} position - 当前位置
 * @property {UnitStatus} status - 单位状态
 * @property {number} speed - 移动速度（每回合可移动的距离）
 * @property {string|null} targetEventId - 目标事件ID
 * @property {Position[]} path - 当前移动路径
 * @property {number} pathIndex - 当前路径索引
 * @property {number} workProgress - 工作进度
 * @property {number} workRequired - 完成工作所需回合数
 */

/**
 * 游戏事件
 * @typedef {Object} GameEvent
 * @property {string} id - 事件唯一ID
 * @property {EventType} type - 事件类型
 * @property {Position} position - 事件位置
 * @property {EventStatus} status - 事件状态
 * @property {number} timeRemaining - 剩余回合数
 * @property {number} initialTime - 初始回合数
 * @property {number} reputationPenalty - 超时扣信誉值
 * @property {string|null} assignedUnitId - 分配的单位ID
 * @property {string} description - 事件描述
 */

/**
 * 事件牌堆
 * @typedef {Object} EventDeck
 * @property {Object[]} cards - 牌堆中的卡牌
 * @property {number} currentIndex - 当前抽取位置
 */

/**
 * 游戏状态
 * @typedef {Object} GameState
 * @property {number} turn - 当前回合
 * @property {number} reputation - 信誉值
 * @property {GameStatus} status - 游戏状态
 * @property {Cell[][]} map - 地图数据
 * @property {Unit[]} units - 单位列表
 * @property {GameEvent[]} events - 事件列表
 * @property {EventDeck} eventDeck - 事件牌堆
 * @property {string} selectedUnitId - 选中的单位ID
 * @property {Position} selectedPosition - 选中的位置
 * @property {Position[]} currentPath - 当前显示的路径
 * @property {string[]} log - 游戏日志
 */

/**
 * 回放步骤
 * @typedef {Object} ReplayStep
 * @property {number} turn - 回合数
 * @property {GameState} state - 游戏状态快照
 * @property {string} action - 执行的动作描述
 */

/**
 * 游戏配置
 * @typedef {Object} GameConfig
 * @property {number} mapWidth - 地图宽度
 * @property {number} mapHeight - 地图高度
 * @property {number} initialReputation - 初始信誉
 * @property {number} maxTurns - 最大回合数
 * @property {number} eventDrawsPerTurn - 每回合抽取事件数
 * @property {Object} unitSpeeds - 单位速度
 * @property {Object} unitWorkTimes - 单位工作时间
 * @property {Object} eventPenalties - 事件惩罚
 * @property {Object} eventTimeLimits - 事件时间限制
 */

// 默认游戏配置
export const DefaultGameConfig = {
  mapWidth: 10,
  mapHeight: 10,
  initialReputation: 100,
  maxTurns: 30,
  eventDrawsPerTurn: 1,
  unitSpeeds: {
    [UnitType.AMBULANCE]: 3,
    [UnitType.REPAIR]: 2,
    [UnitType.VOLUNTEER]: 4
  },
  unitWorkTimes: {
    [UnitType.AMBULANCE]: 2,
    [UnitType.REPAIR]: 3,
    [UnitType.VOLUNTEER]: 1
  },
  eventPenalties: {
    [EventType.INJURY]: 20,
    [EventType.POWER]: 15,
    [EventType.BLOCKAGE]: 10,
    [EventType.SHORTAGE]: 12
  },
  eventTimeLimits: {
    [EventType.INJURY]: 5,
    [EventType.POWER]: 6,
    [EventType.BLOCKAGE]: 4,
    [EventType.SHORTAGE]: 5
  }
};

// 单位类型对应可处理的事件类型
export const UnitEventMapping = {
  [UnitType.AMBULANCE]: [EventType.INJURY],
  [UnitType.REPAIR]: [EventType.POWER, EventType.BLOCKAGE],
  [UnitType.VOLUNTEER]: [EventType.SHORTAGE, EventType.BLOCKAGE]
};

// 事件类型描述
export const EventDescriptions = {
  [EventType.INJURY]: '市民受伤，需要救护车救援',
  [EventType.POWER]: '区域断电，需要维修车修复',
  [EventType.BLOCKAGE]: '道路堵塞，需要疏通',
  [EventType.SHORTAGE]: '物资短缺，需要志愿者配送'
};

/**
 * 游戏状态管理模块
 * 管理游戏状态的初始化、更新和查询
 */

import {
  CellType,
  UnitType,
  EventType,
  UnitStatus,
  EventStatus,
  GameStatus,
  DefaultGameConfig,
  EventDescriptions
} from '../types/index.js';

import {
  generateId,
  deepClone,
  isInBounds,
  checkWinCondition
} from '../rules/gameRules.js';

/**
 * 创建初始游戏状态
 * @param {Object} config - 游戏配置
 * @returns {Object} 初始游戏状态
 */
export function createInitialState(config = DefaultGameConfig) {
  const map = createMap(config.mapWidth, config.mapHeight);
  const units = createInitialUnits(config);
  const eventDeck = createEventDeck();

  return {
    turn: 1,
    reputation: config.initialReputation,
    status: GameStatus.PLAYING,
    map,
    units,
    events: [],
    eventDeck,
    selectedUnitId: null,
    selectedPosition: null,
    currentPath: [],
    log: [],
    config: { ...config }
  };
}

/**
 * 创建地图
 * @param {number} width - 地图宽度
 * @param {number} height - 地图高度
 * @returns {Object[][]} 地图数据
 */
function createMap(width, height) {
  const map = [];
  
  for (let y = 0; y < height; y++) {
    const row = [];
    for (let x = 0; x < width; x++) {
      row.push({
        position: { x, y },
        type: CellType.ROAD,
        isBlocked: false,
        eventId: null
      });
    }
    map.push(row);
  }
  
  // 添加一些建筑（示例）
  const buildingPositions = [
    { x: 2, y: 2 },
    { x: 7, y: 3 },
    { x: 3, y: 6 },
    { x: 8, y: 7 },
    { x: 5, y: 4 }
  ];
  
  buildingPositions.forEach(pos => {
    if (isInBounds(pos, width, height)) {
      map[pos.y][pos.x].type = CellType.BUILDING;
    }
  });
  
  return map;
}

/**
 * 创建初始单位
 * @param {Object} config - 游戏配置
 * @returns {Object[]} 单位列表
 */
function createInitialUnits(config) {
  return [
    {
      id: generateId(),
      type: UnitType.AMBULANCE,
      position: { x: 0, y: 0 },
      status: UnitStatus.IDLE,
      speed: config.unitSpeeds[UnitType.AMBULANCE],
      targetEventId: null,
      path: [],
      pathIndex: 0,
      workProgress: 0,
      workRequired: config.unitWorkTimes[UnitType.AMBULANCE]
    },
    {
      id: generateId(),
      type: UnitType.REPAIR,
      position: { x: 9, y: 0 },
      status: UnitStatus.IDLE,
      speed: config.unitSpeeds[UnitType.REPAIR],
      targetEventId: null,
      path: [],
      pathIndex: 0,
      workProgress: 0,
      workRequired: config.unitWorkTimes[UnitType.REPAIR]
    },
    {
      id: generateId(),
      type: UnitType.VOLUNTEER,
      position: { x: 0, y: 9 },
      status: UnitStatus.IDLE,
      speed: config.unitSpeeds[UnitType.VOLUNTEER],
      targetEventId: null,
      path: [],
      pathIndex: 0,
      workProgress: 0,
      workRequired: config.unitWorkTimes[UnitType.VOLUNTEER]
    }
  ];
}

/**
 * 创建事件牌堆
 * @returns {Object} 事件牌堆
 */
function createEventDeck() {
  const cards = [];
  
  // 创建各种事件卡牌
  const eventTypes = [
    EventType.INJURY,
    EventType.INJURY,
    EventType.INJURY,
    EventType.POWER,
    EventType.POWER,
    EventType.POWER,
    EventType.BLOCKAGE,
    EventType.BLOCKAGE,
    EventType.BLOCKAGE,
    EventType.SHORTAGE,
    EventType.SHORTAGE,
    EventType.SHORTAGE
  ];
  
  eventTypes.forEach(type => {
    cards.push({
      type,
      description: EventDescriptions[type]
    });
  });
  
  // 洗牌
  shuffleArray(cards);
  
  return {
    cards,
    currentIndex: 0
  };
}

/**
 * 洗牌算法
 * @param {Array} array - 要洗牌的数组
 */
function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
}

/**
 * 从牌堆抽取事件
 * @param {Object} gameState - 游戏状态
 * @returns {Object|null} 抽取的事件卡牌（如果牌堆为空则返回null）
 */
export function drawEventCard(gameState) {
  const deck = gameState.eventDeck;
  
  if (deck.currentIndex >= deck.cards.length) {
    // 牌堆已空，重新洗牌
    shuffleArray(deck.cards);
    deck.currentIndex = 0;
  }
  
  const card = deck.cards[deck.currentIndex];
  deck.currentIndex++;
  
  return { ...card };
}

/**
 * 创建事件实例
 * @param {Object} card - 事件卡牌
 * @param {Object} position - 事件位置
 * @param {Object} config - 游戏配置
 * @returns {Object} 事件对象
 */
export function createEvent(card, position, config = DefaultGameConfig) {
  const timeLimit = config.eventTimeLimits[card.type];
  const penalty = config.eventPenalties[card.type];
  
  return {
    id: generateId(),
    type: card.type,
    position: { ...position },
    status: EventStatus.ACTIVE,
    timeRemaining: timeLimit,
    initialTime: timeLimit,
    reputationPenalty: penalty,
    assignedUnitId: null,
    description: card.description
  };
}

/**
 * 根据关卡数据创建游戏状态
 * @param {Object} levelData - 关卡数据
 * @returns {Object} 游戏状态
 */
export function createStateFromLevel(levelData) {
  const config = { ...DefaultGameConfig, ...levelData.config };
  const gameState = createInitialState(config);
  
  // 应用自定义地图
  if (levelData.map) {
    for (let y = 0; y < levelData.map.length; y++) {
      for (let x = 0; x < levelData.map[y].length; x++) {
        if (levelData.map[y][x]) {
          gameState.map[y][x] = {
            ...gameState.map[y][x],
            ...levelData.map[y][x]
          };
        }
      }
    }
  }
  
  // 应用自定义单位
  if (levelData.units) {
    gameState.units = levelData.units.map(unit => ({
      ...unit,
      id: generateId(),
      status: UnitStatus.IDLE,
      path: [],
      pathIndex: 0,
      workProgress: 0,
      workRequired: config.unitWorkTimes[unit.type]
    }));
  }
  
  // 添加初始事件
  if (levelData.initialEvents) {
    levelData.initialEvents.forEach(eventData => {
      const card = {
        type: eventData.type,
        description: EventDescriptions[eventData.type]
      };
      const event = createEvent(card, eventData.position, config);
      gameState.events.push(event);
      
      // 标记地图上的事件位置
      const cell = gameState.map[eventData.position.y]?.[eventData.position.x];
      if (cell) {
        cell.eventId = event.id;
      }
    });
  }
  
  return gameState;
}

/**
 * 更新游戏状态（推进一回合）
 * @param {Object} gameState - 游戏状态
 * @returns {Object} 更新后的游戏状态
 */
export function updateGameState(gameState) {
  const newState = deepClone(gameState);
  
  // 推进所有单位的行动
  updateUnits(newState);
  
  // 更新事件计时
  updateEvents(newState);
  
  // 增加回合数
  newState.turn++;
  
  // 检查游戏结束条件
  newState.status = checkWinCondition(newState, newState.config);
  
  return newState;
}

/**
 * 更新单位状态
 * @param {Object} gameState - 游戏状态
 */
function updateUnits(gameState) {
  gameState.units.forEach(unit => {
    if (unit.status === UnitStatus.MOVING) {
      // 移动中的单位：沿着路径移动
      if (unit.path.length > 0 && unit.pathIndex < unit.path.length) {
        // 每回合移动 speed 步
        const stepsToMove = Math.min(unit.speed, unit.path.length - unit.pathIndex);
        
        for (let i = 0; i < stepsToMove; i++) {
          if (unit.pathIndex < unit.path.length) {
            unit.position = { ...unit.path[unit.pathIndex] };
            unit.pathIndex++;
          }
        }
        
        // 检查是否到达目的地
        if (unit.pathIndex >= unit.path.length) {
          unit.status = UnitStatus.IDLE;
          unit.path = [];
          unit.pathIndex = 0;
          
          gameState.log.push({
            type: 'action',
            message: `单位到达位置 (${unit.position.x}, ${unit.position.y})`,
            turn: gameState.turn
          });
        }
      }
    } else if (unit.status === UnitStatus.WORKING) {
      // 工作中的单位：增加工作进度
      unit.workProgress++;
      
      if (unit.workProgress >= unit.workRequired) {
        // 完成工作
        completeUnitWork(gameState, unit);
      }
    }
  });
}

/**
 * 完成单位工作
 * @param {Object} gameState - 游戏状态
 * @param {Object} unit - 单位
 */
function completeUnitWork(gameState, unit) {
  unit.status = UnitStatus.IDLE;
  unit.workProgress = 0;
  
  // 找到并标记事件为已解决
  const event = gameState.events.find(e => e.id === unit.targetEventId);
  if (event) {
    event.status = EventStatus.RESOLVED;
    event.assignedUnitId = null;
    
    // 清理地图上的事件标记
    const cell = gameState.map[event.position.y]?.[event.position.x];
    if (cell) {
      cell.eventId = null;
    }
    
    // 给予奖励
    gameState.reputation = Math.min(100, gameState.reputation + 5);
    
    gameState.log.push({
      type: 'action',
      message: `事件解决: ${event.description}，信誉 +5`,
      turn: gameState.turn
    });
  }
  
  unit.targetEventId = null;
}

/**
 * 更新事件状态
 * @param {Object} gameState - 游戏状态
 */
function updateEvents(gameState) {
  gameState.events.forEach(event => {
    if (event.status === EventStatus.ACTIVE) {
      event.timeRemaining--;
      
      if (event.timeRemaining <= 0) {
        // 事件超时
        event.status = EventStatus.EXPIRED;
        
        // 扣除信誉
        gameState.reputation = Math.max(0, gameState.reputation - event.reputationPenalty);
        
        // 清理地图上的事件标记
        const cell = gameState.map[event.position.y]?.[event.position.x];
        if (cell) {
          cell.eventId = null;
        }
        
        gameState.log.push({
          type: 'warning',
          message: `事件超时: ${event.description}，信誉 -${event.reputationPenalty}`,
          turn: gameState.turn
        });
        
        // 如果是堵塞事件，需要保持道路堵塞状态
        if (event.type === EventType.BLOCKAGE) {
          const eventCell = gameState.map[event.position.y]?.[event.position.x];
          if (eventCell) {
            eventCell.isBlocked = true;
            eventCell.type = CellType.BLOCKED;
          }
        }
      }
    }
  });
}

/**
 * 获取单位
 * @param {Object} gameState - 游戏状态
 * @param {string} unitId - 单位ID
 * @returns {Object|null} 单位对象
 */
export function getUnit(gameState, unitId) {
  return gameState.units.find(u => u.id === unitId) || null;
}

/**
 * 获取事件
 * @param {Object} gameState - 游戏状态
 * @param {string} eventId - 事件ID
 * @returns {Object|null} 事件对象
 */
export function getEvent(gameState, eventId) {
  return gameState.events.find(e => e.id === eventId) || null;
}

/**
 * 获取活跃事件
 * @param {Object} gameState - 游戏状态
 * @returns {Object[]} 活跃事件列表
 */
export function getActiveEvents(gameState) {
  return gameState.events.filter(e => e.status === EventStatus.ACTIVE);
}

/**
 * 获取牌堆剩余卡牌数
 * @param {Object} gameState - 游戏状态
 * @returns {number} 剩余卡牌数
 */
export function getDeckRemaining(gameState) {
  return gameState.eventDeck.cards.length - gameState.eventDeck.currentIndex;
}

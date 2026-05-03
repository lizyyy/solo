/**
 * 游戏规则模块
 * 定义游戏的核心规则和逻辑
 */

import {
  UnitType,
  EventType,
  UnitStatus,
  EventStatus,
  GameStatus,
  DefaultGameConfig,
  UnitEventMapping
} from '../types/index.js';

/**
 * 检查单位是否可以处理特定事件
 * @param {UnitType} unitType - 单位类型
 * @param {EventType} eventType - 事件类型
 * @returns {boolean} 是否可以处理
 */
export function canUnitHandleEvent(unitType, eventType) {
  const allowedEvents = UnitEventMapping[unitType] || [];
  return allowedEvents.includes(eventType);
}

/**
 * 检查游戏胜负条件
 * @param {Object} gameState - 游戏状态
 * @param {Object} config - 游戏配置
 * @returns {GameStatus} 游戏状态
 */
export function checkWinCondition(gameState, config = DefaultGameConfig) {
  // 检查是否失败
  if (gameState.reputation <= 0) {
    return GameStatus.LOST;
  }

  // 检查是否达到最大回合数
  if (gameState.turn >= config.maxTurns) {
    // 检查是否还有未解决的紧急事件
    const activeEvents = gameState.events.filter(e => e.status === EventStatus.ACTIVE);
    const urgentEvents = activeEvents.filter(e => e.timeRemaining <= 2);
    
    if (urgentEvents.length > 0) {
      // 如果有紧急事件未解决，可能失败
      // 这里可以根据信誉值决定
      if (gameState.reputation < 50) {
        return GameStatus.LOST;
      }
    }
    
    // 达到最大回合数，根据信誉值判断
    return gameState.reputation >= 50 ? GameStatus.WON : GameStatus.LOST;
  }

  return GameStatus.PLAYING;
}

/**
 * 计算事件超时惩罚
 * @param {Object} event - 事件对象
 * @returns {number} 惩罚值
 */
export function calculateEventPenalty(event) {
  return event.reputationPenalty;
}

/**
 * 检查两个位置是否相邻
 * @param {Object} pos1 - 位置1
 * @param {Object} pos2 - 位置2
 * @returns {boolean} 是否相邻
 */
export function isAdjacent(pos1, pos2) {
  const dx = Math.abs(pos1.x - pos2.x);
  const dy = Math.abs(pos1.y - pos2.y);
  return (dx === 1 && dy === 0) || (dx === 0 && dy === 1);
}

/**
 * 计算曼哈顿距离
 * @param {Object} pos1 - 位置1
 * @param {Object} pos2 - 位置2
 * @returns {number} 曼哈顿距离
 */
export function manhattanDistance(pos1, pos2) {
  return Math.abs(pos1.x - pos2.x) + Math.abs(pos1.y - pos2.y);
}

/**
 * 检查位置是否在地图范围内
 * @param {Object} pos - 位置
 * @param {number} width - 地图宽度
 * @param {number} height - 地图高度
 * @returns {boolean} 是否在范围内
 */
export function isInBounds(pos, width, height) {
  return pos.x >= 0 && pos.x < width && pos.y >= 0 && pos.y < height;
}

/**
 * 检查单元格是否可通行
 * @param {Object} cell - 单元格
 * @returns {boolean} 是否可通行
 */
export function isPassable(cell) {
  if (cell.isBlocked) {
    return false;
  }
  return true;
}

/**
 * 检查单位是否可以移动到某个位置
 * @param {Object} unit - 单位
 * @param {Object} targetPos - 目标位置
 * @param {Object} gameState - 游戏状态
 * @returns {boolean} 是否可以移动
 */
export function canMoveTo(unit, targetPos, gameState) {
  if (unit.status !== UnitStatus.IDLE) {
    return false;
  }

  const cell = gameState.map[targetPos.y]?.[targetPos.x];
  if (!cell) {
    return false;
  }

  return isPassable(cell);
}

/**
 * 检查单位是否可以开始处理事件
 * @param {Object} unit - 单位
 * @param {Object} event - 事件
 * @returns {boolean} 是否可以处理
 */
export function canStartWorking(unit, event) {
  if (unit.status !== UnitStatus.IDLE) {
    return false;
  }

  if (event.status !== EventStatus.ACTIVE) {
    return false;
  }

  if (!canUnitHandleEvent(unit.type, event.type)) {
    return false;
  }

  // 检查单位是否在事件位置
  if (unit.position.x !== event.position.x || unit.position.y !== event.position.y) {
    return false;
  }

  return true;
}

/**
 * 应用事件超时惩罚
 * @param {Object} gameState - 游戏状态
 * @param {Object} event - 事件
 * @returns {Object} 更新后的游戏状态
 */
export function applyEventPenalty(gameState, event) {
  const penalty = calculateEventPenalty(event);
  gameState.reputation = Math.max(0, gameState.reputation - penalty);
  
  gameState.log.push({
    type: 'warning',
    message: `事件超时: ${event.description}，信誉 -${penalty}`,
    turn: gameState.turn
  });

  return gameState;
}

/**
 * 解决事件后的奖励
 * @param {Object} gameState - 游戏状态
 * @param {Object} event - 事件
 * @returns {Object} 更新后的游戏状态
 */
export function resolveEventReward(gameState, event) {
  // 可以根据事件类型给予不同的奖励
  const baseReward = 5;
  
  gameState.reputation = Math.min(100, gameState.reputation + baseReward);
  
  gameState.log.push({
    type: 'action',
    message: `事件解决: ${event.description}，信誉 +${baseReward}`,
    turn: gameState.turn
  });

  return gameState;
}

/**
 * 生成唯一ID
 * @returns {string} 唯一ID
 */
export function generateId() {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * 比较两个位置是否相同
 * @param {Object} pos1 - 位置1
 * @param {Object} pos2 - 位置2
 * @returns {boolean} 是否相同
 */
export function positionsEqual(pos1, pos2) {
  return pos1.x === pos2.x && pos1.y === pos2.y;
}

/**
 * 深拷贝对象
 * @param {Object} obj - 要拷贝的对象
 * @returns {Object} 拷贝后的对象
 */
export function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

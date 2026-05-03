/**
 * 单位管理模块
 * 管理单位的移动、工作和状态更新
 */

import {
  UnitStatus,
  EventStatus,
  DefaultGameConfig
} from '../types/index.js';

import {
  deepClone,
  positionsEqual,
  canUnitHandleEvent,
  canStartWorking
} from '../rules/gameRules.js';

import {
  findPath
} from '../pathfinding/pathfinder.js';

/**
 * 移动单位到指定位置
 * @param {Object} gameState - 游戏状态
 * @param {string} unitId - 单位ID
 * @param {Object} targetPos - 目标位置 {x, y}
 * @returns {Object} 更新后的游戏状态
 */
export function moveUnit(gameState, unitId, targetPos) {
  const newState = deepClone(gameState);
  const unit = newState.units.find(u => u.id === unitId);
  
  if (!unit) {
    return newState;
  }
  
  if (unit.status !== UnitStatus.IDLE) {
    return newState;
  }
  
  // 检查是否已经在目标位置
  if (positionsEqual(unit.position, targetPos)) {
    return newState;
  }
  
  // 计算路径
  const path = findPath(
    unit.position,
    targetPos,
    newState.map,
    newState.config.mapWidth,
    newState.config.mapHeight
  );
  
  if (!path || path.length === 0) {
    newState.log.push({
      type: 'warning',
      message: `无法到达位置 (${targetPos.x}, ${targetPos.y})`,
      turn: newState.turn
    });
    return newState;
  }
  
  // 设置单位路径
  unit.path = path;
  unit.pathIndex = 0;
  unit.status = UnitStatus.MOVING;
  
  newState.log.push({
    type: 'action',
    message: `单位开始移动到 (${targetPos.x}, ${targetPos.y})，路径长度: ${path.length}`,
    turn: newState.turn
  });
  
  return newState;
}

/**
 * 派遣单位处理事件
 * @param {Object} gameState - 游戏状态
 * @param {string} unitId - 单位ID
 * @param {string} eventId - 事件ID
 * @returns {Object} 更新后的游戏状态
 */
export function assignUnitToEvent(gameState, unitId, eventId) {
  const newState = deepClone(gameState);
  const unit = newState.units.find(u => u.id === unitId);
  const event = newState.events.find(e => e.id === eventId);
  
  if (!unit || !event) {
    return newState;
  }
  
  if (unit.status !== UnitStatus.IDLE) {
    return newState;
  }
  
  if (event.status !== EventStatus.ACTIVE) {
    return newState;
  }
  
  if (!canUnitHandleEvent(unit.type, event.type)) {
    newState.log.push({
      type: 'warning',
      message: `该单位无法处理此类型事件`,
      turn: newState.turn
    });
    return newState;
  }
  
  // 计算路径
  const path = findPath(
    unit.position,
    event.position,
    newState.map,
    newState.config.mapWidth,
    newState.config.mapHeight
  );
  
  if (!path || path.length === 0) {
    newState.log.push({
      type: 'warning',
      message: `无法到达事件位置 (${event.position.x}, ${event.position.y})`,
      turn: newState.turn
    });
    return newState;
  }
  
  // 设置单位路径和目标事件
  unit.path = path;
  unit.pathIndex = 0;
  unit.status = UnitStatus.MOVING;
  unit.targetEventId = eventId;
  
  // 标记事件已分配
  event.assignedUnitId = unitId;
  
  newState.log.push({
    type: 'action',
    message: `单位派遣处理事件: ${event.description}`,
    turn: newState.turn
  });
  
  return newState;
}

/**
 * 让单位开始工作（处理事件）
 * @param {Object} gameState - 游戏状态
 * @param {string} unitId - 单位ID
 * @returns {Object} 更新后的游戏状态
 */
export function startUnitWork(gameState, unitId) {
  const newState = deepClone(gameState);
  const unit = newState.units.find(u => u.id === unitId);
  
  if (!unit) {
    return newState;
  }
  
  if (unit.status !== UnitStatus.IDLE) {
    return newState;
  }
  
  // 检查单位是否在某个事件位置
  const event = newState.events.find(e => 
    e.status === EventStatus.ACTIVE &&
    positionsEqual(e.position, unit.position)
  );
  
  if (!event) {
    return newState;
  }
  
  if (!canStartWorking(unit, event)) {
    return newState;
  }
  
  // 开始工作
  unit.status = UnitStatus.WORKING;
  unit.workProgress = 0;
  unit.targetEventId = event.id;
  
  event.assignedUnitId = unitId;
  
  newState.log.push({
    type: 'action',
    message: `单位开始处理事件: ${event.description}`,
    turn: newState.turn
  });
  
  return newState;
}

/**
 * 取消单位的当前任务
 * @param {Object} gameState - 游戏状态
 * @param {string} unitId - 单位ID
 * @returns {Object} 更新后的游戏状态
 */
export function cancelUnitTask(gameState, unitId) {
  const newState = deepClone(gameState);
  const unit = newState.units.find(u => u.id === unitId);
  
  if (!unit) {
    return newState;
  }
  
  if (unit.status === UnitStatus.IDLE) {
    return newState;
  }
  
  // 释放关联的事件
  if (unit.targetEventId) {
    const event = newState.events.find(e => e.id === unit.targetEventId);
    if (event) {
      event.assignedUnitId = null;
    }
  }
  
  // 重置单位状态
  const previousStatus = unit.status;
  unit.status = UnitStatus.IDLE;
  unit.path = [];
  unit.pathIndex = 0;
  unit.workProgress = 0;
  unit.targetEventId = null;
  
  newState.log.push({
    type: 'action',
    message: `单位任务已取消（之前状态: ${previousStatus}）`,
    turn: newState.turn
  });
  
  return newState;
}

/**
 * 获取单位状态描述
 * @param {Object} unit - 单位对象
 * @returns {string} 状态描述
 */
export function getUnitStatusDescription(unit) {
  switch (unit.status) {
    case UnitStatus.IDLE:
      return '待命';
    case UnitStatus.MOVING:
      return `移动中 (剩余 ${unit.path.length - unit.pathIndex} 步)`;
    case UnitStatus.WORKING:
      return `工作中 (进度 ${unit.workProgress}/${unit.workRequired})`;
    default:
      return '未知状态';
  }
}

/**
 * 获取单位类型名称
 * @param {string} unitType - 单位类型
 * @returns {string} 类型名称
 */
export function getUnitTypeName(unitType) {
  const typeNames = {
    ambulance: '救护车',
    repair: '维修车',
    volunteer: '志愿者队伍'
  };
  return typeNames[unitType] || unitType;
}

/**
 * 获取单位图标
 * @param {string} unitType - 单位类型
 * @returns {string} 图标
 */
export function getUnitIcon(unitType) {
  const icons = {
    ambulance: '🚑',
    repair: '🔧',
    volunteer: '🧑‍🤝‍🧑'
  };
  return icons[unitType] || '❓';
}

/**
 * 检查单位是否可以移动
 * @param {Object} unit - 单位对象
 * @returns {boolean} 是否可以移动
 */
export function canUnitMove(unit) {
  return unit.status === UnitStatus.IDLE;
}

/**
 * 检查单位是否可以工作
 * @param {Object} unit - 单位对象
 * @returns {boolean} 是否可以工作
 */
export function canUnitWork(unit) {
  return unit.status === UnitStatus.IDLE;
}

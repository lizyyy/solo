/**
 * 地图渲染组件
 * 负责游戏地图的渲染和交互
 */

import {
  CellType,
  UnitType,
  EventType,
  EventStatus
} from '../types/index.js';

import {
  positionsEqual
} from '../rules/gameRules.js';

import {
  getUnitIcon
} from '../units/unitManager.js';

/**
 * 渲染地图
 * @param {HTMLElement} container - 地图容器
 * @param {Object} gameState - 游戏状态
 * @param {Function} onCellClick - 单元格点击回调
 */
export function renderMap(container, gameState, onCellClick) {
  const { map, units, events, selectedUnitId, currentPath, config } = gameState;
  
  // 清空容器
  container.innerHTML = '';
  
  // 设置网格样式
  container.style.gridTemplateColumns = `repeat(${config.mapWidth}, 50px)`;
  container.style.gridTemplateRows = `repeat(${config.mapHeight}, 50px)`;
  
  // 渲染每个单元格
  for (let y = 0; y < config.mapHeight; y++) {
    for (let x = 0; x < config.mapWidth; x++) {
      const cell = map[y][x];
      const cellElement = createCellElement(cell, gameState, onCellClick);
      container.appendChild(cellElement);
    }
  }
}

/**
 * 创建单元格元素
 * @param {Object} cell - 单元格数据
 * @param {Object} gameState - 游戏状态
 * @param {Function} onCellClick - 点击回调
 * @returns {HTMLElement} 单元格元素
 */
function createCellElement(cell, gameState, onCellClick) {
  const { units, events, selectedUnitId, currentPath } = gameState;
  const { x, y } = cell.position;
  
  const cellElement = document.createElement('div');
  cellElement.className = 'grid-cell';
  cellElement.dataset.x = x;
  cellElement.dataset.y = y;
  
  // 添加单元格类型类
  if (cell.type === CellType.BUILDING) {
    cellElement.classList.add('cell-building');
  } else if (cell.type === CellType.BLOCKED || cell.isBlocked) {
    cellElement.classList.add('cell-blocked');
  } else {
    cellElement.classList.add('cell-road');
  }
  
  // 检查是否有单位
  const unit = units.find(u => 
    u.position.x === x && u.position.y === y
  );
  
  if (unit) {
    cellElement.classList.add(`unit-${unit.type}`);
    
    // 检查是否被选中
    if (selectedUnitId === unit.id) {
      cellElement.classList.add('selected');
    }
  }
  
  // 检查是否在路径上
  if (currentPath && currentPath.some(p => p.x === x && p.y === y)) {
    cellElement.classList.add('path');
  }
  
  // 检查是否有事件
  const event = events.find(e => 
    e.position.x === x && 
    e.position.y === y && 
    e.status === EventStatus.ACTIVE
  );
  
  if (event) {
    cellElement.classList.add(`event-${event.type}`);
  }
  
  // 添加点击事件
  cellElement.addEventListener('click', () => {
    if (onCellClick) {
      onCellClick({ x, y }, unit, event);
    }
  });
  
  return cellElement;
}

/**
 * 获取事件类型名称
 * @param {string} eventType - 事件类型
 * @returns {string} 事件名称
 */
function getEventTypeName(eventType) {
  const typeNames = {
    [EventType.INJURY]: '受伤',
    [EventType.POWER]: '断电',
    [EventType.BLOCKAGE]: '堵塞',
    [EventType.SHORTAGE]: '短缺'
  };
  return typeNames[eventType] || eventType;
}

/**
 * 获取事件图标
 * @param {string} eventType - 事件类型
 * @returns {string} 图标
 */
function getEventIcon(eventType) {
  const icons = {
    [EventType.INJURY]: '🩸',
    [EventType.POWER]: '⚡',
    [EventType.BLOCKAGE]: '🚧',
    [EventType.SHORTAGE]: '📦'
  };
  return icons[eventType] || '❓';
}

/**
 * 高亮路径
 * @param {HTMLElement} container - 地图容器
 * @param {Object[]} path - 路径坐标数组
 */
export function highlightPath(container, path) {
  // 移除所有路径高亮
  container.querySelectorAll('.path').forEach(el => {
    el.classList.remove('path');
  });
  
  if (!path || path.length === 0) {
    return;
  }
  
  // 添加新的路径高亮
  path.forEach(pos => {
    const cell = container.querySelector(`[data-x="${pos.x}"][data-y="${pos.y}"]`);
    if (cell) {
      cell.classList.add('path');
    }
  });
}

/**
 * 选中单元格
 * @param {HTMLElement} container - 地图容器
 * @param {Object} position - 位置 {x, y}
 */
export function selectCell(container, position) {
  // 移除所有选中状态
  container.querySelectorAll('.selected').forEach(el => {
    el.classList.remove('selected');
  });
  
  if (!position) {
    return;
  }
  
  // 选中新单元格
  const cell = container.querySelector(`[data-x="${position.x}"][data-y="${position.y}"]`);
  if (cell) {
    cell.classList.add('selected');
  }
}

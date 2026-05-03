/**
 * 路径计算模块
 * 实现A*寻路算法，考虑道路堵塞
 */

import {
  CellType
} from '../types/index.js';

import {
  isInBounds,
  isPassable,
  positionsEqual,
  manhattanDistance
} from '../rules/gameRules.js';

/**
 * A* 寻路算法
 * @param {Object} start - 起点坐标 {x, y}
 * @param {Object} end - 终点坐标 {x, y}
 * @param {Object[][]} map - 地图数据
 * @param {number} mapWidth - 地图宽度
 * @param {number} mapHeight - 地图高度
 * @returns {Object[]|null} 路径坐标数组，如果无法到达则返回null
 */
export function findPath(start, end, map, mapWidth, mapHeight) {
  // 检查起点和终点是否在地图范围内
  if (!isInBounds(start, mapWidth, mapHeight) || !isInBounds(end, mapWidth, mapHeight)) {
    return null;
  }

  // 检查终点是否可通行
  const endCell = map[end.y][end.x];
  if (!isPassable(endCell)) {
    return null;
  }

  // 开放列表和关闭列表
  const openList = [];
  const closedList = new Set();
  
  // 起点节点
  const startNode = {
    x: start.x,
    y: start.y,
    g: 0,
    h: manhattanDistance(start, end),
    f: manhattanDistance(start, end),
    parent: null
  };
  
  openList.push(startNode);
  
  // 方向：上、下、左、右
  const directions = [
    { x: 0, y: -1 },
    { x: 0, y: 1 },
    { x: -1, y: 0 },
    { x: 1, y: 0 }
  ];
  
  while (openList.length > 0) {
    // 按f值排序，获取f值最小的节点
    openList.sort((a, b) => a.f - b.f);
    const current = openList.shift();
    
    // 检查是否到达终点
    if (current.x === end.x && current.y === end.y) {
      return reconstructPath(current);
    }
    
    // 将当前节点加入关闭列表
    closedList.add(`${current.x},${current.y}`);
    
    // 探索相邻节点
    for (const dir of directions) {
      const neighborX = current.x + dir.x;
      const neighborY = current.y + dir.y;
      
      // 检查是否在地图范围内
      if (!isInBounds({ x: neighborX, y: neighborY }, mapWidth, mapHeight)) {
        continue;
      }
      
      // 检查是否已在关闭列表中
      const neighborKey = `${neighborX},${neighborY}`;
      if (closedList.has(neighborKey)) {
        continue;
      }
      
      // 检查是否可通行
      const neighborCell = map[neighborY][neighborX];
      if (!isPassable(neighborCell)) {
        continue;
      }
      
      // 计算g、h、f值
      const g = current.g + 1;
      const h = manhattanDistance({ x: neighborX, y: neighborY }, end);
      const f = g + h;
      
      // 检查是否已在开放列表中
      const existingNode = openList.find(node => node.x === neighborX && node.y === neighborY);
      
      if (existingNode) {
        // 如果新路径更好，更新节点
        if (g < existingNode.g) {
          existingNode.g = g;
          existingNode.f = f;
          existingNode.parent = current;
        }
      } else {
        // 添加新节点到开放列表
        openList.push({
          x: neighborX,
          y: neighborY,
          g,
          h,
          f,
          parent: current
        });
      }
    }
  }
  
  // 无法到达终点
  return null;
}

/**
 * 重建路径
 * @param {Object} node - 终点节点
 * @returns {Object[]} 路径坐标数组
 */
function reconstructPath(node) {
  const path = [];
  let current = node;
  
  while (current) {
    path.unshift({ x: current.x, y: current.y });
    current = current.parent;
  }
  
  // 移除起点（因为单位已经在起点）
  if (path.length > 1) {
    path.shift();
  }
  
  return path;
}

/**
 * 检查两个位置之间是否有可通行的路径
 * @param {Object} start - 起点
 * @param {Object} end - 终点
 * @param {Object[][]} map - 地图
 * @param {number} mapWidth - 地图宽度
 * @param {number} mapHeight - 地图高度
 * @returns {boolean} 是否有路径
 */
export function hasPath(start, end, map, mapWidth, mapHeight) {
  const path = findPath(start, end, map, mapWidth, mapHeight);
  return path !== null;
}

/**
 * 获取路径长度
 * @param {Object} start - 起点
 * @param {Object} end - 终点
 * @param {Object[][]} map - 地图
 * @param {number} mapWidth - 地图宽度
 * @param {number} mapHeight - 地图高度
 * @returns {number} 路径长度，如果无法到达则返回Infinity
 */
export function getPathLength(start, end, map, mapWidth, mapHeight) {
  const path = findPath(start, end, map, mapWidth, mapHeight);
  return path ? path.length : Infinity;
}

/**
 * 查找最近的可处理事件
 * @param {Object} unit - 单位
 * @param {Object[]} events - 事件列表
 * @param {Object[][]} map - 地图
 * @param {number} mapWidth - 地图宽度
 * @param {number} mapHeight - 地图高度
 * @param {Function} canHandle - 检查单位是否可以处理事件的函数
 * @returns {Object|null} 最近的事件对象
 */
export function findNearestEvent(unit, events, map, mapWidth, mapHeight, canHandle) {
  let nearestEvent = null;
  let shortestPath = Infinity;
  
  for (const event of events) {
    if (canHandle(unit.type, event.type)) {
      const path = findPath(unit.position, event.position, map, mapWidth, mapHeight);
      if (path && path.length < shortestPath) {
        shortestPath = path.length;
        nearestEvent = event;
      }
    }
  }
  
  return nearestEvent;
}

/**
 * 计算单位到达目标位置需要的回合数
 * @param {Object} unit - 单位
 * @param {Object} targetPos - 目标位置
 * @param {Object[][]} map - 地图
 * @param {number} mapWidth - 地图宽度
 * @param {number} mapHeight - 地图高度
 * @returns {number} 需要的回合数，如果无法到达则返回Infinity
 */
export function calculateTurnsToReach(unit, targetPos, map, mapWidth, mapHeight) {
  const path = findPath(unit.position, targetPos, map, mapWidth, mapHeight);
  
  if (!path) {
    return Infinity;
  }
  
  const pathLength = path.length;
  const speed = unit.speed;
  
  // 向上取整计算回合数
  return Math.ceil(pathLength / speed);
}

/**
 * 获取路径上的所有单元格
 * @param {Object[]} path - 路径坐标数组
 * @param {Object[][]} map - 地图
 * @returns {Object[]} 路径上的单元格数组
 */
export function getPathCells(path, map) {
  if (!path) {
    return [];
  }
  
  return path.map(pos => map[pos.y]?.[pos.x]).filter(Boolean);
}

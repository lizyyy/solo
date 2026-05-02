/**
 * 几何计算模块
 * 负责计算可达性、跨度、距离等
 */

import { Vector3, HeightSegments } from './dataModels.js';

// 人体测量学常量（基于身高比例，单位：米）
export const Anthropometrics = {
  // 臂展系数（身高 x 系数 = 臂展）
  ARM_SPAN_RATIO: 1.05,
  
  // 肩宽系数
  SHOULDER_WIDTH_RATIO: 0.25,
  
  // 有效伸展距离（单臂向上伸手）
  REACH_UP_RATIO: 0.38,  // 从肩峰到指尖
  
  // 有效水平伸展（单臂向侧面伸手）
  REACH_SIDE_RATIO: 0.40,
  
  // 步幅系数（腿长）
  LEG_LENGTH_RATIO: 0.45,
  
  // 站立时手可及的最低高度（从地面）
  MIN_REACH_HEIGHT_RATIO: 0.60,
  
  // 站立时手可及的最高高度
  MAX_REACH_HEIGHT_RATIO: 1.30,
};

/**
 * 计算给定身高的攀岩者的可达范围
 * @param {number} heightCm - 身高（厘米）
 * @returns {Object} 可达范围参数
 */
export function calculateReachBounds(heightCm) {
  const heightM = heightCm / 100;
  
  const armSpan = heightM * Anthropometrics.ARM_SPAN_RATIO;
  const shoulderWidth = heightM * Anthropometrics.SHOULDER_WIDTH_RATIO;
  
  // 单侧有效伸展
  const singleArmReach = (armSpan - shoulderWidth) / 2;
  
  // 站立位置（假设重心在墙面前方 0.3 米）
  const standingDepth = 0.3;
  
  // 水平方向最大可达距离（从墙面算起，考虑身体前倾）
  const horizontalReach = singleArmReach + 0.15;  // + 身体前倾补偿
  
  // 垂直方向可达范围
  const minReachHeight = heightM * Anthropometrics.MIN_REACH_HEIGHT_RATIO;
  const maxReachHeight = heightM * Anthropometrics.MAX_REACH_HEIGHT_RATIO;
  
  // 动态动作可达（dyno）- 比静态多约 0.4 米
  const dynoBonus = 0.4;
  
  return {
    heightCm,
    heightM,
    armSpan,
    shoulderWidth,
    singleArmReach,
    horizontalReach,
    minReachHeight,
    maxReachHeight,
    dynoMaxHeight: maxReachHeight + dynoBonus,
    
    // 脚点可达范围
    footReach: {
      // 站立时脚的最低位置（地面）
      minY: 0,
      // 抬腿时脚的最高位置
      maxY: heightM * 0.9,
      // 水平范围
      horizontal: heightM * 0.4
    }
  };
}

/**
 * 计算两个岩点之间的跨度
 * @param {Object} hold1 - 第一个岩点
 * @param {Object} hold2 - 第二个岩点
 * @returns {Object} 跨度信息
 */
export function calculateSpan(hold1, hold2) {
  const pos1 = hold1.position || new Vector3(hold1.x, hold1.y, hold1.z || 0);
  const pos2 = hold2.position || new Vector3(hold2.x, hold2.y, hold2.z || 0);
  
  // 3D 距离
  const distance3D = pos1.distanceTo(pos2);
  
  // 2D 墙面距离（忽略深度）
  const distance2D = pos1.distanceTo2D(pos2);
  
  // 水平分量
  const horizontalSpan = Math.abs(pos1.x - pos2.x);
  
  // 垂直分量
  const verticalSpan = pos2.y - pos1.y;  // 向上为正
  
  // 深度分量（考虑仰角/俯角时的深度）
  const depthSpan = Math.abs(pos1.z - pos2.z);
  
  // 难度系数（基于跨度和方向）
  let difficultyFactor = 1.0;
  
  // 向上移动更难
  if (verticalSpan > 0) {
    difficultyFactor += verticalSpan * 0.5;
  }
  
  // 大跨度更难
  if (distance2D > 0.8) {
    difficultyFactor += (distance2D - 0.8) * 2;
  }
  
  return {
    distance3D,
    distance2D,
    horizontalSpan,
    verticalSpan,
    depthSpan,
    difficultyFactor,
    
    // 描述性文本
    description: _getSpanDescription(distance2D, verticalSpan)
  };
}

/**
 * 获取跨度的描述性文本
 */
function _getSpanDescription(distance2D, verticalSpan) {
  if (distance2D < 0.3) {
    return '极近';
  } else if (distance2D < 0.5) {
    return '近';
  } else if (distance2D < 0.7) {
    return '中等';
  } else if (distance2D < 0.9) {
    return '较远';
  } else if (distance2D < 1.2) {
    return '远';
  } else {
    return '极远';
  }
}

/**
 * 检查一个岩点是否在给定身高的攀岩者可达范围内
 * @param {Object} hold - 要检查的岩点
 * @param {number} heightCm - 身高（厘米）
 * @param {Object} referenceHold - 参考岩点（当前位置），可选
 * @returns {Object} 可达性分析
 */
export function checkReachability(hold, heightCm, referenceHold = null) {
  const bounds = calculateReachBounds(heightCm);
  const holdY = hold.y;
  const holdX = hold.x;
  
  let result = {
    reachable: false,
    confidence: 0,
    type: null,  // 'static', 'dyno', 'unreachable'
    details: {}
  };
  
  if (referenceHold) {
    // 从参考岩点移动
    const span = calculateSpan(referenceHold, hold);
    
    // 静态可达：水平跨度 < 臂展的 70%
    const staticMaxSpan = bounds.singleArmReach * 1.4;  // 双臂可调整
    
    if (span.distance2D <= staticMaxSpan) {
      result.reachable = true;
      result.confidence = Math.max(0.3, 1 - span.distance2D / staticMaxSpan);
      result.type = 'static';
      result.details = {
        span: span,
        maxStaticSpan: staticMaxSpan,
        fromReference: true
      };
    } else if (span.distance2D <= bounds.armSpan) {
      // 可能需要 dyno
      result.reachable = true;
      result.confidence = 0.3;
      result.type = 'dyno';
      result.details = {
        span: span,
        maxDynoSpan: bounds.armSpan,
        fromReference: true
      };
    } else {
      result.reachable = false;
      result.type = 'unreachable';
      result.details = { span };
    }
  } else {
    // 从地面起步
    // 检查垂直范围
    if (holdY >= bounds.minReachHeight && holdY <= bounds.maxReachHeight) {
      // 检查水平位置（假设墙面前是开阔的）
      // 岩点应该在墙面范围内
      result.reachable = true;
      result.confidence = 0.8;
      result.type = 'static';
      result.details = {
        bounds,
        fromGround: true
      };
    } else if (holdY <= bounds.dynoMaxHeight) {
      result.reachable = true;
      result.confidence = 0.4;
      result.type = 'dyno';
      result.details = {
        bounds,
        fromGround: true
      };
    } else {
      result.reachable = false;
      result.type = 'unreachable';
      result.details = {
        bounds,
        holdY,
        fromGround: true
      };
    }
  }
  
  return result;
}

/**
 * 分析整条线路的可达性（按身高分段）
 * @param {Object} route - 线路对象
 * @param {Array} wallHolds - 墙面上的所有岩点
 * @returns {Object} 各身高分段的可达性分析
 */
export function analyzeRouteReachability(route, wallHolds) {
  const holdMap = new Map();
  wallHolds.forEach(h => holdMap.set(h.id, h));
  
  // 获取线路岩点序列（如果有序的话）
  const routeHolds = route.holdIds
    .map(id => holdMap.get(id))
    .filter(h => h !== undefined);
  
  const result = {};
  
  // 对每个身高分段进行分析
  Object.entries(HeightSegments).forEach(([key, segment]) => {
    // 取分段中间值作为代表身高
    const avgHeight = (segment.min + segment.max) / 2;
    
    const segmentAnalysis = analyzeRouteForHeight(routeHolds, avgHeight, route);
    result[key] = {
      segment: segment,
      ...segmentAnalysis
    };
  });
  
  return result;
}

/**
 * 分析线路对特定身高的可达性
 */
function analyzeRouteForHeight(routeHolds, heightCm, route) {
  if (routeHolds.length === 0) {
    return {
      reachable: false,
      issues: ['线路没有岩点'],
      moveAnalysis: []
    };
  }
  
  const issues = [];
  const moveAnalysis = [];
  let allReachable = true;
  
  // 分析起步
  if (route.startHoldId) {
    const startHold = routeHolds.find(h => h.id === route.startHoldId);
    if (startHold) {
      const reachability = checkReachability(startHold, heightCm);
      moveAnalysis.push({
        from: '地面',
        to: '起步点',
        hold: startHold,
        reachability,
        type: 'start'
      });
      
      if (!reachability.reachable) {
        issues.push(`起步点高度 ${(startHold.y * 100).toFixed(0)}cm 对于身高 ${heightCm}cm 可能无法触及`);
        allReachable = false;
      }
    }
  }
  
  // 分析相邻岩点之间的移动
  // 按 Y 坐标排序（从低到高）
  const sortedHolds = [...routeHolds].sort((a, b) => a.y - b.y);
  
  for (let i = 0; i < sortedHolds.length - 1; i++) {
    const fromHold = sortedHolds[i];
    const toHold = sortedHolds[i + 1];
    
    const span = calculateSpan(fromHold, toHold);
    const reachability = checkReachability(toHold, heightCm, fromHold);
    
    moveAnalysis.push({
      from: `岩点 ${i + 1}`,
      to: `岩点 ${i + 2}`,
      fromHold,
      toHold,
      span,
      reachability,
      type: 'move'
    });
    
    if (!reachability.reachable) {
      issues.push(`从高度 ${(fromHold.y * 100).toFixed(0)}cm 到 ${(toHold.y * 100).toFixed(0)}cm 的跨度 ${(span.distance2D * 100).toFixed(0)}cm 可能无法完成`);
      allReachable = false;
    } else if (reachability.type === 'dyno') {
      issues.push(`跨度 ${(span.distance2D * 100).toFixed(0)}cm 可能需要动态动作（dyno）`);
    }
  }
  
  return {
    heightCm,
    reachable: allReachable,
    issues,
    moveAnalysis,
    summary: {
      totalMoves: moveAnalysis.length,
      staticMoves: moveAnalysis.filter(m => m.reachability?.type === 'static').length,
      dynoMoves: moveAnalysis.filter(m => m.reachability?.type === 'dyno').length,
      unreachableMoves: moveAnalysis.filter(m => !m.reachability?.reachable).length
    }
  };
}

/**
 * 计算落地区域
 * @param {Object} wall - 墙面对象
 * @param {Object} route - 线路对象
 * @param {Array} wallHolds - 所有岩点
 * @returns {Object} 落地区域分析
 */
export function calculateLandingZone(wall, route, wallHolds) {
  const holdMap = new Map();
  wallHolds.forEach(h => holdMap.set(h.id, h));
  
  const routeHolds = route.holdIds
    .map(id => holdMap.get(id))
    .filter(h => h !== undefined);
  
  if (routeHolds.length === 0) {
    return {
      valid: false,
      reason: '线路没有岩点',
      bounds: null
    };
  }
  
  // 找到线路的水平范围
  const xValues = routeHolds.map(h => h.x);
  const minX = Math.min(...xValues);
  const maxX = Math.max(...xValues);
  
  // 找到最高岩点（决定落地区域大小）
  const maxY = Math.max(...routeHolds.map(h => h.y));
  
  // 落地区域计算
  // 儿童线路需要更大的安全区域
  const isKids = route.isKidsRoute || wall.isKidsZone;
  
  const baseFrontDepth = isKids ? 2.0 : 1.5;  // 基础前方深度
  const heightBonus = Math.max(0, maxY - 2) * 0.5;  // 高度超过 2 米增加缓冲区
  
  const landingDepth = baseFrontDepth + heightBonus;
  
  // 两侧缓冲区
  const sideBuffer = isKids ? 1.0 : 0.8;
  
  return {
    valid: true,
    bounds: {
      // 相对于墙面左下角
      minX: Math.max(0, minX - sideBuffer),
      maxX: Math.min(wall.width, maxX + sideBuffer),
      // 落地区域在墙面前方
      frontDepth: landingDepth,  // 墙面前方需要清空的距离
    },
    highestPoint: maxY,
    isKidsZone: isKids,
    requirements: {
      // 需要的落地区域大小（米）
      width: (maxX + sideBuffer) - (minX - sideBuffer),
      depth: landingDepth
    }
  };
}

/**
 * 检查两条线路的落地区域是否冲突
 * @param {Object} zone1 - 第一条线路的落地区域
 * @param {Object} zone2 - 第二条线路的落地区域
 * @returns {Object} 冲突分析
 */
export function checkLandingZoneConflict(zone1, zone2) {
  if (!zone1.valid || !zone2.valid) {
    return { conflict: false };
  }
  
  const b1 = zone1.bounds;
  const b2 = zone2.bounds;
  
  // 检查 X 轴范围是否重叠
  const xOverlap = !(b1.maxX < b2.minX || b2.maxX < b1.minX);
  
  if (!xOverlap) {
    return { conflict: false };
  }
  
  // 计算重叠区域
  const overlapMinX = Math.max(b1.minX, b2.minX);
  const overlapMaxX = Math.min(b1.maxX, b2.maxX);
  const overlapWidth = overlapMaxX - overlapMinX;
  
  // 计算最大的落地区域深度要求
  const maxDepth = Math.max(b1.frontDepth, b2.frontDepth);
  
  // 冲突判定
  // 如果重叠区域 > 0.5 米，并且落地区域深度要求有重叠
  const hasConflict = overlapWidth > 0.5;
  
  return {
    conflict: hasConflict,
    overlap: {
      minX: overlapMinX,
      maxX: overlapMaxX,
      width: overlapWidth
    },
    maxDepth,
    severity: hasConflict ? (overlapWidth > 1.0 ? 'high' : 'medium') : 'none'
  };
}

/**
 * 计算线路的难度估算（基于跨度和位置）
 * @param {Object} route - 线路对象
 * @param {Array} wallHolds - 所有岩点
 * @returns {Object} 难度分析
 */
export function estimateDifficulty(route, wallHolds) {
  const holdMap = new Map();
  wallHolds.forEach(h => holdMap.set(h.id, h));
  
  const routeHolds = route.holdIds
    .map(id => holdMap.get(id))
    .filter(h => h !== undefined);
  
  if (routeHolds.length < 2) {
    return {
      estimatedLevel: null,
      reason: '线路岩点不足'
    };
  }
  
  // 按高度排序
  const sortedHolds = [...routeHolds].sort((a, b) => a.y - b.y);
  
  let totalDifficulty = 0;
  let moveCount = 0;
  let maxSpan = 0;
  let maxVertical = 0;
  
  // 分析每个动作
  for (let i = 0; i < sortedHolds.length - 1; i++) {
    const span = calculateSpan(sortedHolds[i], sortedHolds[i + 1]);
    
    totalDifficulty += span.difficultyFactor;
    moveCount++;
    
    if (span.distance2D > maxSpan) maxSpan = span.distance2D;
    if (span.verticalSpan > maxVertical) maxVertical = span.verticalSpan;
  }
  
  // 平均难度
  const avgDifficulty = totalDifficulty / moveCount;
  
  // 最高岩点高度
  const highestY = Math.max(...routeHolds.map(h => h.y));
  
  // 岩点类型影响
  const typeFactors = {
    jug: 0.8,
    crimp: 1.3,
    sloper: 1.2,
    pocket: 1.1,
    pinch: 1.0,
    foot: 0.5,
    volume: 0.9
  };
  
  // 基础难度映射
  // V0: 简单，跨度小，手点好
  // V3: 中等
  // V6: 难
  // V9+: 很难
  
  let levelIndex = 0;
  
  // 平均跨度影响
  if (avgDifficulty > 2.5) levelIndex += 3;
  else if (avgDifficulty > 2.0) levelIndex += 2;
  else if (avgDifficulty > 1.5) levelIndex += 1;
  
  // 最大跨度影响
  if (maxSpan > 1.2) levelIndex += 2;
  else if (maxSpan > 0.9) levelIndex += 1;
  
  // 高度影响（高线路通常更难）
  if (highestY > 3.5) levelIndex += 1;
  
  // 岩点类型影响
  const typePenalty = sortedHolds.reduce((sum, h) => {
    return sum + (typeFactors[h.type] || 1.0);
  }, 0) / sortedHolds.length - 1.0;
  
  levelIndex += Math.round(typePenalty * 2);
  
  // 限制在 V0-V10 范围内
  levelIndex = Math.max(0, Math.min(10, levelIndex));
  
  const levels = ['V0', 'V1', 'V2', 'V3', 'V4', 'V5', 'V6', 'V7', 'V8', 'V9', 'V10'];
  
  return {
    estimatedLevel: levels[levelIndex],
    details: {
      avgDifficulty,
      maxSpan,
      maxVertical,
      highestY,
      moveCount,
      levelIndex
    }
  };
}

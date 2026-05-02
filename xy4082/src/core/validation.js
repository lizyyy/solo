/**
 * 校验规则模块
 * 负责检查颜色重复、落地区冲突、安全距离等
 */

import { ValidationResult, HoldColors } from './dataModels.js';
import { calculateLandingZone, checkLandingZoneConflict, analyzeRouteReachability } from './geometry.js';

/**
 * 校验类型枚举
 */
export const ValidationType = {
  COLOR_CONFLICT: 'color_conflict',
  LANDING_ZONE_CONFLICT: 'landing_zone_conflict',
  KIDS_SAFETY_DISTANCE: 'kids_safety_distance',
  ROUTE_INTEGRITY: 'route_integrity',
  REACHABILITY: 'reachability',
  HOLD_OVERLAP: 'hold_overlap'
};

/**
 * 校验会话中的所有线路
 * @param {Object} session - Session 对象
 * @returns {ValidationResult} 校验结果
 */
export function validateSession(session) {
  const result = new ValidationResult();
  
  if (!session || !session.wall) {
    result.addError('会话中没有墙面数据');
    return result;
  }
  
  const wall = session.wall;
  const routes = session.routes || [];
  const wallHolds = wall.holds || [];
  
  if (routes.length === 0) {
    result.addInfo('当前会话中没有线路');
    return result;
  }
  
  // 1. 检查颜色冲突
  validateColorConflicts(routes, wallHolds, result);
  
  // 2. 检查落地区域冲突
  validateLandingZoneConflicts(wall, routes, wallHolds, result);
  
  // 3. 检查儿童区安全
  validateKidsSafety(wall, routes, wallHolds, result);
  
  // 4. 检查线路完整性
  routes.forEach(route => {
    validateRouteIntegrity(route, wallHolds, result);
  });
  
  // 5. 检查岩点重叠
  validateHoldOverlaps(wallHolds, result);
  
  // 6. 可达性分析（警告级别）
  routes.forEach(route => {
    validateRouteReachability(route, wallHolds, result);
  });
  
  return result;
}

/**
 * 校验颜色冲突
 * 检查同色岩点是否被多条线路使用
 */
function validateColorConflicts(routes, wallHolds, result) {
  const holdColorMap = new Map();
  const holdRouteMap = new Map();
  
  // 建立岩点 -> 颜色映射
  wallHolds.forEach(hold => {
    holdColorMap.set(hold.id, hold.color);
    holdRouteMap.set(hold.id, []);
  });
  
  // 建立岩点 -> 线路映射
  routes.forEach(route => {
    route.holdIds.forEach(holdId => {
      if (holdRouteMap.has(holdId)) {
        holdRouteMap.get(holdId).push({
          routeId: route.id,
          routeName: route.name,
          routeColor: route.color
        });
      }
    });
  });
  
  // 检查：
  // 1. 同一岩点被多条线路使用
  // 2. 不同线路使用了同色岩点（但不是同一个岩点）
  
  const colorUsage = new Map();  // color -> [{routeId, holdIds}]
  
  routes.forEach(route => {
    const routeColors = new Set();
    route.holdIds.forEach(holdId => {
      const holdColor = holdColorMap.get(holdId);
      if (holdColor) {
        routeColors.add(holdColor);
      }
    });
    
    routeColors.forEach(color => {
      if (!colorUsage.has(color)) {
        colorUsage.set(color, []);
      }
      colorUsage.get(color).push({
        routeId: route.id,
        routeName: route.name
      });
    });
  });
  
  // 检查颜色跨线路使用
  colorUsage.forEach((routeInfos, color) => {
    if (routeInfos.length > 1) {
      const colorName = getColorName(color);
      const routeNames = routeInfos.map(r => r.routeName).join('、');
      
      result.addWarning(
        `颜色 ${colorName} 被多条线路使用: ${routeNames}`,
        {
          type: ValidationType.COLOR_CONFLICT,
          color,
          colorName,
          routes: routeInfos
        }
      );
    }
  });
  
  // 检查同一岩点被多条线路使用
  holdRouteMap.forEach((routeInfos, holdId) => {
    if (routeInfos.length > 1) {
      const hold = wallHolds.find(h => h.id === holdId);
      const routeNames = routeInfos.map(r => r.routeName).join('、');
      const position = hold ? `(${hold.x.toFixed(2)}m, ${hold.y.toFixed(2)}m)` : '';
      
      result.addError(
        `岩点 ${holdId} ${position} 被多条线路共享: ${routeNames}`,
        {
          type: ValidationType.COLOR_CONFLICT,
          holdId,
          hold,
          routes: routeInfos
        }
      );
    }
  });
}

/**
 * 校验落地区域冲突
 */
function validateLandingZoneConflicts(wall, routes, wallHolds, result) {
  if (routes.length < 2) return;
  
  const zones = routes.map(route => ({
    route,
    zone: calculateLandingZone(wall, route, wallHolds)
  }));
  
  for (let i = 0; i < zones.length; i++) {
    for (let j = i + 1; j < zones.length; j++) {
      const conflict = checkLandingZoneConflict(zones[i].zone, zones[j].zone);
      
      if (conflict.conflict) {
        const route1 = zones[i].route;
        const route2 = zones[j].route;
        
        let message = `线路 "${route1.name}" 和 "${route2.name}" 的落地区域存在冲突`;
        let context = {
          type: ValidationType.LANDING_ZONE_CONFLICT,
          route1,
          route2,
          conflict
        };
        
        if (conflict.severity === 'high') {
          result.addError(message + '（严重）', context);
        } else {
          result.addWarning(message, context);
        }
      }
    }
  }
}

/**
 * 校验儿童区安全
 */
function validateKidsSafety(wall, routes, wallHolds, result) {
  const isKidsZone = wall.isKidsZone;
  
  routes.forEach(route => {
    const routeHolds = route.holdIds
      .map(id => wallHolds.find(h => h.id === id))
      .filter(h => h !== undefined);
    
    if (routeHolds.length === 0) return;
    
    // 检查儿童线路的最高岩点
    if (isKidsZone || route.isKidsRoute) {
      const maxY = Math.max(...routeHolds.map(h => h.y));
      
      // 儿童线路不应超过 2.5 米
      if (maxY > 2.5) {
        result.addWarning(
          `儿童线路 "${route.name}" 的最高岩点达到 ${(maxY * 100).toFixed(0)}cm，建议儿童线路不超过 250cm`,
          {
            type: ValidationType.KIDS_SAFETY_DISTANCE,
            route,
            maxHeight: maxY,
            recommendedMax: 2.5
          }
        );
      }
      
      // 检查起步点高度
      if (route.startHoldId) {
        const startHold = routeHolds.find(h => h.id === route.startHoldId);
        if (startHold && startHold.y > 0.8) {
          result.addWarning(
            `儿童线路 "${route.name}" 的起步点高度 ${(startHold.y * 100).toFixed(0)}cm 过高，建议不超过 80cm`,
            {
              type: ValidationType.KIDS_SAFETY_DISTANCE,
              route,
              startHold,
              startHeight: startHold.y,
              recommendedMax: 0.8
            }
          );
        }
      }
    }
    
    // 检查普通线路是否侵入儿童区
    if (!route.isKidsRoute && isKidsZone) {
      // 所有线路都应该是儿童友好的
      result.addInfo(
        `线路 "${route.name}" 在儿童区域内，建议标记为儿童线路`,
        {
          type: ValidationType.KIDS_SAFETY_DISTANCE,
          route
        }
      );
    }
  });
}

/**
 * 校验线路完整性
 */
function validateRouteIntegrity(route, wallHolds, result) {
  const issues = [];
  
  // 检查岩点数量
  if (route.holdIds.length === 0) {
    result.addError(
      `线路 "${route.name}" 没有岩点`,
      {
        type: ValidationType.ROUTE_INTEGRITY,
        route,
        issue: 'no_holds'
      }
    );
    return;
  }
  
  if (route.holdIds.length < 3) {
    result.addWarning(
      `线路 "${route.name}" 岩点数量较少 (${route.holdIds.length} 个)`,
      {
        type: ValidationType.ROUTE_INTEGRITY,
        route,
        holdCount: route.holdIds.length
      }
    );
  }
  
  // 检查是否有起步点
  if (!route.startHoldId) {
    result.addInfo(
      `线路 "${route.name}" 没有设置起步点`,
      {
        type: ValidationType.ROUTE_INTEGRITY,
        route,
        issue: 'no_start'
      }
    );
  } else {
    // 检查起步点是否在线路中
    if (!route.holdIds.includes(route.startHoldId)) {
      result.addError(
        `线路 "${route.name}" 的起步点不在岩点列表中`,
        {
          type: ValidationType.ROUTE_INTEGRITY,
          route,
          issue: 'start_not_in_holds'
        }
      );
    }
  }
  
  // 检查是否有结束点
  if (!route.endHoldId) {
    result.addInfo(
      `线路 "${route.name}" 没有设置结束点（顶）`,
      {
        type: ValidationType.ROUTE_INTEGRITY,
        route,
        issue: 'no_end'
      }
    );
  } else {
    if (!route.holdIds.includes(route.endHoldId)) {
      result.addError(
        `线路 "${route.name}" 的结束点不在岩点列表中`,
        {
          type: ValidationType.ROUTE_INTEGRITY,
          route,
          issue: 'end_not_in_holds'
        }
      );
    }
  }
  
  // 检查岩点是否都存在于墙面上
  const validHolds = route.holdIds.filter(id => 
    wallHolds.some(h => h.id === id)
  );
  const invalidHolds = route.holdIds.filter(id => 
    !wallHolds.some(h => h.id === id)
  );
  
  if (invalidHolds.length > 0) {
    result.addError(
      `线路 "${route.name}" 包含 ${invalidHolds.length} 个不存在的岩点`,
      {
        type: ValidationType.ROUTE_INTEGRITY,
        route,
        invalidHolds,
        issue: 'invalid_holds'
      }
    );
  }
}

/**
 * 校验岩点重叠
 */
function validateHoldOverlaps(wallHolds, result) {
  if (wallHolds.length < 2) return;
  
  for (let i = 0; i < wallHolds.length; i++) {
    for (let j = i + 1; j < wallHolds.length; j++) {
      const h1 = wallHolds[i];
      const h2 = wallHolds[j];
      
      // 计算中心点距离
      const dx = Math.abs(h1.x - h2.x);
      const dy = Math.abs(h1.y - h2.y);
      
      // 计算最小安全距离（基于岩点尺寸）
      const minDistX = (h1.size.width + h2.size.width) / 2;
      const minDistY = (h1.size.height + h2.size.height) / 2;
      
      // 加上一点边距
      const safetyMargin = 0.02;  // 2cm
      
      if (dx < minDistX + safetyMargin && dy < minDistY + safetyMargin) {
        const overlapX = (minDistX + safetyMargin) - dx;
        const overlapY = (minDistY + safetyMargin) - dy;
        
        result.addWarning(
          `岩点 ${h1.id} 和 ${h2.id} 位置接近，可能存在物理重叠`,
          {
            type: ValidationType.HOLD_OVERLAP,
            hold1: h1,
            hold2: h2,
            overlap: { x: overlapX, y: overlapY }
          }
        );
      }
    }
  }
}

/**
 * 校验线路可达性（警告级别）
 */
function validateRouteReachability(route, wallHolds, result) {
  const analysis = analyzeRouteReachability(route, wallHolds);
  
  // 检查矮小的儿童和成人是否能完成
  const problematicSegments = [];
  
  Object.entries(analysis).forEach(([key, segResult]) => {
    if (!segResult.reachable && segResult.issues.length > 0) {
      problematicSegments.push({
        segment: segResult.segment,
        issues: segResult.issues
      });
    }
  });
  
  if (problematicSegments.length > 0) {
    // 汇总问题
    const segmentNames = problematicSegments.map(p => p.segment.label).join('、');
    const sampleIssue = problematicSegments[0].issues[0];
    
    result.addWarning(
      `线路 "${route.name}" 对于部分身高人群可能存在可达性问题: ${segmentNames}`,
      {
        type: ValidationType.REACHABILITY,
        route,
        problematicSegments,
        sampleIssue
      }
    );
  }
}

/**
 * 单独校验一条线路
 * @param {Object} route - 线路对象
 * @param {Object} wall - 墙面对象
 * @param {Array} allRoutes - 所有线路（用于冲突检查）
 * @returns {ValidationResult} 校验结果
 */
export function validateRoute(route, wall, allRoutes = []) {
  const result = new ValidationResult();
  const wallHolds = wall?.holds || [];
  
  if (!route) {
    result.addError('线路对象为空');
    return result;
  }
  
  // 线路完整性
  validateRouteIntegrity(route, wallHolds, result);
  
  // 如果有墙和其他线路，检查冲突
  if (wall && allRoutes.length > 0) {
    // 检查落地区域冲突
    const routeZone = calculateLandingZone(wall, route, wallHolds);
    
    allRoutes.forEach(otherRoute => {
      if (otherRoute.id === route.id) return;
      
      const otherZone = calculateLandingZone(wall, otherRoute, wallHolds);
      const conflict = checkLandingZoneConflict(routeZone, otherZone);
      
      if (conflict.conflict) {
        result.addWarning(
          `与线路 "${otherRoute.name}" 的落地区域存在冲突`,
          {
            type: ValidationType.LANDING_ZONE_CONFLICT,
            otherRoute,
            conflict
          }
        );
      }
    });
  }
  
  return result;
}

/**
 * 获取颜色名称
 */
function getColorName(colorHex) {
  // 从 HoldColors 反向查找
  for (const [name, hex] of Object.entries(HoldColors)) {
    if (hex.toLowerCase() === colorHex.toLowerCase()) {
      return name;
    }
  }
  
  // 尝试简化描述
  return colorHex;
}

/**
 * 校验单个岩点位置
 * @param {Object} hold - 岩点对象
 * @param {Object} wall - 墙面对象
 * @param {Array} otherHolds - 其他岩点
 * @returns {ValidationResult} 校验结果
 */
export function validateHoldPosition(hold, wall, otherHolds = []) {
  const result = new ValidationResult();
  
  if (!wall) {
    result.addError('缺少墙面数据');
    return result;
  }
  
  // 检查是否在墙面范围内
  const halfW = (hold.size?.width || 0.15) / 2;
  const halfH = (hold.size?.height || 0.15) / 2;
  
  if (hold.x - halfW < 0 || hold.x + halfW > wall.width) {
    result.addWarning(
      `岩点位置 (${hold.x.toFixed(2)}m) 接近或超出墙面水平边界 (0 - ${wall.width}m)`,
      { hold, wall }
    );
  }
  
  if (hold.y - halfH < 0 || hold.y + halfH > wall.height) {
    result.addWarning(
      `岩点位置 (${hold.y.toFixed(2)}m) 接近或超出墙面垂直边界 (0 - ${wall.height}m)`,
      { hold, wall }
    );
  }
  
  // 检查与其他岩点的重叠
  otherHolds.forEach(other => {
    if (other.id === hold.id) return;
    
    const dx = Math.abs(hold.x - other.x);
    const dy = Math.abs(hold.y - other.y);
    const minDistX = ((hold.size?.width || 0.15) + (other.size?.width || 0.15)) / 2;
    const minDistY = ((hold.size?.height || 0.15) + (other.size?.height || 0.15)) / 2;
    
    if (dx < minDistX + 0.01 && dy < minDistY + 0.01) {
      result.addWarning(
        `与岩点 ${other.id} 位置接近`,
        { hold, otherHold: other }
      );
    }
  });
  
  return result;
}

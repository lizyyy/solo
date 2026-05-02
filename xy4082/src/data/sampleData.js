/**
 * 示例数据
 * 用于演示和测试
 */

import { Wall, Hold, Route, Session, HoldColors, HoldType, DifficultyLevel } from '../core/dataModels.js';

/**
 * 创建示例墙面
 */
export function createSampleWall(options = {}) {
  const {
    width = 4,
    height = 3.5,
    name = '示例抱石墙',
    isKidsZone = false
  } = options;
  
  const wall = new Wall({
    name,
    width,
    height,
    type: 'vertical',
    angle: 5,  // 略微仰角
    isKidsZone
  });
  
  return wall;
}

/**
 * 创建示例岩点（网格分布）
 */
export function createSampleHolds(wall, options = {}) {
  const {
    cols = 8,
    rows = 7,
    marginX = 0.3,
    marginY = 0.3
  } = options;
  
  const holds = [];
  const colors = Object.values(HoldColors);
  const types = Object.values(HoldType);
  
  const cellWidth = (wall.width - marginX * 2) / (cols - 1);
  const cellHeight = (wall.height - marginY * 2) / (rows - 1);
  
  let colorIndex = 0;
  
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      // 跳过一些位置
      if (Math.random() < 0.15 && (row > 0 && col > 0)) continue;
      
      const x = marginX + col * cellWidth + (Math.random() - 0.5) * 0.1;
      const y = marginY + row * cellHeight + (Math.random() - 0.5) * 0.1;
      
      // 根据高度选择颜色（低 - 高 不同颜色）
      let colorName, color;
      if (row < 2) {
        colorName = 'RED';
        color = HoldColors.RED;
      } else if (row < 4) {
        colorName = 'BLUE';
        color = HoldColors.BLUE;
      } else if (row < 5) {
        colorName = 'GREEN';
        color = HoldColors.GREEN;
      } else {
        colorName = 'YELLOW';
        color = HoldColors.YELLOW;
      }
      
      // 随机类型
      let type;
      if (row === 0) {
        type = HoldType.JUG;  // 底部用大把手点
      } else if (row === rows - 1) {
        type = HoldType.JUG;  // 顶部也用大把手
      } else {
        type = types[Math.floor(Math.random() * (types.length - 2))];  // 排除 foot 和 volume
      }
      
      const hold = new Hold({
        x: Math.max(0.1, Math.min(wall.width - 0.1, x)),
        y: Math.max(0.1, Math.min(wall.height - 0.1, y)),
        z: 0,
        type,
        color,
        colorName,
        size: {
          width: type === HoldType.VOLUME ? 0.3 : 0.15,
          height: type === HoldType.VOLUME ? 0.3 : 0.15,
          depth: type === HoldType.VOLUME ? 0.2 : 0.08
        }
      });
      
      holds.push(hold);
      wall.addHold(hold);
    }
  }
  
  return holds;
}

/**
 * 创建示例线路
 */
export function createSampleRoutes(wall, options = {}) {
  const routes = [];
  const holds = wall.holds;
  
  if (holds.length === 0) return routes;
  
  // 按颜色分组
  const colorGroups = new Map();
  holds.forEach(hold => {
    const key = hold.colorName || hold.color;
    if (!colorGroups.has(key)) {
      colorGroups.set(key, []);
    }
    colorGroups.get(key).push(hold);
  });
  
  // 为每种颜色创建一条线路
  const colorNames = ['RED', 'BLUE', 'GREEN', 'YELLOW'];
  const difficulties = [DifficultyLevel.V2, DifficultyLevel.V3, DifficultyLevel.V4, DifficultyLevel.V5];
  const routeNames = ['红色新手线', '蓝色进阶线', '绿色挑战线', '黄色高手线'];
  
  colorNames.forEach((colorName, index) => {
    const colorHolds = colorGroups.get(colorName) || [];
    if (colorHolds.length < 3) return;
    
    // 按高度排序，选择连续的线路
    const sortedHolds = [...colorHolds].sort((a, b) => a.y - b.y);
    
    // 选择 5-7 个岩点
    const routeHoldCount = Math.min(sortedHolds.length, 5 + Math.floor(Math.random() * 3));
    const routeHolds = sortedHolds.slice(0, routeHoldCount);
    
    const route = new Route({
      name: routeNames[index] || `线路 ${index + 1}`,
      difficulty: difficulties[index] || DifficultyLevel.V3,
      color: HoldColors[colorName] || '#FF4444',
      colorName,
      holdIds: routeHolds.map(h => h.id),
      startHoldId: routeHolds[0]?.id,
      endHoldId: routeHolds[routeHolds.length - 1]?.id,
      type: 'boulder',
      isKidsRoute: index === 0,  // 红色线标记为儿童线路
      notes: index === 0 
        ? '这是一条新手友好的线路，适合入门者练习。起步点较低，跨度适中。' 
        : ''
    });
    
    routes.push(route);
  });
  
  return routes;
}

/**
 * 创建完整示例 Session
 */
export function createSampleSession(options = {}) {
  const {
    wallName = '主抱石墙',
    isKidsZone = false,
    width = 4,
    height = 3.5
  } = options;
  
  // 创建墙面
  const wall = createSampleWall({
    name: wallName,
    isKidsZone,
    width,
    height
  });
  
  // 创建岩点
  createSampleHolds(wall, {
    cols: 8,
    rows: 7
  });
  
  // 创建线路
  const routes = createSampleRoutes(wall);
  
  // 创建 Session
  const session = new Session({
    name: isKidsZone ? '儿童区定线方案' : '主区定线方案',
    wall,
    routes,
    notes: isKidsZone 
      ? '这是儿童区域的定线方案，所有线路难度控制在 V0-V3，起步点高度不超过 80cm。'
      : '这是主区域的定线方案，涵盖从 V2 到 V5 的不同难度级别。'
  });
  
  return session;
}

/**
 * 创建简单测试数据（用于单元测试）
 */
export function createTestData() {
  const wall = new Wall({
    name: '测试墙',
    width: 3,
    height: 3,
    type: 'vertical',
    angle: 0
  });
  
  // 添加几个测试岩点
  const holds = [
    new Hold({ x: 0.5, y: 0.5, color: HoldColors.RED, colorName: 'RED', type: HoldType.JUG }),
    new Hold({ x: 1.5, y: 0.5, color: HoldColors.RED, colorName: 'RED', type: HoldType.JUG }),
    new Hold({ x: 1.0, y: 1.2, color: HoldColors.RED, colorName: 'RED', type: HoldType.CRIMP }),
    new Hold({ x: 1.8, y: 1.8, color: HoldColors.RED, colorName: 'RED', type: HoldType.SLOPER }),
    new Hold({ x: 0.8, y: 2.5, color: HoldColors.RED, colorName: 'RED', type: HoldType.JUG }),
    
    // 另一种颜色的岩点
    new Hold({ x: 0.3, y: 0.3, color: HoldColors.BLUE, colorName: 'BLUE', type: HoldType.JUG }),
    new Hold({ x: 1.2, y: 0.8, color: HoldColors.BLUE, colorName: 'BLUE', type: HoldType.CRIMP }),
    new Hold({ x: 2.0, y: 1.5, color: HoldColors.BLUE, colorName: 'BLUE', type: HoldType.PINCH }),
    new Hold({ x: 1.5, y: 2.8, color: HoldColors.BLUE, colorName: 'BLUE', type: HoldType.JUG }),
  ];
  
  holds.forEach(h => wall.addHold(h));
  
  // 创建线路
  const redRoute = new Route({
    name: '测试红线',
    difficulty: DifficultyLevel.V2,
    color: HoldColors.RED,
    colorName: 'RED',
    holdIds: holds.slice(0, 5).map(h => h.id),
    startHoldId: holds[0].id,
    endHoldId: holds[4].id
  });
  
  const blueRoute = new Route({
    name: '测试蓝线',
    difficulty: DifficultyLevel.V4,
    color: HoldColors.BLUE,
    colorName: 'BLUE',
    holdIds: holds.slice(5).map(h => h.id),
    startHoldId: holds[5].id,
    endHoldId: holds[8].id
  });
  
  return {
    wall,
    holds,
    routes: [redRoute, blueRoute],
    redRoute,
    blueRoute
  };
}

/**
 * 导出为 JSON 格式的示例墙面（用于导入测试）
 */
export function getSampleWallJSON() {
  const wall = createSampleWall();
  createSampleHolds(wall);
  return JSON.stringify(wall.toJSON(), null, 2);
}

/**
 * 导出为 JSON 格式的示例 Session（用于导入测试）
 */
export function getSampleSessionJSON() {
  const session = createSampleSession();
  return JSON.stringify(session.toJSON(), null, 2);
}

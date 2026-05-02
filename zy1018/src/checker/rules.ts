import type { 
  CheckResult, 
  CheckSeverity,
  Plan, 
  BoothObject, 
  BoundingBox 
} from '../models/types';
import { getObjectBoundingBox, boxesOverlap2D, getBoxCenter, distance2D } from '../utils/geometry';

export interface ICheckRule {
  id: string;
  name: string;
  severity: CheckSeverity;
  check(plan: Plan): CheckResult[];
}

export function createCheckResult(
  rule: string,
  severity: CheckSeverity,
  message: string,
  objectIds?: string[],
  suggestions?: string[]
): CheckResult {
  return {
    id: `check_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
    rule,
    severity,
    message,
    objectIds,
    suggestions,
  };
}

export class BoundaryCheckRule implements ICheckRule {
  id = 'boundary';
  name = '场地边界检查';
  severity: CheckSeverity = 'error';

  check(plan: Plan): CheckResult[] {
    const results: CheckResult[] = [];
    const floor = plan.floor;
    const halfWidth = floor.width / 2;
    const halfDepth = floor.depth / 2;
    
    const solidTypes: BoothObject['type'][] = ['table', 'display_rack', 'cashier_desk'];
    const objectsToCheck = plan.objects.filter(o => solidTypes.includes(o.type));
    
    for (const obj of objectsToCheck) {
      const box = getObjectBoundingBox(obj.position, obj.dimensions, obj.rotation);
      let outOfBounds = false;
      const boundaryMessages: string[] = [];
      
      if (box.minX < -halfWidth) {
        outOfBounds = true;
        boundaryMessages.push(`左侧超出 ${(-halfWidth - box.minX).toFixed(2)}m`);
      }
      if (box.maxX > halfWidth) {
        outOfBounds = true;
        boundaryMessages.push(`右侧超出 ${(box.maxX - halfWidth).toFixed(2)}m`);
      }
      if (box.minZ < -halfDepth) {
        outOfBounds = true;
        boundaryMessages.push(`后侧超出 ${(-halfDepth - box.minZ).toFixed(2)}m`);
      }
      if (box.maxZ > halfDepth) {
        outOfBounds = true;
        boundaryMessages.push(`前侧超出 ${(box.maxZ - halfDepth).toFixed(2)}m`);
      }
      
      if (outOfBounds) {
        results.push(createCheckResult(
          'boundary',
          'error',
          `「${obj.name}」超出场地边界: ${boundaryMessages.join(', ')}`,
          [obj.id],
          [`将「${obj.name}」向场地中心移动`, `考虑缩小该物件尺寸`]
        ));
      }
    }
    
    return results;
  }
}

export class CollisionCheckRule implements ICheckRule {
  id = 'collision';
  name = '物件碰撞检查';
  severity: CheckSeverity = 'error';

  check(plan: Plan): CheckResult[] {
    const results: CheckResult[] = [];
    
    const collisionTypes: BoothObject['type'][] = ['table', 'display_rack', 'cashier_desk'];
    const collisionObjects = plan.objects.filter(o => collisionTypes.includes(o.type));
    
    const boxesWithId: { box: BoundingBox; obj: BoothObject }[] = [];
    for (const obj of collisionObjects) {
      const box = getObjectBoundingBox(obj.position, obj.dimensions, obj.rotation);
      boxesWithId.push({ box, obj });
    }
    
    const reportedPairs = new Set<string>();
    for (let i = 0; i < boxesWithId.length; i++) {
      for (let j = i + 1; j < boxesWithId.length; j++) {
        const item1 = boxesWithId[i];
        const item2 = boxesWithId[j];
        const pairKey = [item1.obj.id, item2.obj.id].sort().join('|');
        
        if (reportedPairs.has(pairKey)) continue;
        
        if (boxesOverlap2D(item1.box, item2.box)) {
          reportedPairs.add(pairKey);
          results.push(createCheckResult(
            'collision',
            'error',
            `「${item1.obj.name}」与「${item2.obj.name}」发生重叠/穿模`,
            [item1.obj.id, item2.obj.id],
            [
              `移动「${item1.obj.name}」或「${item2.obj.name}」使其分开`,
              `调整物件角度`,
              `考虑缩小其中一个物件的尺寸`
            ]
          ));
        }
      }
    }
    
    return results;
  }
}

export class SafetyAisleCheckRule implements ICheckRule {
  id = 'safety_aisle';
  name = '安全通道检查';
  severity: CheckSeverity = 'error';

  check(plan: Plan): CheckResult[] {
    const results: CheckResult[] = [];
    
    const safetyAisles = plan.objects.filter(o => o.type === 'safety_aisle');
    const solidTypes: BoothObject['type'][] = ['table', 'display_rack', 'cashier_desk'];
    const solidObjects = plan.objects.filter(o => solidTypes.includes(o.type));
    
    for (const aisle of safetyAisles) {
      const aisleBox = getObjectBoundingBox(aisle.position, aisle.dimensions, aisle.rotation);
      
      for (const obj of solidObjects) {
        const objBox = getObjectBoundingBox(obj.position, obj.dimensions, obj.rotation);
        
        if (boxesOverlap2D(aisleBox, objBox)) {
          results.push(createCheckResult(
            'safety_aisle',
            'error',
            `「${obj.name}」挡住了安全通道「${aisle.name}」`,
            [obj.id, aisle.id],
            [
              `将「${obj.name}」移出安全通道区域`,
              `调整安全通道的位置或宽度`
            ]
          ));
        }
      }
      
      const aisleWidth = Math.max(
        aisleBox.maxX - aisleBox.minX,
        aisleBox.maxZ - aisleBox.minZ
      );
      
      if (aisleWidth < plan.mainAisle.minWidth) {
        results.push(createCheckResult(
          'safety_aisle',
          'warning',
          `安全通道「${aisle.name}」宽度 ${aisleWidth.toFixed(2)}m 小于最小要求 ${plan.mainAisle.minWidth}m`,
          [aisle.id],
          [
            `增加通道宽度至 ${plan.mainAisle.minWidth}m 以上`,
            `在设置中调整最小通道宽度要求`
          ]
        ));
      }
    }
    
    return results;
  }
}

export class PathfindingCheckRule implements ICheckRule {
  id = 'pathfinding';
  name = '通路检查';
  severity: CheckSeverity = 'error';

  check(plan: Plan): CheckResult[] {
    const results: CheckResult[] = [];
    
    const entrances = plan.objects.filter(o => o.type === 'entrance');
    const exits = plan.objects.filter(o => o.type === 'exit');
    const cashiers = plan.objects.filter(o => o.type === 'cashier_desk');
    
    const solidTypes: BoothObject['type'][] = ['table', 'display_rack', 'cashier_desk'];
    const solidObjects = plan.objects.filter(o => solidTypes.includes(o.type));
    
    const gridSize = 0.5;
    const floor = plan.floor;
    const halfWidth = floor.width / 2;
    const halfDepth = floor.depth / 2;
    
    const isBlocked = (x: number, z: number, excludeId?: string): boolean => {
      for (const obj of solidObjects) {
        if (obj.id === excludeId) continue;
        const box = getObjectBoundingBox(obj.position, obj.dimensions, obj.rotation);
        const margin = 0.1;
        if (x >= box.minX - margin && x <= box.maxX + margin &&
            z >= box.minZ - margin && z <= box.maxZ + margin) {
          return true;
        }
      }
      if (x < -halfWidth || x > halfWidth || z < -halfDepth || z > halfDepth) {
        return true;
      }
      return false;
    };
    
    const hasPath = (
      start: { x: number; z: number }, 
      end: { x: number; z: number }, 
      excludeId?: string
    ): boolean => {
      const visited = new Set<string>();
      const queue: { x: number; z: number }[] = [start];
      
      while (queue.length > 0) {
        const current = queue.shift()!;
        const key = `${Math.floor(current.x / gridSize)},${Math.floor(current.z / gridSize)}`;
        
        if (visited.has(key)) continue;
        visited.add(key);
        
        const dist = distance2D(current, end);
        if (dist < gridSize * 1.5) {
          return true;
        }
        
        const directions = [
          { dx: gridSize, dz: 0 },
          { dx: -gridSize, dz: 0 },
          { dx: 0, dz: gridSize },
          { dx: 0, dz: -gridSize },
        ];
        
        for (const dir of directions) {
          const next = { x: current.x + dir.dx, z: current.z + dir.dz };
          const nextKey = `${Math.floor(next.x / gridSize)},${Math.floor(next.z / gridSize)}`;
          
          if (!visited.has(nextKey) && !isBlocked(next.x, next.z, excludeId)) {
            queue.push(next);
          }
        }
      }
      
      return false;
    };
    
    for (const entrance of entrances) {
      const entrancePos = getBoxCenter(
        getObjectBoundingBox(entrance.position, entrance.dimensions, entrance.rotation)
      );
      
      for (const cashier of cashiers) {
        const cashierPos = getBoxCenter(
          getObjectBoundingBox(cashier.position, cashier.dimensions, cashier.rotation)
        );
        
        if (!hasPath(entrancePos, cashierPos, cashier.id)) {
          results.push(createCheckResult(
            'pathfinding',
            'error',
            `从入口「${entrance.name}」到收银台「${cashier.name}」的通路被堵塞`,
            [entrance.id, cashier.id],
            [
              `清除入口到收银台之间的障碍物`,
              `调整物件位置留出通行空间`,
              `考虑将收银台移动到更靠近入口的位置`
            ]
          ));
        }
      }
      
      for (const exit of exits) {
        const exitPos = getBoxCenter(
          getObjectBoundingBox(exit.position, exit.dimensions, exit.rotation)
        );
        
        if (!hasPath(entrancePos, exitPos)) {
          results.push(createCheckResult(
            'pathfinding',
            'error',
            `从入口「${entrance.name}」到出口「${exit.name}」的通路被堵塞`,
            [entrance.id, exit.id],
            [
              `清除入口到出口之间的障碍物`,
              `调整物件位置留出至少 ${plan.mainAisle.minWidth}m 宽的通行空间`,
              `使用安全通道标记确保主要通路不被占用`
            ]
          ));
        }
      }
    }
    
    return results;
  }
}

export class LineOfSightCheckRule implements ICheckRule {
  id = 'line_of_sight';
  name = '视线检查';
  severity: CheckSeverity = 'warning';

  check(plan: Plan): CheckResult[] {
    const results: CheckResult[] = [];
    
    const featureWalls = plan.objects.filter(o => o.type === 'feature_wall');
    const entrances = plan.objects.filter(o => o.type === 'entrance');
    
    const obstacleTypes: BoothObject['type'][] = ['table', 'display_rack'];
    const obstacles = plan.objects.filter(o => obstacleTypes.includes(o.type));
    
    for (const entrance of entrances) {
      const entranceBox = getObjectBoundingBox(entrance.position, entrance.dimensions, entrance.rotation);
      const entranceCenter = getBoxCenter(entranceBox);
      
      for (const wall of featureWalls) {
        const wallBox = getObjectBoundingBox(wall.position, wall.dimensions, wall.rotation);
        const wallCenter = getBoxCenter(wallBox);
        
        for (const obstacle of obstacles) {
          const obstacleBox = getObjectBoundingBox(obstacle.position, obstacle.dimensions, obstacle.rotation);
          
          const steps = 20;
          let blocked = false;
          
          for (let i = 1; i < steps; i++) {
            const t = i / steps;
            const px = entranceCenter.x + (wallCenter.x - entranceCenter.x) * t;
            const pz = entranceCenter.z + (wallCenter.z - entranceCenter.z) * t;
            
            const margin = 0.1;
            if (px >= obstacleBox.minX - margin && px <= obstacleBox.maxX + margin &&
                pz >= obstacleBox.minZ - margin && pz <= obstacleBox.maxZ + margin) {
              blocked = true;
              break;
            }
          }
          
          if (blocked) {
            results.push(createCheckResult(
              'line_of_sight',
              'warning',
              `从入口「${entrance.name}」看向主视觉墙「${wall.name}」的视线被「${obstacle.name}」遮挡`,
              [entrance.id, wall.id, obstacle.id],
              [
                `移除或移动「${obstacle.name}」`,
                `将「${obstacle.name}」放置在主视觉墙侧面`,
                `考虑降低「${obstacle.name}」的高度或使用更低的展架`
              ]
            ));
          }
        }
      }
    }
    
    return results;
  }
}

export class BasicRequirementsCheckRule implements ICheckRule {
  id = 'basic_requirements';
  name = '基础要求检查';
  severity: CheckSeverity = 'info';

  check(plan: Plan): CheckResult[] {
    const results: CheckResult[] = [];
    
    const entrances = plan.objects.filter(o => o.type === 'entrance');
    const exits = plan.objects.filter(o => o.type === 'exit');
    const cashiers = plan.objects.filter(o => o.type === 'cashier_desk');
    const featureWalls = plan.objects.filter(o => o.type === 'feature_wall');
    
    if (entrances.length === 0) {
      results.push(createCheckResult(
        'basic_requirements',
        'warning',
        '方案中缺少入口标记',
        undefined,
        ['从左侧物件库拖入入口标记到场地边缘', '建议在面向主通道的位置设置入口']
      ));
    }
    
    if (exits.length === 0) {
      results.push(createCheckResult(
        'basic_requirements',
        'info',
        '方案中缺少出口标记（入口可兼作出口）',
        undefined,
        ['如果需要专用出口，可从物件库拖入出口标记', '建议入口和出口分开设置以避免人流对冲']
      ));
    }
    
    if (cashiers.length === 0) {
      results.push(createCheckResult(
        'basic_requirements',
        'info',
        '方案中没有收银台',
        undefined,
        ['如果需要收银功能，可添加收银台', '建议将收银台放置在靠近出口的位置']
      ));
    }
    
    if (featureWalls.length === 0) {
      results.push(createCheckResult(
        'basic_requirements',
        'info',
        '方案中没有主视觉墙（视线检查功能不会激活）',
        undefined,
        ['添加主视觉墙以启用视线遮挡检查功能', '主视觉墙通常是摊位的品牌背景板或重点展示区域']
      ));
    }
    
    if (plan.objects.length === 0) {
      results.push(createCheckResult(
        'basic_requirements',
        'info',
        '方案为空，请从左侧物件库添加物件',
        undefined,
        ['点击左侧物件库中的物件即可添加到场地中心', '可以拖动、旋转、调整尺寸来布置']
      ));
    }
    
    return results;
  }
}

export const ALL_RULES: ICheckRule[] = [
  new BoundaryCheckRule(),
  new CollisionCheckRule(),
  new SafetyAisleCheckRule(),
  new PathfindingCheckRule(),
  new LineOfSightCheckRule(),
  new BasicRequirementsCheckRule(),
];

export function runAllChecks(plan: Plan): CheckResult[] {
  const allResults: CheckResult[] = [];
  
  for (const rule of ALL_RULES) {
    const results = rule.check(plan);
    allResults.push(...results);
  }
  
  return allResults.sort((a, b) => {
    const priority: Record<string, number> = { error: 0, warning: 1, info: 2 };
    return priority[a.severity] - priority[b.severity];
  });
}

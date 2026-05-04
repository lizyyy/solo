import {
  Plan,
  Booth,
  Exit,
  Entrance,
  FixedObstacle,
  Pillar,
  Wall,
  ValidationResult,
  RiskLevel,
  ValidationCategory,
  AffectedObject,
  Position,
  PowerZone,
  FlowZone
} from '../types';

interface Rectangle {
  x: number;
  y: number;
  width: number;
  height: number;
}

export const validationService = {
  validate(plan: Plan): ValidationResult[] {
    const results: ValidationResult[] = [];

    results.push(...this.checkOverlappingBooths(plan));
    results.push(...this.checkOverlappingWithExits(plan));
    results.push(...this.checkOverlappingWithFixedObstacles(plan));
    results.push(...this.checkPassageWidth(plan));
    results.push(...this.checkPowerZones(plan));
    results.push(...this.checkPopularBoothsCongestion(plan));
    results.push(...this.checkPathCirculation(plan));
    results.push(...this.checkStageAndInfoDeskAccess(plan));

    return results;
  },

  checkOverlappingBooths(plan: Plan): ValidationResult[] {
    const results: ValidationResult[] = [];
    const booths = plan.booths;

    for (let i = 0; i < booths.length; i++) {
      for (let j = i + 1; j < booths.length; j++) {
        if (this.doRectanglesOverlap(this.getBoothRect(booths[i]), this.getBoothRect(booths[j]))) {
          results.push({
            ruleId: 'OVERLAP_BOOTHS',
            ruleName: '展位重叠检测',
            category: 'layout',
            passed: false,
            riskLevel: 'high',
            message: `展位 "${booths[i].name}" 和 "${booths[j].name}" 相互重叠`,
            details: '两个展位的位置有重叠，这会导致实际布展冲突。',
            affectedObjects: [
              this.createAffectedObject(booths[i]),
              this.createAffectedObject(booths[j])
            ],
            location: this.getOverlapCenter(booths[i], booths[j])
          });
        }
      }
    }

    return results;
  },

  checkOverlappingWithExits(plan: Plan): ValidationResult[] {
    const results: ValidationResult[] = [];
    const { booths, hall } = plan;

    for (const booth of booths) {
      const boothRect = this.getBoothRect(booth);

      for (const exit of hall.exits) {
        const exitRect = this.getObjectRect(exit.position, exit.size);
        
        if (this.doRectanglesOverlap(boothRect, exitRect)) {
          results.push({
            ruleId: 'EXIT_BLOCKED',
            ruleName: '出口被遮挡',
            category: 'safety',
            passed: false,
            riskLevel: 'critical',
            message: `展位 "${booth.name}" 遮挡了出口 "${exit.name}"`,
            details: exit.isEmergency 
              ? '紧急出口被遮挡是严重的消防安全隐患，必须立即调整。'
              : '普通出口被遮挡会影响观众疏散和进出。',
            affectedObjects: [
              this.createAffectedObject(booth),
              { id: exit.id, type: 'exit', name: exit.name }
            ],
            location: exit.position
          });
        }

        const clearZone = this.expandRect(exitRect, 1.5);
        if (this.doRectanglesOverlap(boothRect, clearZone) && 
            !this.doRectanglesOverlap(boothRect, exitRect)) {
          results.push({
            ruleId: 'EXIT_CLEAR_ZONE',
            ruleName: '出口缓冲区域',
            category: 'safety',
            passed: false,
            riskLevel: 'medium',
            message: `展位 "${booth.name}" 距离出口 "${exit.name}" 太近`,
            details: '出口周围应保持至少1.5米的缓冲区域以确保顺畅通行。',
            affectedObjects: [
              this.createAffectedObject(booth),
              { id: exit.id, type: 'exit', name: exit.name }
            ],
            location: booth.position
          });
        }
      }

      for (const entrance of hall.entrances) {
        const entranceRect = this.getObjectRect(entrance.position, entrance.size);
        const clearZone = this.expandRect(entranceRect, 2);
        
        if (this.doRectanglesOverlap(boothRect, clearZone)) {
          results.push({
            ruleId: 'ENTRANCE_CLEAR_ZONE',
            ruleName: '入口缓冲区域',
            category: 'flow',
            passed: false,
            riskLevel: 'medium',
            message: `展位 "${booth.name}" 距离入口 "${entrance.name}" 太近`,
            details: entrance.isMain
              ? '主入口周围应保持至少2米的缓冲区域，这是人流汇集的关键区域。'
              : '入口周围应保持至少2米的缓冲区域以确保顺畅通行。',
            affectedObjects: [
              this.createAffectedObject(booth),
              { id: entrance.id, type: 'entrance', name: entrance.name }
            ],
            location: booth.position
          });
        }
      }
    }

    return results;
  },

  checkOverlappingWithFixedObstacles(plan: Plan): ValidationResult[] {
    const results: ValidationResult[] = [];
    const { booths, hall } = plan;

    for (const booth of booths) {
      const boothRect = this.getBoothRect(booth);

      for (const obstacle of [...hall.fixedObstacles, ...hall.pillars, ...hall.walls]) {
        const obstacleRect = this.getObjectRect(obstacle.position, obstacle.size);
        
        if (this.doRectanglesOverlap(boothRect, obstacleRect)) {
          const obstacleName = 'name' in obstacle ? obstacle.name : '柱子/墙体';
          results.push({
            ruleId: 'OBSTACLE_OVERLAP',
            ruleName: '固定障碍物重叠',
            category: 'layout',
            passed: false,
            riskLevel: 'high',
            message: `展位 "${booth.name}" 与固定障碍物 "${obstacleName}" 重叠`,
            details: '展位不能放置在柱子、墙体或其他固定障碍物的位置上。',
            affectedObjects: [this.createAffectedObject(booth)],
            location: booth.position
          });
        }
      }
    }

    return results;
  },

  checkPassageWidth(plan: Plan): ValidationResult[] {
    const results: ValidationResult[] = [];
    const { booths, hall } = plan;
    const minPassageWidth = 1.8;
    const criticalPassageWidth = 1.2;

    const allRectangles: (Rectangle & { name: string })[] = [
      ...booths.map(b => ({ ...this.getBoothRect(b), name: b.name })),
      ...hall.pillars.map(p => ({ ...this.getObjectRect(p.position, p.size), name: '柱子' })),
      ...hall.walls.map(w => ({ ...this.getObjectRect(w.position, w.size), name: '墙体' })),
      ...hall.fixedObstacles.map(o => ({ ...this.getObjectRect(o.position, o.size), name: o.name }))
    ];

    const gridSize = 1;
    const hallRect = { x: 0, y: 0, width: hall.dimensions.width, height: hall.dimensions.depth };
    const narrowSpots: { position: Position; width: number; nearbyObjects: string[] }[] = [];

    for (let x = gridSize; x < hall.dimensions.width - gridSize; x += gridSize) {
      for (let y = gridSize; y < hall.dimensions.depth - gridSize; y += gridSize) {
        const checkPoint = { x, y, width: 0.1, height: 0.1 };
        
        const nearbyObstacles = allRectangles.filter(r => {
          const expanded = this.expandRect(r, 0.5);
          return this.doRectanglesOverlap(checkPoint, expanded);
        });

        if (nearbyObstacles.length >= 2) {
          const minDistance = this.calculateMinimumPassageAt(
            { x: x + 0.05, y: y + 0.05 },
            allRectangles
          );

          if (minDistance < minPassageWidth) {
            const existingSpot = narrowSpots.find(s => 
              Math.abs(s.position.x - x) < 2 && Math.abs(s.position.y - y) < 2
            );

            if (!existingSpot) {
              narrowSpots.push({
                position: { x, y },
                width: minDistance,
                nearbyObjects: nearbyObstacles.map(o => o.name)
              });
            }
          }
        }
      }
    }

    for (const spot of narrowSpots) {
      const isCritical = spot.width < criticalPassageWidth;
      results.push({
        ruleId: 'PASSAGE_TOO_NARROW',
        ruleName: '通道宽度不足',
        category: 'safety',
        passed: false,
        riskLevel: isCritical ? 'critical' : 'high',
        message: `位置 (${spot.position.x.toFixed(1)}, ${spot.position.y.toFixed(1)}) 处通道宽度仅约 ${spot.width.toFixed(2)} 米`,
        details: isCritical
          ? `通道宽度严重不足（小于 ${criticalPassageWidth} 米），会导致紧急情况下无法安全疏散。`
          : `通道宽度不足标准要求的 ${minPassageWidth} 米，可能导致人流拥堵。`,
        affectedObjects: spot.nearbyObjects.map((name, idx) => ({
          id: `nearby_${idx}`,
          type: 'other' as const,
          name
        })),
        location: spot.position
      });
    }

    return results;
  },

  checkPowerZones(plan: Plan): ValidationResult[] {
    const results: ValidationResult[] = [];
    const { booths, powerZones } = plan;

    if (powerZones.length === 0) {
      return results;
    }

    for (const zone of powerZones) {
      const boothsInZone = booths.filter(b => {
        if (b.powerZoneId === zone.id) return true;
        
        const boothCenter = {
          x: b.position.x + b.size.width / 2,
          y: b.position.y + b.size.depth / 2
        };
        
        const zoneRect = this.getObjectRect(zone.position, zone.size);
        return boothCenter.x >= zoneRect.x && 
               boothCenter.x <= zoneRect.x + zoneRect.width &&
               boothCenter.y >= zoneRect.y && 
               boothCenter.y <= zoneRect.y + zoneRect.height;
      });

      const totalPower = boothsInZone.reduce((sum, b) => sum + b.powerDemand, 0);
      const powerUtilization = (totalPower / zone.maxPower) * 100;

      if (totalPower > zone.maxPower) {
        results.push({
          ruleId: 'POWER_OVERLOAD',
          ruleName: '用电功率超限',
          category: 'power',
          passed: false,
          riskLevel: 'critical',
          message: `电区 "${zone.name}" 功率超限`,
          details: `当前总功率需求: ${totalPower.toLocaleString()} W, 区域最大容量: ${zone.maxPower.toLocaleString()} W, 超载 ${powerUtilization.toFixed(1)}%`,
          affectedObjects: boothsInZone.map(b => this.createAffectedObject(b)),
          location: zone.position
        });
      } else if (powerUtilization > 80) {
        results.push({
          ruleId: 'POWER_HIGH_UTILIZATION',
          ruleName: '用电功率预警',
          category: 'power',
          passed: false,
          riskLevel: 'medium',
          message: `电区 "${zone.name}" 功率使用率较高`,
          details: `当前总功率需求: ${totalPower.toLocaleString()} W, 区域最大容量: ${zone.maxPower.toLocaleString()} W, 使用率 ${powerUtilization.toFixed(1)}%`,
          affectedObjects: boothsInZone.map(b => this.createAffectedObject(b)),
          location: zone.position
        });
      }
    }

    return results;
  },

  checkPopularBoothsCongestion(plan: Plan): ValidationResult[] {
    const results: ValidationResult[] = [];
    const { booths } = plan;

    const popularBooths = booths.filter(b => b.isPopular);

    if (popularBooths.length < 2) {
      return results;
    }

    for (let i = 0; i < popularBooths.length; i++) {
      for (let j = i + 1; j < popularBooths.length; j++) {
        const dist = this.getCenterDistance(popularBooths[i], popularBooths[j]);
        const minDistance = 8;

        if (dist < minDistance) {
          results.push({
            ruleId: 'POPULAR_BOOTHS_CONGESTION',
            ruleName: '热门摊位拥挤风险',
            category: 'flow',
            passed: false,
            riskLevel: 'high',
            message: `热门展位 "${popularBooths[i].name}" 和 "${popularBooths[j].name}" 距离太近`,
            details: `两个热门展位中心距离仅 ${dist.toFixed(1)} 米，建议至少保持 ${minDistance} 米间距以避免人流对冲。`,
            affectedObjects: [
              this.createAffectedObject(popularBooths[i]),
              this.createAffectedObject(popularBooths[j])
            ],
            location: this.getOverlapCenter(popularBooths[i], popularBooths[j])
          });
        }
      }
    }

    return results;
  },

  checkPathCirculation(plan: Plan): ValidationResult[] {
    const results: ValidationResult[] = [];
    const { booths, hall } = plan;

    const mainEntrance = hall.entrances.find(e => e.isMain) || hall.entrances[0];
    
    if (!mainEntrance) {
      return results;
    }

    const keyDestinations = booths.filter(b => 
      b.type === 'stage' || b.type === 'info_desk'
    );

    const obstacles = [
      ...booths.map(b => this.getBoothRect(b)),
      ...hall.pillars.map(p => this.getObjectRect(p.position, p.size)),
      ...hall.fixedObstacles.map(o => this.getObjectRect(o.position, o.size))
    ];

    for (const dest of keyDestinations) {
      const hasDirectPath = this.hasClearPath(
        { x: mainEntrance.position.x + mainEntrance.size.width / 2, y: mainEntrance.position.y + mainEntrance.size.depth / 2 },
        { x: dest.position.x + dest.size.width / 2, y: dest.position.y + dest.size.depth / 2 },
        obstacles,
        hall.dimensions
      );

      if (!hasDirectPath) {
        results.push({
          ruleId: 'CIRCULATION_ISSUE',
          ruleName: '人流路线问题',
          category: 'flow',
          passed: false,
          riskLevel: 'medium',
          message: `从主入口到 ${dest.type === 'stage' ? '舞台' : '服务台'} "${dest.name}" 的路线存在障碍`,
          details: '主入口到关键目的地的直接路径被遮挡，可能导致观众需要绕路，影响体验和疏散效率。',
          affectedObjects: [
            { id: mainEntrance.id, type: 'entrance', name: mainEntrance.name },
            this.createAffectedObject(dest)
          ],
          location: dest.position
        });
      }
    }

    return results;
  },

  checkStageAndInfoDeskAccess(plan: Plan): ValidationResult[] {
    const results: ValidationResult[] = [];
    const { booths } = plan;

    const specialBooths = booths.filter(b => 
      b.type === 'stage' || b.type === 'info_desk'
    );

    for (const special of specialBooths) {
      const nearbyBooths = booths.filter(b => {
        if (b.id === special.id) return false;
        return this.getCenterDistance(special, b) < 5;
      });

      if (nearbyBooths.length > 2) {
        results.push({
          ruleId: 'SPECIAL_BOOTH_ACCESS',
          ruleName: '关键区域可达性',
          category: 'flow',
          passed: false,
          riskLevel: 'medium',
          message: `${special.type === 'stage' ? '舞台' : '服务台'} "${special.name}" 周围展位较多`,
          details: `${special.type === 'stage' ? '舞台' : '服务台'} 周围 ${nearbyBooths.length} 个展位可能导致该区域拥挤。建议在关键区域周围预留更多空间。`,
          affectedObjects: [
            this.createAffectedObject(special),
            ...nearbyBooths.map(b => this.createAffectedObject(b))
          ],
          location: special.position
        });
      }
    }

    return results;
  },

  getBoothRect(booth: Booth): Rectangle {
    return {
      x: booth.position.x,
      y: booth.position.y,
      width: booth.size.width,
      height: booth.size.depth
    };
  },

  getObjectRect(position: Position, size: Size): Rectangle {
    return {
      x: position.x,
      y: position.y,
      width: size.width,
      height: size.depth
    };
  },

  doRectanglesOverlap(a: Rectangle, b: Rectangle): boolean {
    return !(a.x + a.width <= b.x ||
             b.x + b.width <= a.x ||
             a.y + a.height <= b.y ||
             b.y + b.height <= a.y);
  },

  expandRect(rect: Rectangle, amount: number): Rectangle {
    return {
      x: rect.x - amount,
      y: rect.y - amount,
      width: rect.width + amount * 2,
      height: rect.height + amount * 2
    };
  },

  getOverlapCenter(a: Booth, b: Booth): Position {
    return {
      x: (a.position.x + b.position.x) / 2,
      y: (a.position.y + b.position.y) / 2
    };
  },

  getCenterDistance(a: Booth, b: Booth): number {
    const ax = a.position.x + a.size.width / 2;
    const ay = a.position.y + a.size.depth / 2;
    const bx = b.position.x + b.size.width / 2;
    const by = b.position.y + b.size.depth / 2;
    return Math.sqrt((ax - bx) ** 2 + (ay - by) ** 2);
  },

  createAffectedObject(booth: Booth): AffectedObject {
    return {
      id: booth.id,
      type: 'booth',
      name: booth.name
    };
  },

  calculateMinimumPassageAt(point: Position, rectangles: Rectangle[]): number {
    let minDistance = Infinity;
    
    for (const rect of rectangles) {
      const rectCenterX = rect.x + rect.width / 2;
      const rectCenterY = rect.y + rect.height / 2;
      const dist = Math.sqrt((point.x - rectCenterX) ** 2 + (point.y - rectCenterY) ** 2);
      
      if (dist < minDistance) {
        minDistance = dist;
      }
    }
    
    return minDistance * 2;
  },

  hasClearPath(
    start: Position, 
    end: Position, 
    obstacles: Rectangle[],
    hallSize: Size
  ): boolean {
    const steps = 20;
    const dx = (end.x - start.x) / steps;
    const dy = (end.y - start.y) / steps;

    for (let i = 0; i <= steps; i++) {
      const x = start.x + dx * i;
      const y = start.y + dy * i;

      if (x < 0 || x > hallSize.width || y < 0 || y > hallSize.depth) {
        continue;
      }

      const checkRect: Rectangle = { x: x - 0.5, y: y - 0.5, width: 1, height: 1 };
      
      for (const obstacle of obstacles) {
        if (this.doRectanglesOverlap(checkRect, obstacle)) {
          return false;
        }
      }
    }

    return true;
  }
};

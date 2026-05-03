/**
 * 规则评分模块
 * 负责计算分数、检测冲突、计算相邻加成、人流模拟和收入预估
 */

export class RuleEngine {
  constructor() {
    this.rules = {
      noiseConflict: {
        threshold: 80,
        penalty: -10,
        affectedCategories: ['children', 'handicraft'],
        description: '噪音冲突 - 高噪音摊位影响需要安静环境的摊位'
      },
      odorConflict: {
        threshold: 70,
        penalty: -8,
        affectedCategories: ['coffee', 'handicraft'],
        description: '气味冲突 - 强气味摊位影响对气味敏感的摊位'
      },
      fireExitBlocked: {
        penalty: -50,
        description: '消防通道被堵 - 严重安全隐患'
      },
      electricityOverload: {
        penalty: -15,
        description: '用电过载 - 超过场地最大电力容量'
      },
      budgetOverrun: {
        penalty: -20,
        description: '预算超支 - 超出预算限制'
      }
    };
  }

  /**
   * 评估当前布局
   * @param {Object} level - 关卡数据
   * @param {Array} placedStalls - 已放置的摊位
   * @returns {Object} 评估结果
   */
  evaluate(level, placedStalls) {
    const result = {
      score: 0,
      satisfaction: 0,
      risk: 0,
      income: 0,
      budget: {
        used: 0,
        total: level.budget,
        remaining: level.budget,
        overrun: false
      },
      electricity: {
        used: 0,
        total: level.maxElectricity,
        remaining: level.maxElectricity,
        overload: false
      },
      conflicts: [],
      bonuses: [],
      visitorFlow: [],
      stallDetails: []
    };

    // 计算预算和用电使用
    placedStalls.forEach(stall => {
      result.budget.used += stall.cost;
      result.electricity.used += stall.electricity;
    });

    result.budget.remaining = result.budget.total - result.budget.used;
    result.budget.overrun = result.budget.used > result.budget.total;

    result.electricity.remaining = result.electricity.total - result.electricity.used;
    result.electricity.overload = result.electricity.used > result.electricity.total;

    // 检测冲突
    this.detectConflicts(level, placedStalls, result);

    // 计算相邻加成
    this.calculateAdjacentBonuses(level, placedStalls, result);

    // 模拟人流和收入
    this.simulateVisitorFlow(level, placedStalls, result);

    // 计算最终分数
    this.calculateFinalScore(result);

    return result;
  }

  /**
   * 检测各种冲突
   */
  detectConflicts(level, placedStalls, result) {
    // 预算超支
    if (result.budget.overrun) {
      result.conflicts.push({
        type: 'budget',
        severity: 'high',
        message: `预算超支 ${result.budget.used - result.budget.total} 元`,
        penalty: this.rules.budgetOverrun.penalty
      });
    }

    // 用电过载
    if (result.electricity.overload) {
      result.conflicts.push({
        type: 'electricity',
        severity: 'high',
        message: `用电过载 ${result.electricity.used - result.electricity.total} 单位`,
        penalty: this.rules.electricityOverload.penalty
      });
    }

    // 检测消防通道占用
    this.checkFireExitBlocked(level, placedStalls, result);

    // 检测噪音冲突
    this.checkNoiseConflicts(placedStalls, result);

    // 检测气味冲突
    this.checkOdorConflicts(placedStalls, result);
  }

  /**
   * 检查消防通道是否被占用
   */
  checkFireExitBlocked(level, placedStalls, result) {
    level.fireExits.forEach(fireExit => {
      fireExit.cells.forEach(cell => {
        placedStalls.forEach(stall => {
          const stallCells = this.getStallOccupiedCells(stall);
          if (this.cellsOverlap([cell], stallCells)) {
            result.conflicts.push({
              type: 'fireExit',
              severity: 'critical',
              message: `消防通道被摊位 ${stall.name} 占用`,
              stall: stall.id,
              penalty: this.rules.fireExitBlocked.penalty
            });
          }
        });
      });
    });
  }

  /**
   * 检查噪音冲突
   */
  checkNoiseConflicts(placedStalls, result) {
    const rule = this.rules.noiseConflict;
    
    placedStalls.forEach(stall => {
      if (stall.noise >= rule.threshold) {
        placedStalls.forEach(otherStall => {
          if (stall.id !== otherStall.id && rule.affectedCategories.includes(otherStall.category)) {
            if (this.areAdjacent(stall, otherStall)) {
              result.conflicts.push({
                type: 'noise',
                severity: 'medium',
                message: `噪音冲突：${stall.name} 的噪音影响了 ${otherStall.name}`,
                affectedStalls: [stall.id, otherStall.id],
                penalty: rule.penalty
              });
            }
          }
        });
      }
    });
  }

  /**
   * 检查气味冲突
   */
  checkOdorConflicts(placedStalls, result) {
    const rule = this.rules.odorConflict;
    
    placedStalls.forEach(stall => {
      if (stall.odor >= rule.threshold) {
        placedStalls.forEach(otherStall => {
          if (stall.id !== otherStall.id && rule.affectedCategories.includes(otherStall.category)) {
            if (this.areAdjacent(stall, otherStall)) {
              result.conflicts.push({
                type: 'odor',
                severity: 'medium',
                message: `气味冲突：${stall.name} 的气味影响了 ${otherStall.name}`,
                affectedStalls: [stall.id, otherStall.id],
                penalty: rule.penalty
              });
            }
          }
        });
      }
    });
  }

  /**
   * 计算相邻加成
   */
  calculateAdjacentBonuses(level, placedStalls, result) {
    const adjacentBonuses = level.rules?.adjacentBonus || this.getDefaultAdjacentBonuses();
    
    // 检查每对相邻摊位
    placedStalls.forEach((stall, index) => {
      placedStalls.slice(index + 1).forEach(otherStall => {
        if (this.areAdjacent(stall, otherStall)) {
          // 检查是否有加成组合
          const combinations = [
            `${stall.category}+${otherStall.category}`,
            `${otherStall.category}+${stall.category}`
          ];
          
          for (const combo of combinations) {
            if (adjacentBonuses[combo]) {
              result.bonuses.push({
                type: 'adjacent',
                message: `相邻加成：${stall.name} 和 ${otherStall.name} 互补`,
                stalls: [stall.id, otherStall.id],
                bonus: adjacentBonuses[combo],
                description: this.getComboDescription(stall.category, otherStall.category)
              });
              break;
            }
          }

          // 检查摊位特定规则
          this.checkStallSpecificRules(stall, otherStall, result);
        }
      });
    });

    // 靠近入口的加成
    this.calculateEntranceProximityBonus(level, placedStalls, result);
  }

  /**
   * 检查摊位特定的相邻规则
   */
  checkStallSpecificRules(stall, otherStall, result) {
    if (stall.adjacentRules) {
      stall.adjacentRules.forEach(rule => {
        if (rule.requires === otherStall.category || rule.requires === otherStall.id) {
          if (rule.bonus > 0) {
            result.bonuses.push({
              type: 'specificAdjacent',
              message: `特殊加成：${stall.name} 受益于 ${otherStall.name}`,
              stalls: [stall.id, otherStall.id],
              bonus: rule.bonus
            });
          } else if (rule.bonus < 0) {
            result.conflicts.push({
              type: 'specificConflict',
              severity: 'low',
              message: `摊位冲突：${stall.name} 不适合与 ${otherStall.name} 相邻`,
              affectedStalls: [stall.id, otherStall.id],
              penalty: rule.bonus
            });
          }
        }
      });
    }
  }

  /**
   * 计算入口附近加成
   */
  calculateEntranceProximityBonus(level, placedStalls, result) {
    placedStalls.forEach(stall => {
      const stallCells = this.getStallOccupiedCells(stall);
      let minDistance = Infinity;

      level.entrances.forEach(entrance => {
        stallCells.forEach(cell => {
          const distance = this.manhattanDistance(cell, entrance.position);
          if (distance < minDistance) {
            minDistance = distance;
          }
        });
      });

      // 距离入口越近加成越高
      if (minDistance <= 2) {
        result.bonuses.push({
          type: 'entranceProximity',
          message: `${stall.name} 靠近入口，人流加成`,
          stall: stall.id,
          bonus: minDistance === 0 ? 10 : 5
        });
      }
    });
  }

  /**
   * 模拟人流
   */
  simulateVisitorFlow(level, placedStalls, result) {
    // 基础人流计算
    const baseVisitors = level.entrances.reduce((sum, e) => sum + e.flowRate, 0);
    
    // 每个摊位的吸引力影响人流分布
    const totalAttraction = placedStalls.reduce((sum, stall) => sum + stall.attraction, 0);
    
    placedStalls.forEach(stall => {
      let stallVisitors = 0;
      
      if (totalAttraction > 0) {
        // 基于吸引力的比例分配
        stallVisitors = Math.floor(baseVisitors * (stall.attraction / totalAttraction));
        
        // 加上相邻加成的影响
        const adjacentBonuses = result.bonuses.filter(b => 
          b.stalls && b.stalls.includes(stall.id) && b.type === 'adjacent'
        );
        const bonusMultiplier = 1 + (adjacentBonuses.reduce((sum, b) => sum + b.bonus, 0) / 100);
        stallVisitors = Math.floor(stallVisitors * bonusMultiplier);
        
        // 冲突惩罚
        const conflicts = result.conflicts.filter(c => 
          c.affectedStalls && c.affectedStalls.includes(stall.id)
        );
        const penaltyMultiplier = 1 - (conflicts.length * 0.1);
        stallVisitors = Math.max(0, Math.floor(stallVisitors * penaltyMultiplier));
      }

      // 计算收入
      const income = stallVisitors * stall.incomePerPerson;
      result.income += income;

      result.stallDetails.push({
        stall: stall.id,
        stallName: stall.name,
        visitors: stallVisitors,
        income: income,
        attraction: stall.attraction
      });
    });

    result.visitorFlow = {
      totalVisitors: baseVisitors,
      distributedVisitors: result.stallDetails.reduce((sum, s) => sum + s.visitors, 0)
    };
  }

  /**
   * 计算最终分数
   */
  calculateFinalScore(result) {
    let score = 0;
    
    // 基础分：收入贡献
    score += Math.floor(result.income / 10);
    
    // 加成分
    result.bonuses.forEach(bonus => {
      score += bonus.bonus;
    });
    
    // 冲突惩罚
    result.conflicts.forEach(conflict => {
      score += conflict.penalty;
    });
    
    // 预算使用效率
    if (!result.budget.overrun && result.budget.used > 0) {
      const budgetEfficiency = result.budget.used / result.budget.total;
      score += Math.floor(budgetEfficiency * 20);
    }
    
    // 用电效率
    if (!result.electricity.overload && result.electricity.used > 0) {
      const electricityEfficiency = result.electricity.used / result.electricity.total;
      score += Math.floor(electricityEfficiency * 15);
    }
    
    // 满意度计算 (0-100)
    result.satisfaction = Math.max(0, Math.min(100, 50 + score / 2));
    
    // 风险计算 (0-100)
    const criticalConflicts = result.conflicts.filter(c => c.severity === 'critical').length;
    const highConflicts = result.conflicts.filter(c => c.severity === 'high').length;
    result.risk = Math.min(100, criticalConflicts * 30 + highConflicts * 15);
    
    result.score = Math.max(0, score);
  }

  /**
   * 检查摊位是否可以放置在指定位置
   */
  canPlaceStall(level, stall, position, placedStalls) {
    const stallCells = this.getStallOccupiedCellsWithPosition(stall, position);
    
    // 检查是否超出边界
    for (const cell of stallCells) {
      if (cell.x < 0 || cell.x >= level.gridSize.width || 
          cell.y < 0 || cell.y >= level.gridSize.height) {
        return { canPlace: false, reason: '超出场地边界' };
      }
    }
    
    // 检查是否与主路重叠
    for (const road of level.mainRoads) {
      if (this.cellsOverlap(stallCells, road.cells)) {
        return { canPlace: false, reason: '不能占用主路' };
      }
    }
    
    // 检查是否与消防通道重叠
    for (const fireExit of level.fireExits) {
      if (fireExit.required && this.cellsOverlap(stallCells, fireExit.cells)) {
        return { canPlace: false, reason: '不能占用消防通道' };
      }
    }
    
    // 检查是否与障碍物重叠
    for (const obstacle of level.obstacles) {
      const obstacleCells = this.getObstacleOccupiedCells(obstacle);
      if (this.cellsOverlap(stallCells, obstacleCells)) {
        return { canPlace: false, reason: '不能占用固定障碍物位置' };
      }
    }
    
    // 检查是否与其他摊位重叠
    for (const placedStall of placedStalls) {
      const placedCells = this.getStallOccupiedCells(placedStall);
      if (this.cellsOverlap(stallCells, placedCells)) {
        return { canPlace: false, reason: `与摊位 ${placedStall.name} 重叠` };
      }
    }
    
    // 检查预算和用电（不阻止放置，但会给出警告）
    const warnings = [];
    const totalCost = placedStalls.reduce((sum, s) => sum + s.cost, 0) + stall.cost;
    const totalElectricity = placedStalls.reduce((sum, s) => sum + s.electricity, 0) + stall.electricity;
    
    if (totalCost > level.budget) {
      warnings.push(`预算超支 ${totalCost - level.budget} 元`);
    }
    if (totalElectricity > level.maxElectricity) {
      warnings.push(`用电过载 ${totalElectricity - level.maxElectricity} 单位`);
    }
    
    return { canPlace: true, warnings };
  }

  /**
   * 获取摊位占用的单元格
   */
  getStallOccupiedCells(stall) {
    return this.getStallOccupiedCellsWithPosition(stall, stall.position);
  }

  getStallOccupiedCellsWithPosition(stall, position) {
    const cells = [];
    for (let x = 0; x < stall.size.width; x++) {
      for (let y = 0; y < stall.size.height; y++) {
        cells.push({ x: position.x + x, y: position.y + y });
      }
    }
    return cells;
  }

  /**
   * 获取障碍物占用的单元格
   */
  getObstacleOccupiedCells(obstacle) {
    const cells = [];
    for (let x = 0; x < obstacle.size.width; x++) {
      for (let y = 0; y < obstacle.size.height; y++) {
        cells.push({ x: obstacle.position.x + x, y: obstacle.position.y + y });
      }
    }
    return cells;
  }

  /**
   * 检查两组单元格是否重叠
   */
  cellsOverlap(cells1, cells2) {
    return cells1.some(c1 => 
      cells2.some(c2 => c1.x === c2.x && c1.y === c2.y)
    );
  }

  /**
   * 检查两个摊位是否相邻
   */
  areAdjacent(stall1, stall2) {
    const cells1 = this.getStallOccupiedCells(stall1);
    const cells2 = this.getStallOccupiedCells(stall2);
    
    for (const c1 of cells1) {
      for (const c2 of cells2) {
        if (this.manhattanDistance(c1, c2) === 1) {
          return true;
        }
      }
    }
    return false;
  }

  /**
   * 曼哈顿距离
   */
  manhattanDistance(p1, p2) {
    return Math.abs(p1.x - p2.x) + Math.abs(p1.y - p2.y);
  }

  /**
   * 获取默认相邻加成
   */
  getDefaultAdjacentBonuses() {
    return {
      'coffee+handicraft': 15,
      'food+children': 10,
      'band+coffee': 12,
      'handicraft+children': 8
    };
  }

  /**
   * 获取组合描述
   */
  getComboDescription(cat1, cat2) {
    const descriptions = {
      'coffee+handicraft': '咖啡香气吸引手作文创爱好者驻足',
      'food+children': '家长带孩子吃饭后更愿意停留',
      'band+coffee': '音乐氛围让咖啡消费更高',
      'handicraft+children': '亲子家庭喜欢一起做手工'
    };
    
    const combo = `${cat1}+${cat2}`;
    const reverse = `${cat2}+${cat1}`;
    
    return descriptions[combo] || descriptions[reverse] || '摊位互补加成';
  }
}

export const ruleEngine = new RuleEngine();

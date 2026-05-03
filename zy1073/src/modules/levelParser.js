/**
 * 关卡解析模块
 * 负责解析关卡JSON数据，验证数据结构完整性
 */

export class LevelParser {
  constructor() {
    this.requiredFields = {
      level: ['id', 'name', 'description', 'gridSize', 'budget', 'maxElectricity', 'entrances', 'mainRoads', 'fireExits', 'obstacles', 'stalls', 'objectives'],
      stall: ['id', 'name', 'category', 'size', 'cost', 'electricity', 'noise', 'odor', 'attraction', 'incomePerPerson']
    };
  }

  /**
   * 解析关卡数据
   * @param {Object} rawData - 原始JSON数据
   * @returns {Object} 解析后的关卡对象
   */
  parse(rawData) {
    this.validateLevelStructure(rawData);
    
    const level = {
      id: rawData.id,
      name: rawData.name,
      description: rawData.description,
      gridSize: {
        width: rawData.gridSize.width,
        height: rawData.gridSize.height
      },
      budget: rawData.budget,
      maxElectricity: rawData.maxElectricity,
      entrances: this.parseEntrances(rawData.entrances),
      mainRoads: this.parseMainRoads(rawData.mainRoads),
      fireExits: this.parseFireExits(rawData.fireExits),
      obstacles: this.parseObstacles(rawData.obstacles),
      stalls: this.parseStalls(rawData.stalls),
      objectives: this.parseObjectives(rawData.objectives),
      rules: rawData.rules || this.getDefaultRules()
    };

    this.calculateDerivedProperties(level);
    return level;
  }

  /**
   * 验证关卡结构
   * @param {Object} data - 关卡数据
   */
  validateLevelStructure(data) {
    const missingFields = this.requiredFields.level.filter(field => !(field in data));
    if (missingFields.length > 0) {
      throw new Error(`关卡数据缺少必要字段: ${missingFields.join(', ')}`);
    }

    if (!Array.isArray(data.stalls) || data.stalls.length === 0) {
      throw new Error('关卡数据中缺少摊位定义');
    }

    data.stalls.forEach(stall => {
      const missingStallFields = this.requiredFields.stall.filter(field => !(field in stall));
      if (missingStallFields.length > 0) {
        throw new Error(`摊位 ${stall.id || '未知'} 缺少必要字段: ${missingStallFields.join(', ')}`);
      }
    });
  }

  /**
   * 解析入口点
   */
  parseEntrances(entrances) {
    return entrances.map(entrance => ({
      id: entrance.id || `entrance_${Date.now()}`,
      position: entrance.position,
      flowRate: entrance.flowRate || 100
    }));
  }

  /**
   * 解析主路
   */
  parseMainRoads(mainRoads) {
    return mainRoads.map(road => ({
      id: road.id || `road_${Date.now()}`,
      cells: road.cells,
      priority: road.priority || 1
    }));
  }

  /**
   * 解析消防通道
   */
  parseFireExits(fireExits) {
    return fireExits.map(exit => ({
      id: exit.id || `fireexit_${Date.now()}`,
      cells: exit.cells,
      required: exit.required !== false
    }));
  }

  /**
   * 解析障碍物
   */
  parseObstacles(obstacles) {
    return obstacles.map(obstacle => ({
      id: obstacle.id || `obstacle_${Date.now()}`,
      position: obstacle.position,
      size: obstacle.size || { width: 1, height: 1 },
      type: obstacle.type || 'fixed'
    }));
  }

  /**
   * 解析摊位数据
   */
  parseStalls(stalls) {
    return stalls.map(stall => ({
      id: stall.id,
      name: stall.name,
      category: stall.category,
      categoryName: this.getCategoryName(stall.category),
      size: {
        width: stall.size.width,
        height: stall.size.height
      },
      cost: stall.cost,
      electricity: stall.electricity,
      noise: stall.noise,
      odor: stall.odor,
      attraction: stall.attraction,
      incomePerPerson: stall.incomePerPerson,
      adjacentRules: stall.adjacentRules || [],
      color: stall.color || this.getCategoryColor(stall.category),
      emoji: stall.emoji || this.getCategoryEmoji(stall.category)
    }));
  }

  /**
   * 解析目标
   */
  parseObjectives(objectives) {
    return objectives.map(obj => ({
      id: obj.id,
      type: obj.type,
      description: obj.description,
      target: obj.target,
      weight: obj.weight || 1
    }));
  }

  /**
   * 获取默认规则
   */
  getDefaultRules() {
    return {
      noiseConflict: {
        threshold: 80,
        penalty: -5,
        affectedCategories: ['children', 'handicraft']
      },
      odorConflict: {
        threshold: 70,
        penalty: -5,
        affectedCategories: ['coffee', 'handicraft']
      },
      adjacentBonus: {
        'coffee+handicraft': 15,
        'food+children': 10,
        'band+coffee': 12,
        'handicraft+children': 8
      }
    };
  }

  /**
   * 计算派生属性
   */
  calculateDerivedProperties(level) {
    level.totalCells = level.gridSize.width * level.gridSize.height;
    level.occupiedCells = this.calculateOccupiedCells(level);
    level.availableCells = level.totalCells - level.occupiedCells;
  }

  /**
   * 计算已占用的单元格数
   */
  calculateOccupiedCells(level) {
    let count = 0;
    level.mainRoads.forEach(road => count += road.cells.length);
    level.fireExits.forEach(exit => count += exit.cells.length);
    level.obstacles.forEach(obstacle => count += obstacle.size.width * obstacle.size.height);
    return count;
  }

  /**
   * 获取分类名称
   */
  getCategoryName(category) {
    const names = {
      coffee: '咖啡饮品',
      food: '热食餐饮',
      handicraft: '手作文创',
      band: '乐队表演',
      children: '儿童游乐'
    };
    return names[category] || category;
  }

  /**
   * 获取分类颜色
   */
  getCategoryColor(category) {
    const colors = {
      coffee: '#8B4513',
      food: '#FF6347',
      handicraft: '#9370DB',
      band: '#4682B4',
      children: '#32CD32'
    };
    return colors[category] || '#808080';
  }

  /**
   * 获取分类表情
   */
  getCategoryEmoji(category) {
    const emojis = {
      coffee: '☕',
      food: '🍔',
      handicraft: '🎨',
      band: '🎸',
      children: '👶'
    };
    return emojis[category] || '🏪';
  }
}

export const levelParser = new LevelParser();

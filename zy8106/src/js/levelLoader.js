import { TASK_TYPES, TASK_TYPE_INFO, PRIORITY_LEVELS } from './constants.js';
import { generateId, validateLevelConfig, deepClone } from './utils.js';

class LevelLoader {
  constructor() {
    this.levels = new Map();
    this.currentLevel = null;
  }

  async loadLevel(levelId) {
    let levelData;
    
    try {
      const response = await fetch(`/src/levels/${levelId}.json`);
      if (response.ok) {
        levelData = await response.json();
      }
    } catch (error) {
      console.log('尝试从本地文件加载失败，使用内置关卡');
    }
    
    if (!levelData) {
      levelData = this.getBuiltinLevel(levelId);
      if (!levelData) {
        throw new Error(`无法找到关卡: ${levelId}`);
      }
    }
    
    const validation = validateLevelConfig(levelData);
    if (!validation.valid) {
      throw new Error(`关卡配置无效: ${validation.error}`);
    }
    
    this.currentLevel = this.normalizeLevel(levelData);
    this.levels.set(levelId, this.currentLevel);
    
    return deepClone(this.currentLevel);
  }

  getBuiltinLevel(levelId) {
    const builtinLevels = {
      'level-1': {
        id: 'level-1',
        name: '新手训练场',
        description: '学习基础调度操作，熟悉拖拽机制',
        channels: 4,
        slots: 4,
        initialBattery: 100,
        tasks: [
          {
            id: 'task-1',
            type: TASK_TYPES.RESCUE,
            name: '消防救援队A',
            description: '城市中心火灾救援',
            priority: PRIORITY_LEVELS.HIGH,
            powerConsumption: 12,
            coverageRadius: 3,
            position: { x: 5, y: 5 }
          },
          {
            id: 'task-2',
            type: TASK_TYPES.HOSPITAL,
            name: '中心医院',
            description: '接收伤员救治',
            priority: PRIORITY_LEVELS.HIGH,
            powerConsumption: 8,
            coverageRadius: 5,
            position: { x: 10, y: 8 }
          },
          {
            id: 'task-3',
            type: TASK_TYPES.STATION,
            name: '临时基站1',
            description: '增强区域信号覆盖',
            priority: PRIORITY_LEVELS.MEDIUM,
            powerConsumption: 15,
            coverageRadius: 8,
            position: { x: 7, y: 6 }
          }
        ]
      },
      'level-2': {
        id: 'level-2',
        name: '复杂调度',
        description: '多任务协调，需要避免同频干扰',
        channels: 6,
        slots: 5,
        initialBattery: 85,
        tasks: [
          {
            id: 'task-1',
            type: TASK_TYPES.RESCUE,
            name: '消防救援队A',
            description: '东区火灾救援',
            priority: PRIORITY_LEVELS.HIGH,
            powerConsumption: 15,
            coverageRadius: 3,
            position: { x: 3, y: 3 }
          },
          {
            id: 'task-2',
            type: TASK_TYPES.RESCUE,
            name: '消防救援队B',
            description: '西区建筑坍塌救援',
            priority: PRIORITY_LEVELS.HIGH,
            powerConsumption: 15,
            coverageRadius: 3,
            position: { x: 15, y: 12 }
          },
          {
            id: 'task-3',
            type: TASK_TYPES.HOSPITAL,
            name: '第一医院',
            description: '主要医疗中心',
            priority: PRIORITY_LEVELS.HIGH,
            powerConsumption: 10,
            coverageRadius: 5,
            position: { x: 8, y: 5 }
          },
          {
            id: 'task-4',
            type: TASK_TYPES.HOSPITAL,
            name: '第二医院',
            description: '备用医疗点',
            priority: PRIORITY_LEVELS.MEDIUM,
            powerConsumption: 8,
            coverageRadius: 4,
            position: { x: 12, y: 10 }
          },
          {
            id: 'task-5',
            type: TASK_TYPES.STATION,
            name: '临时基站1',
            description: '北区信号增强',
            priority: PRIORITY_LEVELS.MEDIUM,
            powerConsumption: 20,
            coverageRadius: 8,
            position: { x: 5, y: 15 }
          },
          {
            id: 'task-6',
            type: TASK_TYPES.STATION,
            name: '临时基站2',
            description: '南区信号增强',
            priority: PRIORITY_LEVELS.LOW,
            powerConsumption: 18,
            coverageRadius: 7,
            position: { x: 10, y: 2 }
          }
        ]
      },
      'level-3': {
        id: 'level-3',
        name: '极限挑战',
        description: '资源紧张，需要精确规划每个时隙',
        channels: 8,
        slots: 6,
        initialBattery: 60,
        tasks: [
          {
            id: 'task-1',
            type: TASK_TYPES.RESCUE,
            name: '消防救援队A',
            description: '化工厂爆炸救援',
            priority: PRIORITY_LEVELS.HIGH,
            powerConsumption: 18,
            coverageRadius: 2,
            position: { x: 6, y: 6 }
          },
          {
            id: 'task-2',
            type: TASK_TYPES.RESCUE,
            name: '消防救援队B',
            description: '地铁事故救援',
            priority: PRIORITY_LEVELS.HIGH,
            powerConsumption: 16,
            coverageRadius: 3,
            position: { x: 12, y: 8 }
          },
          {
            id: 'task-3',
            type: TASK_TYPES.RESCUE,
            name: '医疗救援队',
            description: '野外伤员搜救',
            priority: PRIORITY_LEVELS.HIGH,
            powerConsumption: 14,
            coverageRadius: 4,
            position: { x: 3, y: 12 }
          },
          {
            id: 'task-4',
            type: TASK_TYPES.HOSPITAL,
            name: '中心医院',
            description: '主要救治中心',
            priority: PRIORITY_LEVELS.HIGH,
            powerConsumption: 12,
            coverageRadius: 6,
            position: { x: 9, y: 5 }
          },
          {
            id: 'task-5',
            type: TASK_TYPES.HOSPITAL,
            name: '野战医院',
            description: '临时医疗点',
            priority: PRIORITY_LEVELS.MEDIUM,
            powerConsumption: 10,
            coverageRadius: 4,
            position: { x: 5, y: 10 }
          },
          {
            id: 'task-6',
            type: TASK_TYPES.STATION,
            name: '临时基站1',
            description: '主基站',
            priority: PRIORITY_LEVELS.MEDIUM,
            powerConsumption: 25,
            coverageRadius: 10,
            position: { x: 8, y: 8 }
          },
          {
            id: 'task-7',
            type: TASK_TYPES.STATION,
            name: '临时基站2',
            description: '备用基站',
            priority: PRIORITY_LEVELS.LOW,
            powerConsumption: 20,
            coverageRadius: 8,
            position: { x: 14, y: 4 }
          },
          {
            id: 'task-8',
            type: TASK_TYPES.STATION,
            name: '临时基站3',
            description: '边缘覆盖',
            priority: PRIORITY_LEVELS.LOW,
            powerConsumption: 15,
            coverageRadius: 6,
            position: { x: 2, y: 3 }
          }
        ]
      }
    };
    
    return builtinLevels[levelId] || null;
  }

  normalizeLevel(levelData) {
    const normalized = deepClone(levelData);
    
    normalized.tasks = normalized.tasks.map(task => ({
      ...task,
      id: task.id || generateId(),
      type: task.type || TASK_TYPES.STATION,
      priority: task.priority || TASK_TYPE_INFO[task.type]?.defaultPriority || PRIORITY_LEVELS.MEDIUM,
      powerConsumption: task.powerConsumption || TASK_TYPE_INFO[task.type]?.powerConsumption || 10,
      coverageRadius: task.coverageRadius || TASK_TYPE_INFO[task.type]?.coverageRadius || 5,
      position: task.position || { x: 0, y: 0 },
      scheduled: null
    }));
    
    return normalized;
  }

  getCurrentLevel() {
    return this.currentLevel ? deepClone(this.currentLevel) : null;
  }

  getAvailableLevels() {
    return ['level-1', 'level-2', 'level-3'];
  }

  async getLevelInfo(levelId) {
    const level = await this.loadLevel(levelId);
    return {
      id: level.id,
      name: level.name,
      description: level.description,
      taskCount: level.tasks.length,
      channels: level.channels,
      slots: level.slots
    };
  }
}

export const levelLoader = new LevelLoader();
export default LevelLoader;

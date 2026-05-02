const config = require('../config');

class DangerLevelError extends Error {
  constructor(message, code = 'DANGER_LEVEL_ERROR') {
    super(message);
    this.name = 'DangerLevelError';
    this.code = code;
    this.status = 400;
  }
}

class DangerLevelValidator {
  static dangerLevels = config.danger_levels;

  static dangerLevelInfo = {
    [config.danger_levels.low]: {
      name: '低危险',
      description: '常规化学品，风险较低',
      color: 'green',
      priority: 1,
      approval_required: false,
      storage_restrictions: null
    },
    [config.danger_levels.medium]: {
      name: '中危险',
      description: '有一定风险的化学品，需要注意操作规范',
      color: 'yellow',
      priority: 2,
      approval_required: false,
      storage_restrictions: '通风良好的储存区域'
    },
    [config.danger_levels.high]: {
      name: '高危险',
      description: '具有较高风险的化学品，需要严格管理',
      color: 'orange',
      priority: 3,
      approval_required: true,
      storage_restrictions: '专用危险化学品储存柜'
    },
    [config.danger_levels.extreme]: {
      name: '极高危险',
      description: '具有极高风险的化学品，需要特殊管理和审批',
      color: 'red',
      priority: 4,
      approval_required: true,
      storage_restrictions: '防爆/防腐蚀专用储存设施'
    }
  };

  static isValid(dangerLevel) {
    return Object.values(this.dangerLevels).includes(dangerLevel);
  }

  static validate(dangerLevel) {
    if (!dangerLevel) {
      throw new DangerLevelError(
        '危险等级不能为空',
        'MISSING_DANGER_LEVEL'
      );
    }
    
    if (!this.isValid(dangerLevel)) {
      const validLevels = Object.values(this.dangerLevels).join(', ');
      throw new DangerLevelError(
        `无效的危险等级: ${dangerLevel}。有效等级: ${validLevels}`,
        'INVALID_DANGER_LEVEL'
      );
    }
    return true;
  }

  static getInfo(dangerLevel) {
    return this.dangerLevelInfo[dangerLevel] || null;
  }

  static requiresApproval(dangerLevel) {
    const info = this.getInfo(dangerLevel);
    return info ? info.approval_required : false;
  }

  static checkApprovalRequired(dangerLevel, isApproved = false) {
    if (this.requiresApproval(dangerLevel)) {
      const info = this.getInfo(dangerLevel);
      if (!isApproved) {
        throw new DangerLevelError(
          `${info.name}化学品需要安全员审批`,
          'APPROVAL_REQUIRED'
        );
      }
    }
    return true;
  }

  static compare(level1, level2) {
    const priority1 = this.getInfo(level1)?.priority || 0;
    const priority2 = this.getInfo(level2)?.priority || 0;
    return priority1 - priority2;
  }

  static isHigherOrEqual(level1, level2) {
    return this.compare(level1, level2) >= 0;
  }

  static isLowerOrEqual(level1, level2) {
    return this.compare(level1, level2) <= 0;
  }

  static getByPriority(minPriority = 1) {
    const levels = [];
    for (const [key, info] of Object.entries(this.dangerLevelInfo)) {
      if (info.priority >= minPriority) {
        levels.push({
          level: key,
          ...info
        });
      }
    }
    return levels.sort((a, b) => a.priority - b.priority);
  }

  static validateStorageLocation(dangerLevel, storageLocation) {
    const info = this.getInfo(dangerLevel);
    if (!info || !info.storage_restrictions) {
      return true;
    }
    
    if (!storageLocation) {
      throw new DangerLevelError(
        `${info.name}化学品需要指定储存位置`,
        'MISSING_STORAGE_LOCATION'
      );
    }
    
    return true;
  }

  static getAllDangerLevels() {
    return Object.entries(this.dangerLevelInfo).map(([level, info]) => ({
      level,
      ...info
    })).sort((a, b) => a.priority - b.priority);
  }
}

module.exports = { DangerLevelValidator, DangerLevelError };

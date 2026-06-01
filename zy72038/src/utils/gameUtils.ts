import {
  GameConfig,
  Level,
  GameEvent,
  ResourceConfig,
  ValidationError,
  ImportResult,
  TowerType,
  EnemyType,
  ActionRecord,
  AnalysisReport,
  Evidence,
  DataConflict,
  FailureReason,
} from '@/types/game';

export const generateId = (): string => {
  return Math.random().toString(36).substring(2, 15);
};

export const TOWER_CONFIG: Record<TowerType, {
  name: string;
  damage: number;
  range: number;
  cost: number;
  description: string;
}> = {
  firewall: {
    name: '防火墙',
    damage: 20,
    range: 3,
    cost: 100,
    description: '阻挡基础攻击',
  },
  encryption: {
    name: '加密塔',
    damage: 35,
    range: 2,
    cost: 150,
    description: '对恶意软件额外伤害',
  },
  backup: {
    name: '备份塔',
    damage: 15,
    range: 4,
    cost: 120,
    description: '范围攻击',
  },
  monitor: {
    name: '监控塔',
    damage: 10,
    range: 5,
    cost: 80,
    description: '减速敌人',
  },
};

export const ENEMY_CONFIG: Record<EnemyType, {
  name: string;
  health: number;
  speed: number;
  damage: number;
  reward: number;
}> = {
  phishing: {
    name: '钓鱼邮件',
    health: 50,
    speed: 1.5,
    damage: 10,
    reward: 20,
  },
  malware: {
    name: '恶意软件',
    health: 80,
    speed: 1,
    damage: 15,
    reward: 30,
  },
  ransomware: {
    name: '勒索病毒',
    health: 150,
    speed: 0.8,
    damage: 25,
    reward: 50,
  },
  hack: {
    name: '黑客攻击',
    health: 200,
    speed: 0.5,
    damage: 35,
    reward: 80,
  },
};

export const validateLevel = (
  level: Level,
  index: number
): ValidationError[] => {
  const errors: ValidationError[] = [];

  if (!level.name || level.name.trim() === '') {
    errors.push({
      type: 'empty_level',
      field: `levels[${index}].name`,
      message: `第 ${index + 1} 关名称为空`,
      suggestion: '请填写关卡名称，或确认是否为预留空关卡',
    });
  }

  if (level.waveCount <= 0) {
    errors.push({
      type: 'empty_level',
      field: `levels[${index}].waveCount`,
      message: `第 ${index + 1} 关波次数为 ${level.waveCount}，可能是空关卡`,
      scoreboardValue: '> 0',
      importedValue: String(level.waveCount),
      suggestion: '检查是否遗漏了波次配置，或保留为教学演示空关卡',
    });
  }

  if (level.difficulty < 1 || level.difficulty > 10) {
    errors.push({
      type: 'out_of_bounds',
      field: `levels[${index}].difficulty`,
      message: `第 ${index + 1} 关难度值 ${level.difficulty} 超出边界 (1-10)`,
      scoreboardValue: '1-10',
      importedValue: String(level.difficulty),
      suggestion: '难度值建议在1-10范围内，或保留原始值用于特殊教学场景',
    });
  }

  return errors;
};

export const validateEvent = (
  event: GameEvent,
  index: number,
  allEvents: GameEvent[]
): ValidationError[] => {
  const errors: ValidationError[] = [];

  const duplicates = allEvents.filter(
    (e, i) => i !== index && e.id === event.id
  );
  if (duplicates.length > 0) {
    errors.push({
      type: 'duplicate_event',
      field: `events[${index}].id`,
      message: `事件ID "${event.id}" 重复出现`,
      scoreboardValue: '唯一ID',
      importedValue: event.id,
      suggestion: '检查是否重复导入，或保留重复事件用于教学对比',
    });
  }

  if (event.timestamp < 0) {
    errors.push({
      type: 'out_of_bounds',
      field: `events[${index}].timestamp`,
      message: `事件时间戳 ${event.timestamp} 为负数`,
      scoreboardValue: '>= 0',
      importedValue: String(event.timestamp),
      suggestion: '检查时间戳格式，或保留用于演示异常数据处理',
    });
  }

  return errors;
};

export const validateResources = (
  resources: ResourceConfig
): ValidationError[] => {
  const errors: ValidationError[] = [];

  if (resources.maxCoins <= 0 || resources.maxCoins > 10000) {
    errors.push({
      type: 'out_of_bounds',
      field: 'resources.maxCoins',
      message: `最大金币 ${resources.maxCoins} 超出合理范围 (1-10000)`,
      scoreboardValue: '1-10000',
      importedValue: String(resources.maxCoins),
      suggestion: '建议金币上限在10000以内，或保留原始值用于边界测试',
    });
  }

  if (resources.maxHealth <= 0 || resources.maxHealth > 1000) {
    errors.push({
      type: 'out_of_bounds',
      field: 'resources.maxHealth',
      message: `最大生命值 ${resources.maxHealth} 超出合理范围 (1-1000)`,
      scoreboardValue: '1-1000',
      importedValue: String(resources.maxHealth),
      suggestion: '建议生命值上限在1000以内，或保留原始值用于边界测试',
    });
  }

  if (resources.startCoins > resources.maxCoins) {
    errors.push({
      type: 'out_of_bounds',
      field: 'resources.startCoins',
      message: `起始金币 ${resources.startCoins} 超过最大金币 ${resources.maxCoins}`,
      scoreboardValue: `<= ${resources.maxCoins}`,
      importedValue: String(resources.startCoins),
      suggestion: '起始金币不应超过最大值，或保留用于演示资源溢出场景',
    });
  }

  if (resources.startHealth > resources.maxHealth) {
    errors.push({
      type: 'out_of_bounds',
      field: 'resources.startHealth',
      message: `起始生命值 ${resources.startHealth} 超过最大生命值 ${resources.maxHealth}`,
      scoreboardValue: `<= ${resources.maxHealth}`,
      importedValue: String(resources.startHealth),
      suggestion: '起始生命值不应超过最大值，或保留用于演示满血复活场景',
    });
  }

  return errors;
};

export const validateGameConfig = (config: GameConfig): ImportResult => {
  const errors: ValidationError[] = [];
  const warnings: ValidationError[] = [];

  if (config.levels.length === 0) {
    errors.push({
      type: 'empty_level',
      field: 'levels',
      message: '没有配置任何关卡',
      suggestion: '请至少配置一个关卡，或使用默认演示关卡',
    });
  }

  config.levels.forEach((level, index) => {
    const levelErrors = validateLevel(level, index);
    if (level.isEmpty) {
      warnings.push(...levelErrors);
    } else {
      errors.push(...levelErrors);
    }
  });

  config.events.forEach((event, index) => {
    const eventErrors = validateEvent(event, index, config.events);
    if (event.isDuplicate) {
      warnings.push(...eventErrors);
    } else {
      errors.push(...eventErrors);
    }
  });

  const resourceErrors = validateResources(config.resources);
  if (config.resources.outOfBounds) {
    warnings.push(...resourceErrors);
  } else {
    errors.push(...resourceErrors);
  }

  return {
    config,
    errors,
    warnings,
    rawData: JSON.stringify(config, null, 2),
  };
};

export const parseCSVData = (csvText: string): ImportResult => {
  const lines = csvText.trim().split('\n');
  if (lines.length < 2) {
    return {
      config: null,
      errors: [
        {
          type: 'missing_field',
          field: 'csv',
          message: 'CSV数据格式不正确或为空',
          suggestion: '请检查CSV文件格式，确保包含表头和数据行',
        },
      ],
      warnings: [],
      rawData: csvText,
    };
  }

  const config: GameConfig = {
    id: generateId(),
    name: '导入的课堂计分表',
    levels: [],
    events: [],
    resources: {
      maxCoins: 1000,
      maxHealth: 100,
      startCoins: 500,
      startHealth: 100,
    },
    remarks: '',
    sourceData: { csvLines: lines },
  };

  return validateGameConfig(config);
};

export const parseJSONData = (jsonText: string): ImportResult => {
  try {
    const data = JSON.parse(jsonText);

    const config: GameConfig = {
      id: data.id || generateId(),
      name: data.name || '导入的游戏配置',
      levels: data.levels || [],
      events: data.events || [],
      resources: data.resources || {
        maxCoins: 1000,
        maxHealth: 100,
        startCoins: 500,
        startHealth: 100,
      },
      remarks: data.remarks || '',
      sourceData: data,
    };

    return validateGameConfig(config);
  } catch {
    return {
      config: null,
      errors: [
        {
          type: 'missing_field',
          field: 'json',
          message: 'JSON数据格式不正确',
          suggestion: '请检查JSON文件格式，确保语法正确',
        },
      ],
      warnings: [],
      rawData: jsonText,
    };
  }
};

export const generateAnalysisReport = (
  isSuccess: boolean,
  actions: ActionRecord[],
  totalPlayTime: number,
  totalWaves: number,
  completedWaves: number,
  health: number
): AnalysisReport => {
  const validActions = actions.filter((a) => a.isValid !== false);
  const invalidActions = actions.filter((a) => a.isValid === false);

  const responseTimes = validActions
    .map((a) => a.responseTime)
    .filter((t): t is number => t !== undefined);

  const avgResponseTime =
    responseTimes.length > 0
      ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
      : 0;

  const slowResponses = responseTimes.filter((t) => t > 3000).length;
  const hasRuleViolations = invalidActions.length > 0;
  const isSlowOperation = slowResponses > responseTimes.length * 0.3;

  let failureReason: FailureReason | undefined;
  let failureReasonDescription = '';

  if (!isSuccess) {
    if (hasRuleViolations && isSlowOperation) {
      failureReason = 'mixed';
      failureReasonDescription = '规则理解有误且操作速度较慢';
    } else if (hasRuleViolations) {
      failureReason = 'rule_understanding';
      failureReasonDescription = '对游戏规则理解不够，存在违规操作';
    } else if (isSlowOperation) {
      failureReason = 'slow_operation';
      failureReasonDescription = '操作速度较慢，未能及时应对攻击';
    } else if (health <= 0) {
      failureReason = 'mixed';
      failureReasonDescription = '钱包生命值耗尽，防守失败';
    }
  }

  const evidence: Evidence[] = [];

  invalidActions.slice(0, 5).forEach((action, index) => {
    evidence.push({
      id: `evidence-rule-${index}`,
      type: 'rule',
      description: `违规操作: ${action.remarks || '未遵循游戏规则'}`,
      timestamp: action.timestamp,
      source: '游戏操作记录',
      details: `操作类型: ${action.type}`,
    });
  });

  if (slowResponses > 0) {
    evidence.push({
      id: 'evidence-speed-1',
      type: 'action',
      description: `发现 ${slowResponses} 次响应时间超过3秒的操作`,
      timestamp: Date.now(),
      source: '操作时间分析',
      details: `平均响应时间: ${avgResponseTime.toFixed(0)}ms`,
    });
  }

  const conflicts: DataConflict[] = [];
  const suggestions: string[] = [];

  if (hasRuleViolations) {
    suggestions.push('建议复习游戏规则，特别是防守塔建造时机和位置要求');
    suggestions.push('多练习基础操作，熟悉各种防守塔的功能和使用场景');
  }

  if (isSlowOperation) {
    suggestions.push('建议提升操作熟练度，可以通过简单关卡反复练习');
    suggestions.push('尝试提前规划防守策略，减少临场思考时间');
  }

  if (completedWaves < totalWaves && !isSuccess) {
    suggestions.push(`本次完成了 ${completedWaves}/${totalWaves} 波攻击，建议从失败的波次开始重试`);
  }

  const finalScore = Math.floor(
    (completedWaves / Math.max(1, totalWaves)) * 100 +
      (health / 100) * 20 -
      invalidActions.length * 5
  );

  return {
    isSuccess,
    finalScore: Math.max(0, finalScore),
    totalWaves,
    completedWaves,
    failureReason,
    failureReasonDescription,
    evidence,
    conflicts,
    suggestions,
    totalPlayTime,
    avgResponseTime,
    ruleViolations: invalidActions.length,
  };
};

export const formatTime = (ms: number): string => {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
};

export const getDefaultGameConfig = (): GameConfig => {
  return {
    id: generateId(),
    name: '链上钱包防守塔 - 教学演示',
    levels: [
      {
        id: 1,
        name: '第一关：基础防护',
        waveCount: 3,
        difficulty: 2,
        remarks: '入门关卡，学习基本操作',
      },
      {
        id: 2,
        name: '第二关：多重威胁',
        waveCount: 5,
        difficulty: 5,
      },
      {
        id: 3,
        name: '第三关：终极挑战',
        waveCount: 7,
        difficulty: 8,
        remarks: '包含所有敌人类型',
      },
    ],
    events: [],
    resources: {
      maxCoins: 1000,
      maxHealth: 100,
      startCoins: 500,
      startHealth: 100,
    },
    remarks: '默认演示配置，用于课堂教学',
  };
};

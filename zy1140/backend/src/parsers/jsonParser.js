const _ = require('lodash');

const VALID_CATEGORIES = ['sleep', 'heart_rate', 'activity', 'recovery', 'stress', 'nutrition'];

function parseThresholdsJSON(jsonContent) {
  let data;
  try {
    data = JSON.parse(jsonContent);
  } catch (e) {
    throw new Error(`Invalid JSON: ${e.message}`);
  }

  const thresholds = [];
  const errors = [];

  let rawThresholds = [];
  
  if (data.thresholds && Array.isArray(data.thresholds)) {
    rawThresholds = data.thresholds;
  } else if (Array.isArray(data)) {
    rawThresholds = data;
  } else if (data.category && data.key) {
    rawThresholds = [data];
  } else if (typeof data === 'object') {
    for (const [category, items] of Object.entries(data)) {
      if (typeof items === 'object' && items !== null) {
        if (Array.isArray(items)) {
          for (const item of items) {
            thresholds.push(parseThresholdItem(item, category, errors));
          }
        } else {
          thresholds.push(parseThresholdItem(items, category, errors));
        }
      }
    }
    return {
      thresholds: thresholds.filter(Boolean),
      errors,
      totalCount: thresholds.length,
      validCount: thresholds.filter(Boolean).length,
    };
  }

  for (const item of rawThresholds) {
    const parsed = parseThresholdItem(item, item.category, errors);
    if (parsed) {
      thresholds.push(parsed);
    }
  }

  return {
    thresholds: thresholds.filter(Boolean),
    errors,
    totalCount: rawThresholds.length,
    validCount: thresholds.filter(Boolean).length,
  };
}

function parseThresholdItem(item, defaultCategory, errors) {
  if (!item || typeof item !== 'object') {
    return null;
  }

  const category = item.category || defaultCategory;
  const key = item.key;
  const value = item.value;

  if (!category || !key || value === undefined) {
    errors.push({
      item,
      error: 'Missing required fields: category, key, or value',
    });
    return null;
  }

  if (!VALID_CATEGORIES.includes(category)) {
    console.warn(`Unknown threshold category: ${category}, using as-is`);
  }

  let numValue = parseFloat(value);
  if (isNaN(numValue)) {
    if (typeof value === 'boolean') {
      numValue = value ? 1 : 0;
    } else {
      errors.push({
        item,
        error: `Invalid value type for ${category}.${key}: expected number, got ${typeof value}`,
      });
      return null;
    }
  }

  return {
    id: `threshold_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    category,
    key,
    value: numValue,
    label: item.label || buildDefaultLabel(category, key),
    description: item.description || '',
    unit: item.unit || '',
  };
}

function buildDefaultLabel(category, key) {
  const labelMap = {
    sleep: {
      'target_hours': '目标睡眠时长',
      'min_acceptable': '最低可接受睡眠',
      'consecutive_bad_days': '连续睡眠不足天数',
      'bedtime_target': '目标就寝时间',
      'waketime_target': '目标起床时间',
      'deep_sleep_min': '深睡最低比例',
      'rem_sleep_min': 'REM睡眠最低比例',
    },
    heart_rate: {
      'resting_high': '静息心率偏高阈值',
      'resting_low': '静息心率偏低阈值',
      'resting_target': '静息心率目标',
      'variability_low': 'HRV偏低阈值',
      'variability_target': 'HRV目标',
      'max_safe': '最高安全心率',
      'zone1_max': '心率区间1上限',
      'zone2_max': '心率区间2上限',
      'zone3_max': '心率区间3上限',
      'zone4_max': '心率区间4上限',
      'zone5_max': '心率区间5上限',
    },
    activity: {
      'steps_target': '每日步数目标',
      'steps_low': '步数过低阈值',
      'steps_high': '步数过高阈值',
      'workout_sudden_increase': '运动量突增比例',
      'workout_min_duration': '运动最低时长',
      'active_energy_target': '活动能量目标',
      'active_minutes_target': '活动分钟目标',
    },
    recovery: {
      'sleep_debt_threshold': '累计睡眠债阈值',
      'recovery_days_needed': '恢复所需天数',
      'hrv_recovery_ratio': 'HRV恢复比例',
    },
    stress: {
      'stress_threshold': '压力阈值',
      'rest_period_minutes': '休息时长',
    },
  };

  return labelMap[category]?.[key] || `${category}_${key}`;
}

function generateDefaultThresholds() {
  return [
    { category: 'sleep', key: 'target_hours', value: 7.5, label: '目标睡眠时长', description: '每日推荐睡眠时长', unit: '小时' },
    { category: 'sleep', key: 'min_acceptable', value: 6, label: '最低可接受睡眠', description: '低于此值视为睡眠不足', unit: '小时' },
    { category: 'sleep', key: 'consecutive_bad_days', value: 3, label: '连续睡眠不足天数', description: '连续多少天睡眠不足触发预警', unit: '天' },
    
    { category: 'heart_rate', key: 'resting_high', value: 80, label: '静息心率偏高阈值', description: '静息心率高于此值视为偏高', unit: 'bpm' },
    { category: 'heart_rate', key: 'resting_low', value: 40, label: '静息心率偏低阈值', description: '静息心率低于此值视为偏低', unit: 'bpm' },
    { category: 'heart_rate', key: 'variability_low', value: 20, label: 'HRV偏低阈值', description: '心率变异性低于此值视为偏低', unit: 'ms' },
    
    { category: 'activity', key: 'steps_target', value: 10000, label: '每日步数目标', description: '每日推荐步数', unit: '步' },
    { category: 'activity', key: 'steps_low', value: 1000, label: '步数过低阈值', description: '低于此值可能数据缺失或活动极少', unit: '步' },
    { category: 'activity', key: 'workout_sudden_increase', value: 2.0, label: '运动量突增比例', description: '较前7天平均值增加多少倍视为突增', unit: '倍' },
    
    { category: 'recovery', key: 'sleep_debt_threshold', value: 5, label: '累计睡眠债阈值', description: '累计睡眠债超过此小时数预警', unit: '小时' },
  ];
}

module.exports = {
  parseThresholdsJSON,
  generateDefaultThresholds,
  VALID_CATEGORIES,
};

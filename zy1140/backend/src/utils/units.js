const UNIT_CONVERSIONS = {
  energy: {
    kcal: { toBase: 1, symbol: 'kcal', label: '千卡' },
    cal: { toBase: 0.001, symbol: 'cal', label: '卡路里' },
    kJ: { toBase: 1 / 4.184, symbol: 'kJ', label: '千焦' },
    J: { toBase: 1 / 4184, symbol: 'J', label: '焦耳' },
  },
  distance: {
    km: { toBase: 1, symbol: 'km', label: '千米' },
    m: { toBase: 0.001, symbol: 'm', label: '米' },
    mi: { toBase: 1.60934, symbol: 'mi', label: '英里' },
    ft: { toBase: 0.0003048, symbol: 'ft', label: '英尺' },
    yd: { toBase: 0.0009144, symbol: 'yd', label: '码' },
  },
  weight: {
    kg: { toBase: 1, symbol: 'kg', label: '千克' },
    g: { toBase: 0.001, symbol: 'g', label: '克' },
    lb: { toBase: 0.453592, symbol: 'lb', label: '磅' },
    oz: { toBase: 0.0283495, symbol: 'oz', label: '盎司' },
  },
  time: {
    min: { toBase: 1, symbol: 'min', label: '分钟' },
    s: { toBase: 1 / 60, symbol: 's', label: '秒' },
    h: { toBase: 60, symbol: 'h', label: '小时' },
    hr: { toBase: 60, symbol: 'hr', label: '小时' },
  },
  heartRate: {
    count/min: { toBase: 1, symbol: 'bpm', label: '次/分' },
    'count/min': { toBase: 1, symbol: 'bpm', label: '次/分' },
    bpm: { toBase: 1, symbol: 'bpm', label: '次/分' },
  },
  hrv: {
    ms: { toBase: 1, symbol: 'ms', label: '毫秒' },
    s: { toBase: 1000, symbol: 's', label: '秒' },
  },
  temperature: {
    degC: { toBase: 'celsius', symbol: '°C', label: '摄氏度' },
    degF: { toBase: 'fahrenheit', symbol: '°F', label: '华氏度' },
  },
};

const APPLE_HEALTH_TYPE_UNITS = {
  'HKQuantityTypeIdentifierStepCount': { category: 'count', baseUnit: 'count', displayUnit: '步' },
  'HKQuantityTypeIdentifierDistanceWalkingRunning': { category: 'distance', baseUnit: 'km', displayUnit: 'km' },
  'HKQuantityTypeIdentifierDistanceCycling': { category: 'distance', baseUnit: 'km', displayUnit: 'km' },
  'HKQuantityTypeIdentifierDistanceSwimming': { category: 'distance', baseUnit: 'm', displayUnit: 'm' },
  'HKQuantityTypeIdentifierActiveEnergyBurned': { category: 'energy', baseUnit: 'kcal', displayUnit: 'kcal' },
  'HKQuantityTypeIdentifierBasalEnergyBurned': { category: 'energy', baseUnit: 'kcal', displayUnit: 'kcal' },
  'HKQuantityTypeIdentifierHeartRate': { category: 'heartRate', baseUnit: 'bpm', displayUnit: 'bpm' },
  'HKQuantityTypeIdentifierRestingHeartRate': { category: 'heartRate', baseUnit: 'bpm', displayUnit: 'bpm' },
  'HKQuantityTypeIdentifierWalkingHeartRateAverage': { category: 'heartRate', baseUnit: 'bpm', displayUnit: 'bpm' },
  'HKQuantityTypeIdentifierHeartRateVariabilitySDNN': { category: 'hrv', baseUnit: 'ms', displayUnit: 'ms' },
  'HKQuantityTypeIdentifierSleepAnalysis': { category: 'time', baseUnit: 'min', displayUnit: 'h' },
  'HKCategoryTypeIdentifierSleepAnalysis': { category: 'time', baseUnit: 'min', displayUnit: 'h' },
  'HKQuantityTypeIdentifierBodyMass': { category: 'weight', baseUnit: 'kg', displayUnit: 'kg' },
  'HKQuantityTypeIdentifierHeight': { category: 'distance', baseUnit: 'm', displayUnit: 'm' },
  'HKQuantityTypeIdentifierBodyMassIndex': { category: 'count', baseUnit: 'count', displayUnit: '' },
  'HKQuantityTypeIdentifierBodyFatPercentage': { category: 'count', baseUnit: '%', displayUnit: '%' },
};

const APPLE_HEALTH_TYPE_NAMES = {
  'HKQuantityTypeIdentifierStepCount': '步数',
  'HKQuantityTypeIdentifierDistanceWalkingRunning': '步行+跑步距离',
  'HKQuantityTypeIdentifierDistanceCycling': '骑行距离',
  'HKQuantityTypeIdentifierDistanceSwimming': '游泳距离',
  'HKQuantityTypeIdentifierActiveEnergyBurned': '活动能量',
  'HKQuantityTypeIdentifierBasalEnergyBurned': '基础能量',
  'HKQuantityTypeIdentifierHeartRate': '心率',
  'HKQuantityTypeIdentifierRestingHeartRate': '静息心率',
  'HKQuantityTypeIdentifierWalkingHeartRateAverage': '步行平均心率',
  'HKQuantityTypeIdentifierHeartRateVariabilitySDNN': '心率变异性',
  'HKQuantityTypeIdentifierSleepAnalysis': '睡眠分析',
  'HKCategoryTypeIdentifierSleepAnalysis': '睡眠分析',
  'HKQuantityTypeIdentifierBodyMass': '体重',
  'HKQuantityTypeIdentifierHeight': '身高',
  'HKQuantityTypeIdentifierBodyMassIndex': 'BMI',
  'HKQuantityTypeIdentifierBodyFatPercentage': '体脂率',
};

const WORKOUT_TYPE_NAMES = {
  'HKWorkoutActivityTypeAmericanFootball': '美式橄榄球',
  'HKWorkoutActivityTypeArchery': '射箭',
  'HKWorkoutActivityTypeAustralianFootball': '澳式橄榄球',
  'HKWorkoutActivityTypeBadminton': '羽毛球',
  'HKWorkoutActivityTypeBaseball': '棒球',
  'HKWorkoutActivityTypeBasketball': '篮球',
  'HKWorkoutActivityTypeBowling': '保龄球',
  'HKWorkoutActivityTypeBoxing': '拳击',
  'HKWorkoutActivityTypeClimbing': '攀岩',
  'HKWorkoutActivityTypeCricket': '板球',
  'HKWorkoutActivityTypeCrossTraining': '交叉训练',
  'HKWorkoutActivityTypeCurling': '冰壶',
  'HKWorkoutActivityTypeCycling': '骑行',
  'HKWorkoutActivityTypeDance': '舞蹈',
  'HKWorkoutActivityTypeDanceInspiredTraining': '舞蹈灵感训练',
  'HKWorkoutActivityTypeElliptical': '椭圆机',
  'HKWorkoutActivityTypeEquestrianSports': '马术',
  'HKWorkoutActivityTypeFencing': '击剑',
  'HKWorkoutActivityTypeFishing': '钓鱼',
  'HKWorkoutActivityTypeFunctionalStrengthTraining': '功能性力量训练',
  'HKWorkoutActivityTypeGolf': '高尔夫',
  'HKWorkoutActivityTypeGymnastics': '体操',
  'HKWorkoutActivityTypeHandball': '手球',
  'HKWorkoutActivityTypeHighIntensityIntervalTraining': 'HIIT',
  'HKWorkoutActivityTypeHiking': '徒步',
  'HKWorkoutActivityTypeHockey': '曲棍球',
  'HKWorkoutActivityTypeHunting': '狩猎',
  'HKWorkoutActivityTypeLacrosse': '长曲棍球',
  'HKWorkoutActivityTypeMartialArts': '武术',
  'HKWorkoutActivityTypeMindAndBody': '身心训练',
  'HKWorkoutActivityTypePaddleSports': '桨板运动',
  'HKWorkoutActivityTypePlay': '游戏',
  'HKWorkoutActivityTypePreparationAndRecovery': '准备与恢复',
  'HKWorkoutActivityTypeRacquetball': '壁球',
  'HKWorkoutActivityTypeRowing': '划船',
  'HKWorkoutActivityTypeRugby': '橄榄球',
  'HKWorkoutActivityTypeRunning': '跑步',
  'HKWorkoutActivityTypeSailing': '帆船',
  'HKWorkoutActivityTypeSkatingSports': '滑冰',
  'HKWorkoutActivityTypeSnowSports': '雪上运动',
  'HKWorkoutActivityTypeSoccer': '足球',
  'HKWorkoutActivityTypeSoftball': '垒球',
  'HKWorkoutActivityTypeSquash': '壁球',
  'HKWorkoutActivityTypeStairClimbing': '爬楼梯',
  'HKWorkoutActivityTypeSurfingSports': '冲浪',
  'HKWorkoutActivityTypeSwimming': '游泳',
  'HKWorkoutActivityTypeTableTennis': '乒乓球',
  'HKWorkoutActivityTypeTennis': '网球',
  'HKWorkoutActivityTypeTrackAndField': '田径',
  'HKWorkoutActivityTypeTraditionalStrengthTraining': '传统力量训练',
  'HKWorkoutActivityTypeVolleyball': '排球',
  'HKWorkoutActivityTypeWalking': '步行',
  'HKWorkoutActivityTypeWaterFitness': '水中健身',
  'HKWorkoutActivityTypeWaterPolo': '水球',
  'HKWorkoutActivityTypeWaterSports': '水上运动',
  'HKWorkoutActivityTypeWrestling': '摔跤',
  'HKWorkoutActivityTypeYoga': '瑜伽',
  'HKWorkoutActivityTypeBarre': 'Barre',
  'HKWorkoutActivityTypeCoreTraining': '核心训练',
  'HKWorkoutActivityTypeCrossCountrySkiing': '越野滑雪',
  'HKWorkoutActivityTypeDownhillSkiing': '高山滑雪',
  'HKWorkoutActivityTypeFlexibility': '柔韧性训练',
  'HKWorkoutActivityTypeJumpRope': '跳绳',
  'HKWorkoutActivityTypeKickboxing': '跆拳道',
  'HKWorkoutActivityTypePilates': '普拉提',
  'HKWorkoutActivityTypeSnowboarding': '单板滑雪',
  'HKWorkoutActivityTypeStairClimbing': '爬楼梯',
  'HKWorkoutActivityTypeTaiChi': '太极',
  'HKWorkoutActivityTypeWheelchairWalkPace': '轮椅步行',
  'HKWorkoutActivityTypeWheelchairRunPace': '轮椅跑步',
  'HKWorkoutActivityTypeMixedCardio': '混合有氧',
  'HKWorkoutActivityTypeHandCycling': '手骑行',
  'HKWorkoutActivityTypeDiscSports': '飞盘',
  'HKWorkoutActivityTypeFitnessGaming': '健身游戏',
};

function normalizeUnit(value, unit, category) {
  if (value === null || value === undefined || isNaN(value)) {
    return { value: null, unit: null };
  }
  
  if (!category || !UNIT_CONVERSIONS[category]) {
    return { value, unit };
  }
  
  const conversions = UNIT_CONVERSIONS[category];
  const unitKey = unit?.trim() || unit;
  
  if (category === 'temperature') {
    if (unitKey === 'degF') {
      return { value: (value - 32) * 5 / 9, unit: 'degC' };
    }
    return { value, unit: 'degC' };
  }
  
  const conversion = conversions[unitKey];
  if (!conversion) {
    console.warn(`Unknown unit for category ${category}: ${unit}`);
    return { value, unit };
  }
  
  const convertedValue = value * conversion.toBase;
  
  let baseUnit = Object.entries(conversions).find(
    ([_, c]) => c.toBase === 1
  )?.[0] || unit;
  
  return { value: convertedValue, unit: baseUnit };
}

function getTypeDisplayName(type) {
  return APPLE_HEALTH_TYPE_NAMES[type] || type;
}

function getWorkoutTypeName(workoutType) {
  return WORKOUT_TYPE_NAMES[workoutType] || workoutType;
}

function getTypeUnitInfo(type) {
  return APPLE_HEALTH_TYPE_UNITS[type] || { category: 'unknown', baseUnit: null, displayUnit: null };
}

module.exports = {
  normalizeUnit,
  getTypeDisplayName,
  getWorkoutTypeName,
  getTypeUnitInfo,
  UNIT_CONVERSIONS,
  APPLE_HEALTH_TYPE_NAMES,
  WORKOUT_TYPE_NAMES,
  APPLE_HEALTH_TYPE_UNITS,
};

const WATER_QUALITY_STANDARDS = {
  chlorine: {
    name: '余氯',
    unit: 'mg/L',
    min: 0.3,
    max: 0.5,
    warningMin: 0.2,
    warningMax: 0.6,
    description: '游泳池水中游离性余氯的标准范围'
  },
  ph: {
    name: 'pH值',
    unit: '',
    min: 6.8,
    max: 8.5,
    warningMin: 6.5,
    warningMax: 8.8,
    description: '游泳池水的pH值标准范围'
  },
  turbidity: {
    name: '浊度',
    unit: 'NTU',
    min: 0,
    max: 1,
    warningMin: 0,
    warningMax: 2,
    description: '游泳池水的浊度标准值'
  },
  temperature: {
    name: '水温',
    unit: '°C',
    min: 22,
    max: 26,
    warningMin: 20,
    warningMax: 28,
    description: '游泳池水温的适宜范围'
  }
};

const RISK_DETECTION_RULES = {
  CONTINUOUS_ANOMALY: {
    name: '连续异常',
    description: '同一采样点同一参数连续多次超出标准范围',
    threshold: 3,
    severity: 'MEDIUM'
  },
  REPEATED_OVERLIMIT: {
    name: '反复超标',
    description: '同一采样点同一参数在一定时间内多次超标（非连续）',
    timeWindowHours: 24,
    countThreshold: 5,
    severity: 'HIGH'
  },
  NO_RECOVERY_AFTER_TREATMENT: {
    name: '补药后未恢复',
    description: '在执行处置操作后，后续采样数据仍未恢复到正常范围',
    checkHours: 4,
    severity: 'CRITICAL'
  }
};

const getParameterStatus = (parameter, value) => {
  const standard = WATER_QUALITY_STANDARDS[parameter];
  if (!standard) return null;

  if (value >= standard.min && value <= standard.max) {
    return 'NORMAL';
  } else if (value >= standard.warningMin && value <= standard.warningMax) {
    return 'WARNING';
  } else {
    return 'OVERLIMIT';
  }
};

const isOverlimit = (parameter, value) => {
  const status = getParameterStatus(parameter, value);
  return status === 'OVERLIMIT';
};

const getDeviationPercentage = (parameter, value) => {
  const standard = WATER_QUALITY_STANDARDS[parameter];
  if (!standard) return 0;

  let deviation = 0;
  if (value < standard.min) {
    deviation = ((standard.min - value) / standard.min) * 100;
  } else if (value > standard.max) {
    deviation = ((value - standard.max) / standard.max) * 100;
  }
  
  return Math.round(deviation * 100) / 100;
};

module.exports = {
  WATER_QUALITY_STANDARDS,
  RISK_DETECTION_RULES,
  getParameterStatus,
  isOverlimit,
  getDeviationPercentage
};

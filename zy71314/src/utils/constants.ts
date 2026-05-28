export const STANDARD_GRAVITY = 9.80665;

export const VALIDATION_RANGES = {
  length: { min: 0.1, max: 2.0, unit: 'm' },
  period: { min: 0.5, max: 5.0, unit: 's' },
  measurements: { min: 1, max: 100, unit: '次' },
  angle: { min: 0, max: 90, unit: '°' },
};

export const WARNING_THRESHOLDS = {
  angle: 15,
  measurements: 5,
  periodDeviation: 0.1,
};

export const CHART_COLORS = {
  primary: '#3b82f6',
  secondary: '#10b981',
  warning: '#f59e0b',
  danger: '#ef4444',
  background: 'rgba(59, 130, 246, 0.1)',
  grid: 'rgba(255, 255, 255, 0.1)',
};

export const ERROR_SOURCES_TEMPLATE = [
  {
    name: '摆长测量误差',
    description: '包括尺的精度、小球直径测量、摆线伸长等因素',
    improvement: '使用游标卡尺测量小球直径，多次测量取平均值',
  },
  {
    name: '周期测量误差',
    description: '人的反应时间、计时工具精度',
    improvement: '测量多个周期取平均，使用光电门提高精度',
  },
  {
    name: '小角度近似误差',
    description: '实际摆角较大时，小角度近似公式失效',
    improvement: '保持摆角小于15度，或使用大角度修正公式',
  },
  {
    name: '空气阻力',
    description: '空气阻力使周期略大于理论值',
    improvement: '使用密度较大的小球，在无风环境中实验',
  },
  {
    name: '圆锥摆效应',
    description: '单摆做圆锥运动而非平面摆动',
    improvement: '确保释放方式正确，观察摆动平面',
  },
];

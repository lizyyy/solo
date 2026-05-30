export const PHYSICAL_CONSTANTS = {
  SOUND_VELOCITY_AT_0C: 331.45,
  STANDARD_PRESSURE: 101325,
  ABSOLUTE_ZERO: -273.15,
  ADIABATIC_INDEX: 1.4,
  GAS_CONSTANT: 8.314,
  MOLAR_MASS_AIR: 0.0289645,
  MIN_REASONABLE_VELOCITY: 250,
  MAX_REASONABLE_VELOCITY: 450,
  MIN_REASONABLE_TEMP: -50,
  MAX_REASONABLE_TEMP: 100,
  MIN_REASONABLE_DISTANCE: 0.1,
  MAX_REASONABLE_DISTANCE: 1000,
  MIN_REASONABLE_TIME_DIFF: 0.0001,
  MAX_REASONABLE_TIME_DIFF: 10,
  CONSISTENCY_THRESHOLD: 5,
  DEFAULT_TEMPERATURE: 20,
  DEFAULT_DEVICE_DEVIATION: 0.5,
} as const;

export const ALGORITHM_VERSION = '1.0.0';

export const ANOMALY_METADATA = {
  temperature_missing: {
    severity: 'warning' as const,
    explanation: '温度参数缺失，理论声速计算将使用标准温度(20℃)估算，结果可能存在偏差。声速与温度的关系公式为: v = 331.45 × √(1 + T/273.15)',
    impact: '理论值可信度降低',
    suggestion: '请补充实际测量的温度值',
  },
  time_unit_error: {
    severity: 'error' as const,
    explanation: '时间单位可能错误。当前测量的时间差与距离不匹配，若为毫秒(ms)计算出的声速会超出合理范围(250-450m/s)。请确认时间单位设置。',
    impact: '测量值完全不可信',
    suggestion: '检查并修正时间单位',
  },
  device_deviation_missing: {
    severity: 'warning' as const,
    explanation: '设备偏差参数未提供，校准计算将使用默认偏差值(±0.5m/s)。不同设备的系统偏差可能不同，建议录入设备校准证书上的偏差值。',
    impact: '校准值精度降低',
    suggestion: '补充设备偏差参数，或使用设备编号自动查询校准值',
  },
  value_out_of_range: {
    severity: 'error' as const,
    explanation: '参数值超出合理范围。温度应在-50℃~100℃之间，声速计算结果应在250~450m/s之间，距离应在0.1~1000m之间，时间差应在0.0001~10s之间。',
    impact: '结果无效',
    suggestion: '检查输入参数是否正确',
  },
  conclusion_inconsistent: {
    severity: 'warning' as const,
    explanation: '温度法与测距法得出的结论不一致，偏差超过5%。时间差数据已作为补充证据列入详情，请综合判断。',
    impact: '结论存疑，需人工复核',
    suggestion: '检查测量过程是否存在误差来源',
  },
  distance_missing: {
    severity: 'error' as const,
    explanation: '测距参数缺失，无法通过测距法计算声速测量值。请提供声波传播的距离。',
    impact: '测量值无法计算',
    suggestion: '补充测距参数',
  },
  time_diff_missing: {
    severity: 'error' as const,
    explanation: '时间差参数缺失，无法通过测距法计算声速测量值。请提供声波传播的时间差。',
    impact: '测量值无法计算',
    suggestion: '补充时间差参数',
  },
} as const;

export const EVIDENCE_SOURCE_LABELS: Record<string, string> = {
  temperature: '温度法',
  distance: '测距法',
  time: '时间差',
  device: '设备校准',
  system: '系统',
};

export const EVIDENCE_TYPE_LABELS: Record<string, string> = {
  temperature_conclusion: '温度法结论',
  distance_conclusion: '测距法结论',
  time_diff_evidence: '时间差证据',
  calibration_detail: '校准明细',
  anomaly: '异常记录',
  calculation_step: '计算步骤',
};

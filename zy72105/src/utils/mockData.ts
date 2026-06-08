import type {
  Batch,
  CalculationNode,
  ConflictRecord,
  DataPoint,
  ExperimentRecord,
  Note,
  OperationCondition,
  SensorLogEntry,
  UnitConversion,
} from '../types';

const generateId = (): string => Math.random().toString(36).substring(2, 11);

const createDataPoint = (
  timestamp: number,
  value: number,
  unit: 'dB' | 'dBm' | 'dBA',
  direction?: 'CW' | 'CCW',
  source: 'sensor' | 'import' | 'manual' = 'import'
): DataPoint => ({
  id: generateId(),
  timestamp,
  value,
  unit,
  direction,
  source,
  confidence: 0.95,
});

const createSensorLog = (
  timestamp: number,
  parameter: string,
  value: number,
  unit: 'dB' | 'dBm' | 'dBA' | 'RPM' | 'Hz',
  rawLog: string
): SensorLogEntry => ({
  id: generateId(),
  timestamp,
  parameter,
  value,
  unit,
  rawLog,
});

const createOperationCondition = (
  timestamp: number,
  description: string,
  rotorSpeed: number,
  altitude: number,
  payload: number,
  weather: string
): OperationCondition => ({
  id: generateId(),
  batchId: '',
  timestamp,
  description,
  rotorSpeed,
  flightAltitude: altitude,
  payload,
  weatherCondition: weather,
});

export const createNormalBatch = (): Batch => {
  const batchId = 'batch-normal-' + Date.now();
  const baseTime = Date.now() - 3600000;

  const dataPoints: DataPoint[] = [
    createDataPoint(baseTime, 75.2, 'dB', 'CW'),
    createDataPoint(baseTime + 2000, 76.8, 'dB', 'CW'),
    createDataPoint(baseTime + 4000, 78.1, 'dB', 'CW'),
    createDataPoint(baseTime + 6000, 77.5, 'dB', 'CW'),
    createDataPoint(baseTime + 8000, 76.3, 'dB', 'CW'),
    createDataPoint(baseTime + 10000, 75.9, 'dB', 'CW'),
  ];

  const sensorLogs: SensorLogEntry[] = [
    createSensorLog(baseTime, 'noise_level', 75.2, 'dB', 'SENSOR1: NOISE=75.2dB, DIR=CW, RPM=4500'),
    createSensorLog(baseTime + 2000, 'noise_level', 76.8, 'dB', 'SENSOR1: NOISE=76.8dB, DIR=CW, RPM=4500'),
    createSensorLog(baseTime + 4000, 'noise_level', 78.1, 'dB', 'SENSOR1: NOISE=78.1dB, DIR=CW, RPM=4500'),
    createSensorLog(baseTime + 6000, 'noise_level', 77.5, 'dB', 'SENSOR1: NOISE=77.5dB, DIR=CW, RPM=4500'),
    createSensorLog(baseTime + 8000, 'noise_level', 76.3, 'dB', 'SENSOR1: NOISE=76.3dB, DIR=CW, RPM=4500'),
    createSensorLog(baseTime + 10000, 'noise_level', 75.9, 'dB', 'SENSOR1: NOISE=75.9dB, DIR=CW, RPM=4500'),
    createSensorLog(baseTime, 'rotor_speed', 4500, 'RPM', 'SENSOR2: RPM=4500, TEMP=25C'),
  ];

  const operationConditions: OperationCondition[] = [
    createOperationCondition(baseTime, '悬停测试', 4500, 10, 5, '晴朗'),
  ];

  const experimentRecord: ExperimentRecord = {
    id: generateId(),
    batchId,
    droneModel: 'DJI-Matrice-300',
    rotorModel: 'R-MT300-1760',
    testDate: '2026-06-01',
    temperature: 25,
    humidity: 60,
    atmosphericPressure: 101325,
    dataPoints,
    sensorLogs,
    photoUrls: [
      'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=drone%20inspection%20laboratory%20with%20testing%20equipment&image_size=square',
      'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=close%20up%20of%20drone%20rotor%20blades%20professional&image_size=square',
    ],
  };

  const calculationChain: CalculationNode[] = [
    {
      id: generateId(),
      batchId,
      timestamp: baseTime + 20000,
      step: 1,
      operation: '桨叶通过频率计算',
      input: { rotorSpeed: 4500, bladeCount: 2 },
      output: { tipFrequency: 150 },
      formula: 'f_tip = (N × Ω) / 60',
      operator: '老岑',
      note: 'N=2桨叶, Ω=4500RPM',
    },
    {
      id: generateId(),
      batchId,
      timestamp: baseTime + 20001,
      step: 2,
      operation: '厚度噪声计算',
      input: { tipSpeed: 132, rotorRadius: 0.28, bladeCount: 2, chord: 0.025 },
      output: { thicknessNoise: 74.5, machNumber: 0.385 },
      formula: 'SPL_thickness ∝ 20·log₁₀(M²·R·c·N / r²)',
      operator: '老岑',
      note: 'M=0.385马赫',
    },
    {
      id: generateId(),
      batchId,
      timestamp: baseTime + 20002,
      step: 3,
      operation: '载荷噪声计算',
      input: { thrust: 49, rotorRadius: 0.28, tipSpeed: 132 },
      output: { loadingNoise: 72.8, pressureRms: 0.089 },
      formula: 'SPL_loading = 10·log₁₀(p_rms² / p_ref²)',
      operator: '老岑',
      note: 'p_ref=20μPa, 推力49N',
    },
    {
      id: generateId(),
      batchId,
      timestamp: baseTime + 20003,
      step: 4,
      operation: '宽带噪声计算',
      input: { tipSpeed: 132, chord: 0.025 },
      output: { broadbandNoise: 68.2, machNumber: 0.385 },
      formula: 'SPL_BB = K + 50·log₁₀(M) + 20·log₁₀(c)',
      operator: '老岑',
      note: '经验常数K=50dB',
    },
    {
      id: generateId(),
      batchId,
      timestamp: baseTime + 20004,
      step: 5,
      operation: '总噪声级合成',
      input: { thicknessNoise: 74.5, loadingNoise: 72.8, broadbandNoise: 68.2 },
      output: { overallSPL: 78.5, components: [74.5, 72.8, 68.2] },
      formula: 'SPL_total = 10·log₁₀(Σ10^(SPL_i/10))',
      operator: '老岑',
      note: '对数叠加法则',
    },
    {
      id: generateId(),
      batchId,
      timestamp: baseTime + 20005,
      step: 6,
      operation: '谐波分量计算',
      input: { fundamental: 78.5, harmonicCount: 5 },
      output: { harmonics: [75.5, 69.5, 65.9, 63.5, 61.7] },
      formula: 'SPL_n = SPL_fundamental - 20·log₁₀(n) - 3dB',
      operator: '老岑',
      note: '5次谐波衰减',
    },
    {
      id: generateId(),
      batchId,
      timestamp: baseTime + 20006,
      step: 7,
      operation: '指向性指数计算',
      input: { azimuth: 0, elevation: 0 },
      output: { directionalityIndex: 1.8, directivity: 0.95 },
      formula: 'DI = 10·log₁₀(|cos(θ)| · (1 + 0.5|cos(φ)|) + 0.1)',
      operator: '老岑',
      note: '方位角0°, 仰角0°',
    },
    {
      id: generateId(),
      batchId,
      timestamp: baseTime + 20007,
      step: 8,
      operation: '噪声等级评估',
      input: { noiseLevel: 78.5, warningThreshold: 80, criticalThreshold: 85 },
      output: { assessment: 'normal', recommendations: ['噪声水平正常，按常规维护计划检查即可'] },
      formula: '临界: 85dB, 警告: 80dB',
      operator: '老岑',
      note: '评估结果: 正常',
    },
  ];

  const batch: Batch = {
    id: batchId,
    name: 'BATCH-2026-001 正常测试批次',
    status: 'completed',
    createdAt: baseTime,
    updatedAt: baseTime + 30000,
    experimentRecord,
    operationConditions,
    calculationChain,
    unitConversions: [],
    conflicts: [],
    anomalies: [],
    notes: [
      {
        id: generateId(),
        batchId,
        timestamp: baseTime + 25000,
        content: '测试环境正常，无人机状态良好，旋翼无明显磨损',
        author: '老岑',
      },
    ],
    result: {
      overallNoiseLevel: 78.5,
      unit: 'dB',
      dominantFrequency: 150,
      harmonicComponents: [75.5, 69.5, 65.9, 63.5, 61.7],
      directionalityIndex: 1.8,
      confidenceLevel: 0.95,
      assessment: 'normal',
      recommendations: ['噪声水平正常，按常规维护计划检查即可'],
    },
  };

  return batch;
};

export const createReworkBatch = (): Batch => {
  const batchId = 'batch-rework-' + Date.now();
  const baseTime = Date.now() - 7200000;

  const dataPoints: DataPoint[] = [
    createDataPoint(baseTime, 65.0, 'dB', 'CW'),
    createDataPoint(baseTime + 2000, 66.2, 'dB', 'CW'),
    createDataPoint(baseTime + 17000, 67.8, 'dB', 'CW'),
    createDataPoint(baseTime + 19000, 66.5, 'dB', 'CW'),
    createDataPoint(baseTime + 21000, 65.8, 'dB', 'CW'),
  ];

  const sensorLogs: SensorLogEntry[] = [
    createSensorLog(baseTime, 'noise_level', 65.0, 'dBm', 'SENSOR1: NOISE=65.0dBm, DIR=CCW, RPM=5200'),
    createSensorLog(baseTime + 2000, 'noise_level', 66.2, 'dBm', 'SENSOR1: NOISE=66.2dBm, DIR=CCW, RPM=5200'),
    createSensorLog(baseTime + 17000, 'noise_level', 67.8, 'dBm', 'SENSOR1: NOISE=67.8dBm, DIR=CCW, RPM=5200'),
    createSensorLog(baseTime + 19000, 'noise_level', 66.5, 'dBm', 'SENSOR1: NOISE=66.5dBm, DIR=CCW, RPM=5200'),
    createSensorLog(baseTime + 21000, 'noise_level', 65.8, 'dBm', 'SENSOR1: NOISE=65.8dBm, DIR=CCW, RPM=5200'),
    createSensorLog(baseTime, 'rotor_speed', 5200, 'RPM', 'SENSOR2: RPM=5200, TEMP=28C'),
  ];

  const operationConditions: OperationCondition[] = [
    createOperationCondition(baseTime, '爬升测试', 5200, 50, 8, '多云'),
  ];

  const experimentRecord: ExperimentRecord = {
    id: generateId(),
    batchId,
    droneModel: 'DJI-Matrice-300',
    rotorModel: 'R-MT300-1760',
    testDate: '2026-06-01',
    temperature: 28,
    humidity: 65,
    atmosphericPressure: 101200,
    dataPoints,
    sensorLogs,
    photoUrls: [
      'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=drone%20maintenance%20check%20rotor%20inspection&image_size=square',
    ],
  };

  const unitConversions: UnitConversion[] = [
    {
      id: generateId(),
      fromValue: 65.0,
      fromUnit: 'dBm',
      toValue: 82.3,
      toUnit: 'dB',
      formula: 'dB = 20*log10(sqrt(10^(dBm/10)/1000 * 400π) / 20μPa)',
      timestamp: baseTime + 30000,
    },
  ];

  const conflicts: ConflictRecord[] = [
    {
      id: generateId(),
      batchId,
      timestamp: baseTime + 25000,
      type: 'unit_mismatch',
      severity: 'critical',
      sensorData: {
        value: 65.0,
        unit: 'dBm',
        timestamp: baseTime,
        rawLog: 'SENSOR1: NOISE=65.0dBm, DIR=CCW, RPM=5200',
      },
      importData: {
        value: 65.0,
        unit: 'dB',
        timestamp: baseTime,
        source: 'import',
      },
      suggestedAction: '单位不匹配：传感器记录dBm，导入数据为dB。65dBm ≈ 82.3dB，差异巨大！建议使用传感器单位dBm重新换算。',
    },
    {
      id: generateId(),
      batchId,
      timestamp: baseTime + 25001,
      type: 'direction_error',
      severity: 'error',
      sensorData: {
        value: 65.0,
        unit: 'dBm',
        timestamp: baseTime,
        rawLog: 'SENSOR1: NOISE=65.0dBm, DIR=CCW, RPM=5200',
      },
      importData: {
        value: 65.0,
        unit: 'dB',
        timestamp: baseTime,
        source: 'import',
      },
      suggestedAction: '方向符号冲突：传感器记录CCW(逆时针)，导入数据为CW(顺时针)。请核实旋翼旋转方向，本次测试为爬升阶段，应为逆时针旋转。',
    },
    {
      id: generateId(),
      batchId,
      timestamp: baseTime + 25002,
      type: 'timegap_error',
      severity: 'warning',
      sensorData: {
        value: 15,
        unit: 'Hz',
        timestamp: baseTime + 2000,
        rawLog: '时间间隔: 15.00秒',
      },
      importData: {
        value: 5,
        unit: 'Hz',
        timestamp: baseTime + 17000,
        source: 'threshold_config',
      },
      suggestedAction: '时间间隔15.00秒超过阈值5秒。2-3号数据点之间存在15秒缺口，可能丢失了爬升过程中的关键数据。',
    },
  ];

  const calculationChain: CalculationNode[] = [
    {
      id: generateId(),
      batchId,
      timestamp: baseTime + 35000,
      step: 1,
      operation: '数据单位换算（返工）',
      input: { originalValue: 65, originalUnit: 'dB', correctValue: 82.3, correctUnit: 'dBm' },
      output: { convertedValue: 82.3, convertedUnit: 'dB' },
      formula: 'dBm → dB 转换',
      operator: '老岑',
      note: '【返工】发现单位混淆，重新换算：65dBm = 82.3dB',
    },
    {
      id: generateId(),
      batchId,
      timestamp: baseTime + 35001,
      step: 2,
      operation: '方向符号修正（返工）',
      input: { originalDirection: 'CW', correctedDirection: 'CCW' },
      output: { direction: 'CCW' },
      formula: '人工核实传感器日志',
      operator: '老岑',
      note: '【返工】方向符号错误，应为CCW逆时针',
    },
    {
      id: generateId(),
      batchId,
      timestamp: baseTime + 35002,
      step: 3,
      operation: '桨叶通过频率计算',
      input: { rotorSpeed: 5200, bladeCount: 2 },
      output: { tipFrequency: 173.33 },
      formula: 'f_tip = (N × Ω) / 60',
      operator: '老岑',
      note: 'N=2桨叶, Ω=5200RPM',
    },
    {
      id: generateId(),
      batchId,
      timestamp: baseTime + 35003,
      step: 4,
      operation: '厚度噪声计算',
      input: { tipSpeed: 152.5, rotorRadius: 0.28, bladeCount: 2, chord: 0.025 },
      output: { thicknessNoise: 79.2, machNumber: 0.445 },
      formula: 'SPL_thickness ∝ 20·log₁₀(M²·R·c·N / r²)',
      operator: '老岑',
      note: 'M=0.445马赫',
    },
    {
      id: generateId(),
      batchId,
      timestamp: baseTime + 35004,
      step: 5,
      operation: '载荷噪声计算',
      input: { thrust: 58, rotorRadius: 0.28, tipSpeed: 152.5 },
      output: { loadingNoise: 76.5, pressureRms: 0.115 },
      formula: 'SPL_loading = 10·log₁₀(p_rms² / p_ref²)',
      operator: '老岑',
      note: 'p_ref=20μPa, 推力58N',
    },
    {
      id: generateId(),
      batchId,
      timestamp: baseTime + 35005,
      step: 6,
      operation: '总噪声级合成',
      input: { thicknessNoise: 79.2, loadingNoise: 76.5, broadbandNoise: 71.8 },
      output: { overallSPL: 82.0, components: [79.2, 76.5, 71.8] },
      formula: 'SPL_total = 10·log₁₀(Σ10^(SPL_i/10))',
      operator: '老岑',
      note: '【返工后结果】原始错误结果: 65dB → 修正后: 82dB',
    },
    {
      id: generateId(),
      batchId,
      timestamp: baseTime + 35006,
      step: 7,
      operation: '噪声等级评估',
      input: { noiseLevel: 82.0, warningThreshold: 80, criticalThreshold: 85 },
      output: {
        assessment: 'warning',
        recommendations: [
          '噪声接近警告阈值，建议增加检查频率',
          '检查旋翼表面是否有损伤',
          '确认桨叶角度是否一致',
        ],
      },
      formula: '临界: 85dB, 警告: 80dB',
      operator: '老岑',
      note: '【返工后评估】82dB超过80dB警告阈值',
    },
  ];

  const batch: Batch = {
    id: batchId,
    name: 'BATCH-2026-002 返工批次（单位混淆）',
    status: 'rework',
    createdAt: baseTime,
    updatedAt: baseTime + 40000,
    experimentRecord,
    operationConditions,
    calculationChain,
    unitConversions,
    conflicts,
    anomalies: [
      {
        id: generateId(),
        batchId,
        type: 'threshold_exceed',
        description: '噪声值82.0dB超过警告阈值80dB',
        value: 82.0,
        threshold: 80,
        timestamp: baseTime + 35006,
        highlighted: true,
      },
    ],
    notes: [
      {
        id: generateId(),
        batchId,
        timestamp: baseTime + 22000,
        content: '初次计算：65dB，看似正常。但对比传感器日志发现单位不匹配，传感器是dBm！',
        author: '老岑',
        previousResultSnapshot: {
          overallNoiseLevel: 65,
          unit: 'dB',
          dominantFrequency: 150,
          harmonicComponents: [62, 56, 52.4, 50, 48.2],
          directionalityIndex: 1.5,
          confidenceLevel: 0.7,
          assessment: 'normal',
          recommendations: ['噪声水平正常'],
        },
      },
      {
        id: generateId(),
        batchId,
        timestamp: baseTime + 30000,
        content: '【返工】已修正单位换算：65dBm = 82.3dB，方向应为CCW逆时针。存在15秒数据缺口。',
        author: '老岑',
      },
      {
        id: generateId(),
        batchId,
        timestamp: baseTime + 38000,
        content: '补录：爬升阶段旋翼负载较大，噪声偏高属于预期，但仍需检查轴承磨损情况。',
        author: '老岑',
      },
    ],
    result: {
      overallNoiseLevel: 82.0,
      unit: 'dB',
      dominantFrequency: 173.33,
      harmonicComponents: [79.0, 73.0, 69.4, 67.0, 65.2],
      directionalityIndex: 2.1,
      confidenceLevel: 0.92,
      assessment: 'warning',
      recommendations: [
        '噪声接近警告阈值，建议增加检查频率',
        '检查旋翼表面是否有损伤',
        '确认桨叶角度是否一致',
      ],
    },
  };

  return batch;
};

export const getAllMockBatches = (): Batch[] => {
  return [createNormalBatch(), createReworkBatch()];
};

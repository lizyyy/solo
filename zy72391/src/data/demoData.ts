import { SamplingIntervalSpec, TemperatureCalibrationRecord, BrakeHeatLoadRecord } from '../types';

export const demoSamplingIntervals: SamplingIntervalSpec[] = [
  {
    id: 'SI-001',
    name: '标准制动采样间隔',
    intervalMs: 100,
    description: '常规制动工况下，每100ms采集一次制动缸压力、速度、温度数据',
    importTime: '2025-05-15 09:30:00',
    operator: '何工'
  },
  {
    id: 'SI-002',
    name: '紧急制动加密采样',
    intervalMs: 50,
    description: '紧急制动触发后，采样间隔加密至50ms，用于捕捉峰值热负荷',
    importTime: '2025-05-15 09:35:00',
    operator: '何工'
  }
];

export const demoCalibrationRecords: TemperatureCalibrationRecord[] = [
  {
    id: 'TC-001',
    sensorId: 'TS-BRK-012',
    sensorName: '1号车制动盘表面温度传感器',
    calibrationDate: '2025-04-20',
    calibrationPoint: 150,
    measuredValue: 148.5,
    correctionOffset: 1.5,
    operator: '张工',
    remarks: '季度例行校准，偏差在允许范围内'
  },
  {
    id: 'TC-002',
    sensorId: 'TS-BRK-012',
    sensorName: '1号车制动盘表面温度传感器',
    calibrationDate: '2025-01-10',
    calibrationPoint: 120,
    measuredValue: 116.8,
    correctionOffset: 3.2,
    operator: '李工',
    remarks: '旧口径校准记录，使用2024版校准规程',
    isOldStandard: true
  },
  {
    id: 'TC-003',
    sensorId: 'TS-BRK-045',
    sensorName: '3号车闸片温度传感器',
    calibrationDate: '2025-04-22',
    calibrationPoint: 200,
    measuredValue: 203.1,
    correctionOffset: -3.1,
    operator: '张工',
    remarks: '季度例行校准'
  }
];

export const demoHeatLoadRecords: BrakeHeatLoadRecord[] = [
  {
    id: 'HL-2025-001',
    trainNo: 'M1-08',
    carriageNo: '01',
    brakeId: 'BRK-01-02',
    recordTime: '2025-05-20 14:23:45',
    status: 'normal',
    source: 'initial_import',
    
    brakingForce: 28.5,
    brakingSpeed: 58.2,
    brakingDuration: 4.2,
    ambientTemp: 26.3,
    frictionCoeff: 0.38,
    heatDissipationCoeff: 0.85,
    contactArea: 0.042,
    
    finalHeatLoad: 1285.6,
    
    samplingIntervalId: 'SI-001',
    temperatureCalibrationId: 'TC-001',
    
    modifications: [],
    hasUnreasonedModification: false,
    
    reviewStatus: 'reviewed',
    reviewer: '何工',
    reviewTime: '2025-05-20 15:10:00',
    reviewRemark: '数据正常，自动计算结果可信',
    
    calculationLog: [
      '2025-05-20 14:23:45 开始采集制动数据，采样间隔SI-001(100ms)',
      '2025-05-20 14:23:49 制动结束，持续4.2秒',
      '2025-05-20 14:23:50 调用热负荷计算公式 Q = F * v * t * μ / (A * K)',
      '2025-05-20 14:23:50 温度校准TC-001补偿 +1.5℃',
      '2025-05-20 14:23:50 计算完成，热负荷1285.6 kJ/m²'
    ],
    replayVersion: 1
  },
  {
    id: 'HL-2025-002',
    trainNo: 'M1-08',
    carriageNo: '03',
    brakeId: 'BRK-03-01',
    recordTime: '2025-05-20 14:45:12',
    status: 'manual_modified_no_reason',
    source: 'manual_correction',
    
    brakingForce: 35.2,
    brakingSpeed: 65.0,
    brakingDuration: 5.8,
    ambientTemp: 28.1,
    frictionCoeff: 0.42,
    heatDissipationCoeff: 0.78,
    contactArea: 0.042,
    
    rawHeatLoad: 2156.3,
    finalHeatLoad: 1895.0,
    
    samplingIntervalId: 'SI-001',
    
    modifications: [
      {
        modifyTime: '2025-05-20 15:30:22',
        modifier: '王工',
        coefficientName: 'heatDissipationCoeff',
        originalValue: 0.85,
        modifiedValue: 0.78,
        hasReason: false
      }
    ],
    hasUnreasonedModification: true,
    
    reviewStatus: 'unreviewed',
    
    calculationLog: [
      '2025-05-20 14:45:12 开始采集制动数据，采样间隔SI-001(100ms)',
      '2025-05-20 14:45:18 制动结束，持续5.8秒',
      '2025-05-20 14:45:19 原始热负荷计算：2156.3 kJ/m²',
      '2025-05-20 15:30:22 王工手动修改heatDissipationCoeff: 0.85 → 0.78',
      '2025-05-20 15:30:22 修改后热负荷：1895.0 kJ/m²',
      '2025-05-20 15:30:22 警告：未填写修改原因，需复核'
    ],
    replayVersion: 1
  },
  {
    id: 'HL-2025-003',
    trainNo: 'M1-08',
    carriageNo: '01',
    brakeId: 'BRK-01-02',
    recordTime: '2025-01-18 08:15:30',
    status: 'recalibrated',
    source: 'recalculation',
    
    brakingForce: 30.1,
    brakingSpeed: 55.0,
    brakingDuration: 4.8,
    ambientTemp: 8.5,
    frictionCoeff: 0.40,
    heatDissipationCoeff: 0.85,
    contactArea: 0.042,
    
    rawHeatLoad: 1420.8,
    calibratedHeatLoad: 1498.2,
    finalHeatLoad: 1498.2,
    
    samplingIntervalId: 'SI-001',
    temperatureCalibrationId: 'TC-002',
    oldStandardCalibrationId: 'TC-002',
    
    modifications: [],
    hasUnreasonedModification: false,
    
    reviewStatus: 'reviewed',
    reviewer: '何工',
    reviewTime: '2025-05-21 10:20:00',
    reviewRemark: '补录1月份旧口径校准记录TC-002后重跑，温度补偿由+1.5调整为+3.2',
    
    calculationLog: [
      '2025-01-18 08:15:30 原始数据采集完成',
      '2025-05-21 10:15:00 导入2025-01-10温度校准记录TC-002（旧口径）',
      '2025-05-21 10:15:30 触发重算，使用旧口径校准数据',
      '2025-05-21 10:15:30 温度校准补偿调整：+1.5℃ → +3.2℃',
      '2025-05-21 10:15:30 重算完成，热负荷从1420.8 → 1498.2 kJ/m²',
      '2025-05-21 10:20:00 何工复核通过'
    ],
    replayVersion: 2
  }
];

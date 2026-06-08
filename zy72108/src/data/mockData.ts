import type { Batch, BatchStatus, ThresholdVersion, StringName, StringMeasurement, EnvironmentCondition, ParameterRecord, Conflict, AuditLog } from '@/types'
import { detectAnomalies } from '@/utils/reviewEngine'

const STRING_NAMES: StringName[] = ['E弦', 'A弦', 'D弦', 'G弦']

let idCounter = 0
function uid(): string {
  idCounter += 1
  return `id_${Date.now()}_${idCounter}`
}

const INITIAL_THRESHOLD_V1: ThresholdVersion = {
  id: 'tv_1',
  version: 'v1.0',
  thresholds: { 'E弦': 3, 'A弦': 3, 'D弦': 3, 'G弦': 3 },
  effectiveAt: '2025-05-10T08:00:00',
  changeReason: '初始阈值设定',
  changedBy: '系统',
}

const INITIAL_THRESHOLD_V2: ThresholdVersion = {
  id: 'tv_2',
  version: 'v1.1',
  thresholds: { 'E弦': 4, 'A弦': 4, 'D弦': 4, 'G弦': 4 },
  effectiveAt: '2025-05-15T10:30:00',
  changeReason: '根据环境工况波动放宽偏差阈值，空调维修后温控不稳定',
  changedBy: '林老师',
}

function createMeasurements(recordId: string, data: { name: StringName; std: number; meas: number }[], threshold: ThresholdVersion): StringMeasurement[] {
  const raw = data.map((d) => {
    const deviationRate = ((d.meas - d.std) / d.std) * 100
    return {
      id: uid(),
      recordId,
      stringName: d.name,
      standardTension: d.std,
      measuredTension: d.meas,
      deviationRate: Math.round(deviationRate * 100) / 100,
      isAnomaly: false,
      anomalyReason: '',
    }
  })
  return detectAnomalies(raw, threshold)
}

const SAMPLE_BATCH_1: Batch = (() => {
  const batchId = 'batch_001'
  const recordId1 = uid()
  const recordId2 = uid()
  const recordId3 = uid()

  const measurements1 = createMeasurements(recordId1, [
    { name: 'E弦', std: 53.4, meas: 54.8 },
    { name: 'A弦', std: 52.5, meas: 52.1 },
    { name: 'D弦', std: 51.2, meas: 48.3 },
    { name: 'G弦', std: 49.8, meas: 50.1 },
  ], INITIAL_THRESHOLD_V1)

  const measurements2 = createMeasurements(recordId2, [
    { name: 'E弦', std: 53.4, meas: 54.8 },
    { name: 'A弦', std: 52.5, meas: 52.1 },
    { name: 'D弦', std: 51.2, meas: 49.8 },
    { name: 'G弦', std: 49.8, meas: 50.1 },
  ], INITIAL_THRESHOLD_V1)

  const env: EnvironmentCondition = {
    id: uid(),
    recordId: recordId3,
    temperature: 22.3,
    humidity: 58,
    note: '空调维修后温控不稳定，温度波动±2°C',
  }

  const records: ParameterRecord[] = [
    {
      id: recordId1,
      batchId,
      source: '实验表',
      recordedAt: '2025-05-20T09:15:00',
      sourceDescription: '5月20日上午实验表记录，含E/A/D/G弦实测张力',
      measurements: measurements1,
      environment: null,
    },
    {
      id: recordId2,
      batchId,
      source: '照片说明',
      recordedAt: '2025-05-20T09:30:00',
      sourceDescription: '设备巡检表照片，巡检记录D弦张力49.8N',
      measurements: measurements2,
      environment: null,
    },
    {
      id: recordId3,
      batchId,
      source: '工况记录',
      recordedAt: '2025-05-20T10:00:00',
      sourceDescription: '5月20日工况记录，空调维修中，温控不稳定',
      measurements: [],
      environment: env,
    },
  ]

  const conflicts: Conflict[] = [
    {
      id: uid(),
      batchId,
      parameterName: 'D弦张力',
      importValue: '48.3N（偏差-5.7%）',
      importSource: '实验表',
      inspectionValue: '49.8N（偏差-2.7%）',
      inspectionSource: '设备巡检表照片',
      suggestion: '实验表实测48.3N与巡检表49.8N差异1.5N，建议复核D弦实际工况，确认是否因温控波动导致测量偏差',
    },
  ]

  const auditLogs: AuditLog[] = [
    {
      id: uid(),
      batchId,
      action: '创建批次',
      actor: '林老师',
      timestamp: '2025-05-20T09:00:00',
      thresholdVersionId: 'tv_1',
      thresholdVersion: 'v1.0',
      source: '手动新建',
      reason: '5月20日小提琴琴弦张力复核',
      details: {},
    },
    {
      id: uid(),
      batchId,
      action: '导入参数',
      actor: '林老师',
      timestamp: '2025-05-20T09:15:00',
      thresholdVersionId: 'tv_1',
      thresholdVersion: 'v1.0',
      source: '实验表',
      reason: '录入5月20日实验表张力数据',
      details: { recordCount: 4 },
    },
    {
      id: uid(),
      batchId,
      action: '导入参数',
      actor: '林老师',
      timestamp: '2025-05-20T09:30:00',
      thresholdVersionId: 'tv_1',
      thresholdVersion: 'v1.0',
      source: '照片说明',
      reason: '录入设备巡检表照片数据',
      details: { recordCount: 4 },
    },
    {
      id: uid(),
      batchId,
      action: '录入工况',
      actor: '林老师',
      timestamp: '2025-05-20T10:00:00',
      thresholdVersionId: 'tv_1',
      thresholdVersion: 'v1.0',
      source: '工况记录',
      reason: '空调维修后温控不稳定',
      details: { temperature: 22.3, humidity: 58 },
    },
    {
      id: uid(),
      batchId,
      action: '检测到冲突',
      actor: '系统',
      timestamp: '2025-05-20T10:05:00',
      thresholdVersionId: 'tv_1',
      thresholdVersion: 'v1.0',
      source: '系统自动检测',
      reason: 'D弦张力：实验表48.3N与巡检表49.8N差异1.5N',
      details: { conflictId: 'conflict_1' },
    },
    {
      id: uid(),
      batchId,
      action: '标记异常',
      actor: '系统',
      timestamp: '2025-05-20T10:05:00',
      thresholdVersionId: 'tv_1',
      thresholdVersion: 'v1.0',
      source: '异常检测引擎',
      reason: 'D弦偏差-5.66%超出阈值±3%（阈值版本v1.0）；E弦偏差+2.62%接近阈值但未超出',
      details: { anomalousStrings: ['D弦'] },
    },
  ]

  return {
    id: batchId,
    name: '2025-05-20 小提琴琴弦张力复核',
    experimentType: '小提琴琴弦张力复核',
    createdAt: '2025-05-20T09:00:00',
    status: 'reviewing' as BatchStatus,
    parameterRecords: records,
    conflicts,
    auditLogs,
  }
})()

const SAMPLE_BATCH_2: Batch = (() => {
  const batchId = 'batch_002'
  const recordId = uid()

  const measurements = createMeasurements(recordId, [
    { name: 'E弦', std: 53.4, meas: 53.8 },
    { name: 'A弦', std: 52.5, meas: 52.9 },
    { name: 'D弦', std: 51.2, meas: 50.8 },
    { name: 'G弦', std: 49.8, meas: 50.2 },
  ], INITIAL_THRESHOLD_V2)

  return {
    id: batchId,
    name: '2025-05-25 小提琴琴弦张力复核',
    experimentType: '小提琴琴弦张力复核',
    createdAt: '2025-05-25T14:00:00',
    status: 'passed' as BatchStatus,
    parameterRecords: [
      {
        id: recordId,
        batchId,
        source: '实验表',
        recordedAt: '2025-05-25T14:15:00',
        sourceDescription: '5月25日下午实验表记录',
        measurements,
        environment: {
          id: uid(),
          recordId,
          temperature: 23.1,
          humidity: 55,
          note: '空调已修复，温控正常',
        },
      },
    ],
    conflicts: [],
    auditLogs: [
      {
        id: uid(),
        batchId,
        action: '创建批次',
        actor: '林老师',
        timestamp: '2025-05-25T14:00:00',
        thresholdVersionId: 'tv_2',
        thresholdVersion: 'v1.1',
        source: '手动新建',
        reason: '5月25日小提琴琴弦张力复核',
        details: {},
      },
      {
        id: uid(),
        batchId,
        action: '判定通过',
        actor: '林老师',
        timestamp: '2025-05-25T14:45:00',
        thresholdVersionId: 'tv_2',
        thresholdVersion: 'v1.1',
        source: '实验表',
        reason: '各弦偏差均在v1.1阈值±4%范围内，环境工况正常',
        details: {},
      },
    ],
  }
})()

const SAMPLE_BATCH_3: Batch = (() => {
  const batchId = 'batch_003'
  const recordId = uid()

  const measurements = createMeasurements(recordId, [
    { name: 'E弦', std: 53.4, meas: 56.1 },
    { name: 'A弦', std: 52.5, meas: 49.7 },
    { name: 'D弦', std: 51.2, meas: 47.5 },
    { name: 'G弦', std: 49.8, meas: 50.0 },
  ], INITIAL_THRESHOLD_V2)

  return {
    id: batchId,
    name: '2025-05-28 小提琴琴弦张力复核',
    experimentType: '小提琴琴弦张力复核',
    createdAt: '2025-05-28T11:00:00',
    status: 'anomaly' as BatchStatus,
    parameterRecords: [
      {
        id: recordId,
        batchId,
        source: '实验表',
        recordedAt: '2025-05-28T11:20:00',
        sourceDescription: '5月28日上午实验表记录，多弦偏差显著',
        measurements,
        environment: {
          id: uid(),
          recordId,
          temperature: 26.8,
          humidity: 72,
          note: '实验室空调故障，温度偏高湿度偏大',
        },
      },
    ],
    conflicts: [],
    auditLogs: [
      {
        id: uid(),
        batchId,
        action: '创建批次',
        actor: '林老师',
        timestamp: '2025-05-28T11:00:00',
        thresholdVersionId: 'tv_2',
        thresholdVersion: 'v1.1',
        source: '手动新建',
        reason: '5月28日小提琴琴弦张力复核',
        details: {},
      },
      {
        id: uid(),
        batchId,
        action: '标记异常',
        actor: '系统',
        timestamp: '2025-05-28T11:25:00',
        thresholdVersionId: 'tv_2',
        thresholdVersion: 'v1.1',
        source: '异常检测引擎',
        reason: 'E弦偏差+5.06%、A弦偏差-5.33%、D弦偏差-7.23%均超出阈值±4%（阈值版本v1.1），环境工况异常',
        details: { anomalousStrings: ['E弦', 'A弦', 'D弦'] },
      },
      {
        id: uid(),
        batchId,
        action: '判定异常',
        actor: '林老师',
        timestamp: '2025-05-28T11:40:00',
        thresholdVersionId: 'tv_2',
        thresholdVersion: 'v1.1',
        source: '实验表+工况记录',
        reason: '3根弦超出阈值，空调故障导致环境异常，建议修复后重新复核',
        details: {},
      },
    ],
  }
})()

export { STRING_NAMES }
export const INITIAL_THRESHOLDS: ThresholdVersion[] = [INITIAL_THRESHOLD_V1, INITIAL_THRESHOLD_V2]
export const SAMPLE_BATCHES: Batch[] = [SAMPLE_BATCH_1, SAMPLE_BATCH_2, SAMPLE_BATCH_3]
export { uid }

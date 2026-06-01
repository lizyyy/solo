import type {
  SensorBatch,
  SensorRecord,
  FieldNote,
  ManualCorrection,
  ParamVersion,
  DirtyDataRecord,
} from '@/types';

function uid(): string {
  return Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
}

const BATCH_ID = 'sample-batch-001';
const PARAM_ID = 'device-param-001';

export const sampleBatch: SensorBatch = {
  id: BATCH_ID,
  name: '样例批次-制动测试-20241201',
  importTime: '2024-12-01T14:30:00Z',
  source: '实验记录本导入',
  recordCount: 38,
};

function makeSensorRecords(): SensorRecord[] {
  const records: SensorRecord[] = [];
  let idCounter = 1;

  for (let i = 0; i < 30; i++) {
    const t = i * 0.5;
    const speed = Math.max(0, 120 - i * 4 + (Math.random() - 0.5) * 2);
    const pressure = i < 3 ? 0 : 2.5 + Math.random() * 0.5;
    const rpm = speed * 80 + (Math.random() - 0.5) * 100;
    const voltage = 380 + Math.random() * 10;
    const current = i < 3 ? 0 : -(30 + Math.random() * 20);
    const temp = 25 + Math.random() * 5;
    records.push({
      id: `${BATCH_ID}-rec-${idCounter++}`,
      batchId: BATCH_ID,
      timestamp: t,
      vehicleSpeed: Math.round(speed * 100) / 100,
      brakePressure: Math.round(pressure * 100) / 100,
      motorRpm: Math.round(rpm),
      batteryVoltage: Math.round(voltage * 100) / 100,
      batteryCurrent: Math.round(current * 100) / 100,
      temperature: Math.round(temp * 10) / 10,
      status: 'normal',
    });
  }

  records.push({
    id: `${BATCH_ID}-rec-${idCounter++}`,
    batchId: BATCH_ID,
    timestamp: 2.0,
    vehicleSpeed: null,
    brakePressure: 2.7,
    motorRpm: 9500,
    batteryVoltage: 385.2,
    batteryCurrent: -35.6,
    temperature: 27.3,
    status: 'empty_field',
  });
  records.push({
    id: `${BATCH_ID}-rec-${idCounter++}`,
    batchId: BATCH_ID,
    timestamp: 5.5,
    vehicleSpeed: 98.5,
    brakePressure: 2.8,
    motorRpm: null,
    batteryVoltage: 382.1,
    batteryCurrent: -38.2,
    temperature: 26.8,
    status: 'empty_field',
  });
  records.push({
    id: `${BATCH_ID}-rec-${idCounter++}`,
    batchId: BATCH_ID,
    timestamp: 8.0,
    vehicleSpeed: 88.3,
    brakePressure: 2.6,
    motorRpm: 7100,
    batteryVoltage: null,
    batteryCurrent: -42.1,
    temperature: 28.1,
    status: 'empty_field',
  });

  const dupBase = records[5];
  records.push({
    ...dupBase,
    id: `${BATCH_ID}-rec-${idCounter++}`,
    status: 'duplicate',
  });
  records.push({
    ...dupBase,
    id: `${BATCH_ID}-rec-${idCounter++}`,
    status: 'duplicate',
  });

  records.push({
    id: `${BATCH_ID}-rec-${idCounter++}`,
    batchId: BATCH_ID,
    timestamp: 1.0,
    vehicleSpeed: 200,
    brakePressure: 3.0,
    motorRpm: 16000,
    batteryVoltage: 395.0,
    batteryCurrent: -55.0,
    temperature: 30.0,
    status: 'boundary',
  });

  records.push({
    id: `${BATCH_ID}-rec-${idCounter++}`,
    batchId: BATCH_ID,
    timestamp: 7.0,
    vehicleSpeed: 92.0,
    brakePressure: 50.0,
    motorRpm: 7400,
    batteryVoltage: 390.0,
    batteryCurrent: -200.0,
    temperature: 28.0,
    status: 'anomaly',
  });
  records.push({
    id: `${BATCH_ID}-rec-${idCounter++}`,
    batchId: BATCH_ID,
    timestamp: 10.0,
    vehicleSpeed: 80.0,
    brakePressure: -5.0,
    motorRpm: 6400,
    batteryVoltage: 380.0,
    batteryCurrent: 100.0,
    temperature: 29.0,
    status: 'anomaly',
  });

  return records;
}

export const sampleSensorRecords: SensorRecord[] = makeSensorRecords();

export const sampleFieldNotes: FieldNote[] = [
  {
    id: `${BATCH_ID}-note-1`,
    batchId: BATCH_ID,
    startTime: 0,
    endTime: 2,
    content: '启动阶段，车辆从120km/h开始匀速行驶，路面干燥，环境温度25°C',
    eventType: '环境记录',
  },
  {
    id: `${BATCH_ID}-note-2`,
    batchId: BATCH_ID,
    startTime: 7.5,
    endTime: 9.0,
    content: '第15-18秒无制动操作，驾驶员松开踏板滑行',
    eventType: '操作记录',
  },
  {
    id: `${BATCH_ID}-note-3`,
    batchId: BATCH_ID,
    startTime: 12,
    endTime: 15,
    content: '路面湿滑，制动距离偏长，注意数据偏差',
    eventType: '环境记录',
  },
];

export const sampleManualCorrections: ManualCorrection[] = [
  {
    id: `${BATCH_ID}-corr-1`,
    batchId: BATCH_ID,
    recordId: `${BATCH_ID}-rec-4`,
    field: 'vehicleSpeed',
    oldValue: 105.3,
    newValue: 108.5,
    reason: 'GPS信号漂移，以轮速传感器为准',
    correctedBy: '张工',
    correctedAt: '2024-12-01T15:00:00Z',
  },
  {
    id: `${BATCH_ID}-corr-2`,
    batchId: BATCH_ID,
    recordId: `${BATCH_ID}-rec-8`,
    field: 'brakePressure',
    oldValue: 2.8,
    newValue: 3.2,
    reason: '压力传感器校准偏差+0.4MPa',
    correctedBy: '张工',
    correctedAt: '2024-12-01T15:10:00Z',
  },
];

export const sampleParamVersionV1: ParamVersion = {
  id: `${PARAM_ID}-v1`,
  paramId: PARAM_ID,
  versionNumber: 1,
  values: {
    vehicleMass: 1850,
    wheelRadius: 0.326,
    transmissionRatio: 9.73,
    motorEfficiency: 0.92,
    maxBrakeForce: 15000,
    maxVehicleSpeed: 200,
    maxMotorRpm: 16000,
    maxBatteryVoltage: 420,
    minBatteryVoltage: 300,
    maxBatteryCurrent: 200,
    motorTorqueCoefficients: [0.35, -0.00002, 0.000000001],
  },
  changedBy: '系统',
  changedAt: '2024-12-01T10:00:00Z',
  changeNote: '初始参数版本',
};

export const sampleParamVersionV2: ParamVersion = {
  id: `${PARAM_ID}-v2`,
  paramId: PARAM_ID,
  versionNumber: 2,
  values: {
    vehicleMass: 1850,
    wheelRadius: 0.326,
    transmissionRatio: 9.73,
    motorEfficiency: 0.92,
    maxBrakeForce: 12000,
    maxVehicleSpeed: 200,
    maxMotorRpm: 16000,
    maxBatteryVoltage: 420,
    minBatteryVoltage: 300,
    maxBatteryCurrent: 200,
    motorTorqueCoefficients: [0.35, -0.00002, 0.000000001],
  },
  changedBy: '张工',
  changedAt: '2024-12-01T16:00:00Z',
  changeNote: '根据实验数据修正：maxBrakeForce 从 15000N 调整为 12000N，符合实际电机回馈能力上限',
};

export function buildSampleDirtyData(
  records: SensorRecord[],
  batchId: string
): DirtyDataRecord[] {
  const result: DirtyDataRecord[] = [];
  let counter = 1;

  for (const r of records) {
    if (r.status === 'empty_field') {
      const emptyFields = Object.entries(r)
        .filter(([k, v]) => v === null && ['vehicleSpeed', 'motorRpm', 'batteryVoltage', 'brakePressure', 'batteryCurrent', 'temperature'].includes(k))
        .map(([k]) => k);
      for (const f of emptyFields) {
        result.push({
          id: `dirty-${counter++}`,
          batchId,
          recordId: r.id,
          dirtyType: 'empty_value',
          field: f,
          description: `时间 ${r.timestamp}s 的 ${f} 字段为空`,
          suggestion: '建议插值补充或标记为待确认',
          resolution: '',
        });
      }
    }
    if (r.status === 'duplicate') {
      result.push({
        id: `dirty-${counter++}`,
        batchId,
        recordId: r.id,
        dirtyType: 'duplicate',
        field: 'all',
        description: `时间 ${r.timestamp}s 的记录与已有记录完全重复`,
        suggestion: '建议删除重复项或标记为待确认',
        resolution: '',
      });
    }
    if (r.status === 'boundary') {
      result.push({
        id: `dirty-${counter++}`,
        batchId,
        recordId: r.id,
        dirtyType: 'boundary',
        field: 'vehicleSpeed',
        description: `时间 ${r.timestamp}s 的 vehicleSpeed=${r.vehicleSpeed} 达到量程上限`,
        suggestion: '建议人工确认是否为有效测量值',
        resolution: '',
      });
    }
  }

  return result;
}

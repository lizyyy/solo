import type { 
  RawSample, 
  AlignedSample, 
  OperationSegment, 
  Anomaly, 
  HistoryRecord,
  ImportBatch 
} from '../types';
import { calculateTorque, DEFAULT_CALIBRATION } from '../core/torque';

const DEVICE_IDS = ['MOTOR-001', 'MOTOR-002', 'MOTOR-003'];
const LOAD_LEVELS = [1, 2, 3, 4, 5];
const BASE_TIMESTAMP = Date.now() - 3 * 60 * 60 * 1000;
const SAMPLE_INTERVAL_MS = 100;

function generateNormalData(
  deviceId: string,
  startTime: number,
  durationMs: number,
  loadLevel: number
): Omit<RawSample, 'id' | 'batchId' | 'importId' | 'source' | 'rawLineNumber' | 'createdAt'>[] {
  const samples: Omit<RawSample, 'id' | 'batchId' | 'importId' | 'source' | 'rawLineNumber' | 'createdAt'>[] = [];
  const sampleCount = Math.floor(durationMs / SAMPLE_INTERVAL_MS);
  
  const baseSpeed = 1000 + loadLevel * 300;
  const baseTorqueRaw = 0.5 + loadLevel * 0.1;
  const baseTemp = 50 + loadLevel * 10;
  
  for (let i = 0; i < sampleCount; i++) {
    const noise = (Math.random() - 0.5) * 0.1;
    const speedNoise = (Math.random() - 0.5) * 20;
    const tempDrift = (i / sampleCount) * 15;
    
    samples.push({
      timestamp: startTime + i * SAMPLE_INTERVAL_MS,
      deviceId,
      speed: baseSpeed + speedNoise,
      torqueRaw: baseTorqueRaw + noise,
      temperature: baseTemp + tempDrift + (Math.random() - 0.5) * 2,
      loadLevel
    });
  }
  
  return samples;
}

function generateShiftedData(
  baseSamples: Omit<RawSample, 'id' | 'batchId' | 'importId' | 'source' | 'rawLineNumber' | 'createdAt'>[],
  shiftMs: number
): Omit<RawSample, 'id' | 'batchId' | 'importId' | 'source' | 'rawLineNumber' | 'createdAt'>[] {
  return baseSamples.map(s => ({
    ...s,
    torqueRaw: s.torqueRaw + Math.sin(s.timestamp * 0.001 + shiftMs * 0.01) * 0.05
  }));
}

function generateOverTempData(
  deviceId: string,
  startTime: number,
  durationMs: number,
  loadLevel: number
): Omit<RawSample, 'id' | 'batchId' | 'importId' | 'source' | 'rawLineNumber' | 'createdAt'>[] {
  const samples = generateNormalData(deviceId, startTime, durationMs, loadLevel);
  
  const overTempStart = Math.floor(samples.length * 0.3);
  const overTempEnd = Math.floor(samples.length * 0.7);
  
  for (let i = overTempStart; i < overTempEnd; i++) {
    const progress = (i - overTempStart) / (overTempEnd - overTempStart);
    const tempPeak = 135 * Math.sin(progress * Math.PI);
    samples[i].temperature = Math.max(samples[i].temperature, 125 + tempPeak * 0.3);
  }
  
  return samples;
}

function generateMissingLoadData(
  deviceId: string,
  startTime: number,
  durationMs: number,
  loadLevel: number
): Omit<RawSample, 'id' | 'batchId' | 'importId' | 'source' | 'rawLineNumber' | 'createdAt'>[] {
  const samples = generateNormalData(deviceId, startTime, durationMs, loadLevel);
  
  const missingStart = Math.floor(samples.length * 0.4);
  const missingEnd = missingStart + 8;
  
  for (let i = missingStart; i < missingEnd && i < samples.length; i++) {
    samples[i].loadLevel = undefined;
  }
  
  return samples;
}

export function generateMockImportBatches(): ImportBatch[] {
  const now = Date.now();
  return [
    {
      id: 'batch_001',
      deviceId: 'MOTOR-001',
      fileName: 'motor_001_test_20260530.csv',
      sampleCount: 72000,
      importedAt: now - 2 * 60 * 60 * 1000,
      importedBy: '工程师_001',
      source: 'direct'
    },
    {
      id: 'batch_002',
      deviceId: 'MOTOR-001',
      fileName: 'motor_001_supplement_20260530.csv',
      sampleCount: 3600,
      importedAt: now - 1 * 60 * 60 * 1000,
      importedBy: '工程师_001',
      source: 'supplement',
      relatedBatchId: 'batch_001'
    },
    {
      id: 'batch_003',
      deviceId: 'MOTOR-002',
      fileName: 'motor_002_test_20260530.csv',
      sampleCount: 54000,
      importedAt: now - 30 * 60 * 1000,
      importedBy: '工程师_002',
      source: 'direct'
    }
  ];
}

export function generateMockRawSamples(): RawSample[] {
  const samples: RawSample[] = [];
  let lineNumber = 1;
  
  const batch1Data = generateNormalData('MOTOR-001', BASE_TIMESTAMP, 30 * 60 * 1000, 1);
  batch1Data.push(...generateNormalData('MOTOR-001', BASE_TIMESTAMP + 30 * 60 * 1000, 30 * 60 * 1000, 2));
  
  const shiftedData = generateShiftedData(
    generateNormalData('MOTOR-001', BASE_TIMESTAMP + 60 * 60 * 1000, 30 * 60 * 1000, 3),
    120
  );
  batch1Data.push(...shiftedData);
  
  batch1Data.push(...generateOverTempData('MOTOR-001', BASE_TIMESTAMP + 90 * 60 * 1000, 30 * 60 * 1000, 4));
  batch1Data.push(...generateMissingLoadData('MOTOR-001', BASE_TIMESTAMP + 120 * 60 * 1000, 30 * 60 * 1000, 5));
  
  for (const s of batch1Data) {
    samples.push({
      ...s,
      id: `raw_${samples.length + 1}`,
      batchId: 'batch_001',
      importId: 'import_001',
      source: 'direct',
      rawLineNumber: lineNumber++,
      createdAt: Date.now()
    });
  }
  
  const supplementData = generateNormalData('MOTOR-001', BASE_TIMESTAMP + 150 * 60 * 1000, 10 * 60 * 1000, 3);
  for (const s of supplementData) {
    samples.push({
      ...s,
      id: `raw_supp_${samples.length + 1}`,
      batchId: 'batch_002',
      importId: 'import_002',
      source: 'supplement',
      rawLineNumber: lineNumber++,
      createdAt: Date.now()
    });
  }
  
  return samples;
}

export function generateMockAlignedSamples(rawSamples: RawSample[]): AlignedSample[] {
  return rawSamples.map((raw, idx) => {
    const hasShiftOffset = raw.timestamp >= BASE_TIMESTAMP + 60 * 60 * 1000 && 
                          raw.timestamp < BASE_TIMESTAMP + 90 * 60 * 1000;
    
    const hasAnomaly = 
      (raw.temperature > 125) ||
      (raw.loadLevel === undefined) ||
      hasShiftOffset;
    
    return {
      id: `aligned_${idx + 1}`,
      rawSampleId: raw.id!,
      timestamp: raw.timestamp,
      deviceId: raw.deviceId,
      speed: raw.speed,
      torque: calculateTorque(raw.torqueRaw, DEFAULT_CALIBRATION),
      torqueRaw: raw.torqueRaw,
      temperature: raw.temperature,
      loadLevel: raw.loadLevel ?? 3,
      alignmentStatus: hasShiftOffset ? 'shifted' : 'ok',
      shiftOffset: hasShiftOffset ? 120 : undefined,
      anomalyIds: hasAnomaly ? [] : [],
      calculatedAt: Date.now()
    };
  });
}

export function generateMockSegments(alignedSamples: AlignedSample[]): OperationSegment[] {
  const segments: OperationSegment[] = [];
  
  const loadLevelGroups: Map<number, AlignedSample[]> = new Map();
  for (const sample of alignedSamples) {
    if (!loadLevelGroups.has(sample.loadLevel)) {
      loadLevelGroups.set(sample.loadLevel, []);
    }
    loadLevelGroups.get(sample.loadLevel)!.push(sample);
  }
  
  let segIdx = 0;
  for (const [loadLevel, samples] of loadLevelGroups.entries()) {
    if (samples.length === 0) continue;
    
    const torques = samples.map(s => s.torque);
    const speeds = samples.map(s => s.speed);
    const temps = samples.map(s => s.temperature);
    
    const hasAnomaly = samples.some(s => s.temperature > 125 || s.alignmentStatus === 'shifted' || s.loadLevel === undefined);
    
    segments.push({
      id: `seg_mock_${segIdx++}`,
      deviceId: samples[0].deviceId,
      startTime: samples[0].timestamp,
      endTime: samples[samples.length - 1].timestamp,
      loadLevel,
      sampleCount: samples.length,
      avgSpeed: speeds.reduce((a, b) => a + b, 0) / speeds.length,
      avgTorque: torques.reduce((a, b) => a + b, 0) / torques.length,
      maxTorque: Math.max(...torques),
      minTorque: Math.min(...torques),
      avgTemperature: temps.reduce((a, b) => a + b, 0) / temps.length,
      maxTemperature: Math.max(...temps),
      hasAnomaly,
      anomalyIds: hasAnomaly ? [] : [],
      sampleIds: samples.map(s => s.id!),
      createdAt: Date.now()
    });
  }
  
  return segments.sort((a, b) => a.startTime - b.startTime);
}

export function generateMockAnomalies(alignedSamples: AlignedSample[]): Anomaly[] {
  const now = Date.now();
  
  const shiftedSamples = alignedSamples.filter(s => s.alignmentStatus === 'shifted');
  const overTempSamples = alignedSamples.filter(s => s.temperature > 125);
  const missingLoadSamples = alignedSamples.filter(s => !s.rawSampleId.startsWith('raw_supp') && s.timestamp >= BASE_TIMESTAMP + 120 * 60 * 1000);
  
  return [
    {
      id: 'anom_001',
      type: 'sampling_shift',
      severity: 'error',
      status: 'confirmed',
      deviceId: 'MOTOR-001',
      detectedAt: now - 90 * 60 * 1000,
      description: '检测到采样通道时间错位，偏移量 +120ms',
      detail: {
        shiftOffset: 120,
        shiftConfidence: 0.92
      },
      affectedSampleIds: shiftedSamples.map(s => s.id!),
      affectedSegmentIds: ['seg_mock_2'],
      confirmedBy: '工程师_001',
      confirmedAt: now - 80 * 60 * 1000,
      confirmedNote: '已确认是传感器延迟导致，已自动对齐',
      createdAt: now - 90 * 60 * 1000,
      updatedAt: now - 80 * 60 * 1000
    },
    {
      id: 'anom_002',
      type: 'temp_over_limit',
      severity: 'critical',
      status: 'detected',
      deviceId: 'MOTOR-001',
      detectedAt: now - 45 * 60 * 1000,
      description: '温度持续超过 125°C，持续时间 12 分钟，最高温度 135.2°C',
      detail: {
        tempValue: 135.2,
        tempLimit: 125,
        tempDuration: 720000
      },
      affectedSampleIds: overTempSamples.map(s => s.id!),
      affectedSegmentIds: ['seg_mock_3'],
      createdAt: now - 45 * 60 * 1000,
      updatedAt: now - 45 * 60 * 1000
    },
    {
      id: 'anom_003',
      type: 'missing_load',
      severity: 'warning',
      status: 'detected',
      deviceId: 'MOTOR-001',
      detectedAt: now - 20 * 60 * 1000,
      description: '检测到 8 个采样点缺少负载档位，已自动推断为 5 档',
      detail: {
        missingLoadRange: [BASE_TIMESTAMP + 120 * 60 * 1000, BASE_TIMESTAMP + 121 * 60 * 1000],
        inferredLoadLevel: 5,
        inferenceConfidence: 0.85
      },
      affectedSampleIds: missingLoadSamples.slice(0, 8).map(s => s.id!),
      affectedSegmentIds: ['seg_mock_4'],
      createdAt: now - 20 * 60 * 1000,
      updatedAt: now - 20 * 60 * 1000
    },
    {
      id: 'anom_004',
      type: 'supplement_data',
      severity: 'warning',
      status: 'confirmed',
      deviceId: 'MOTOR-001',
      detectedAt: now - 10 * 60 * 1000,
      description: '补录数据批次，用于补充批次 batch_001 的缺失数据',
      detail: {
        supplementBatchId: 'batch_001'
      },
      affectedSampleIds: [],
      affectedSegmentIds: [],
      confirmedBy: '工程师_001',
      confirmedAt: now - 8 * 60 * 1000,
      confirmedNote: '补录数据正确，已合并分析',
      createdAt: now - 10 * 60 * 1000,
      updatedAt: now - 8 * 60 * 1000
    },
    {
      id: 'anom_005',
      type: 'temp_over_limit',
      severity: 'warning',
      status: 'dismissed',
      deviceId: 'MOTOR-001',
      detectedAt: now - 15 * 60 * 1000,
      description: '温度上升速率过快：3.2°C/min',
      detail: {
        tempValue: 85.6,
        tempLimit: 125,
        tempRiseRate: 3.2
      },
      affectedSampleIds: [],
      affectedSegmentIds: [],
      confirmedBy: '工程师_001',
      confirmedAt: now - 12 * 60 * 1000,
      confirmedNote: '属于正常加载过程，误报',
      createdAt: now - 15 * 60 * 1000,
      updatedAt: now - 12 * 60 * 1000
    }
  ];
}

export function generateMockHistory(): HistoryRecord[] {
  const now = Date.now();
  
  return [
    {
      id: 'hist_001',
      entityType: 'anomaly',
      entityId: 'anom_001',
      action: 'confirmed',
      operator: '工程师_001',
      timestamp: now - 80 * 60 * 1000,
      beforeState: { status: 'detected' },
      afterState: { status: 'confirmed', confirmedBy: '工程师_001', confirmedNote: '已确认是传感器延迟导致，已自动对齐' },
      comment: '已确认是传感器延迟导致，已自动对齐'
    },
    {
      id: 'hist_002',
      entityType: 'anomaly',
      entityId: 'anom_005',
      action: 'dismissed',
      operator: '工程师_001',
      timestamp: now - 12 * 60 * 1000,
      beforeState: { status: 'detected' },
      afterState: { status: 'dismissed', confirmedBy: '工程师_001', confirmedNote: '属于正常加载过程，误报' },
      comment: '属于正常加载过程，误报'
    },
    {
      id: 'hist_003',
      entityType: 'anomaly',
      entityId: 'anom_004',
      action: 'confirmed',
      operator: '工程师_001',
      timestamp: now - 8 * 60 * 1000,
      beforeState: { status: 'detected' },
      afterState: { status: 'confirmed', confirmedBy: '工程师_001', confirmedNote: '补录数据正确，已合并分析' },
      comment: '补录数据正确，已合并分析'
    },
    {
      id: 'hist_004',
      entityType: 'batch',
      entityId: 'batch_001',
      action: 'imported',
      operator: '工程师_001',
      timestamp: now - 2 * 60 * 60 * 1000,
      beforeState: null,
      afterState: { batchId: 'batch_001', sampleCount: 72000, source: 'direct', fileName: 'motor_001_test_20260530.csv' }
    },
    {
      id: 'hist_005',
      entityType: 'batch',
      entityId: 'batch_002',
      action: 'imported',
      operator: '工程师_001',
      timestamp: now - 1 * 60 * 60 * 1000,
      beforeState: null,
      afterState: { batchId: 'batch_002', sampleCount: 3600, source: 'supplement', fileName: 'motor_001_supplement_20260530.csv' }
    },
    {
      id: 'hist_006',
      entityType: 'batch',
      entityId: 'batch_001',
      action: 'updated',
      operator: '工程师_001',
      timestamp: now - 75 * 60 * 1000,
      beforeState: null,
      afterState: { 
        action: 'analysis_completed',
        sampleCount: 72000,
        segmentCount: 5,
        anomalyCount: 3,
        alignmentOffset: 120,
        alignmentConfidence: 0.92
      },
      comment: '完成数据分析'
    }
  ];
}

export async function initializeMockData(): Promise<void> {
  const { db } = await import('../db');
  
  await db.clearAll();
  
  const batches = generateMockImportBatches();
  await db.importBatches.bulkAdd(batches);
  
  const rawSamples = generateMockRawSamples();
  await db.rawSamples.bulkAdd(rawSamples.map(s => ({ ...s, id: undefined })));
  
  const alignedSamples = generateMockAlignedSamples(rawSamples);
  await db.alignedSamples.bulkAdd(alignedSamples.map(s => ({ ...s, id: undefined })));
  
  const segments = generateMockSegments(alignedSamples);
  
  for (const segment of segments) {
    const segId = await db.segments.add({ ...segment, id: undefined });
    segment.id = String(segId);
    
    await db.alignedSamples
      .where('id')
      .anyOf(segment.sampleIds)
      .modify({ segmentId: segment.id });
  }
  
  const anomalies = generateMockAnomalies(alignedSamples);
  for (const anomaly of anomalies) {
    const anomId = await db.anomalies.add({ ...anomaly, id: undefined });
    anomaly.id = String(anomId);
    
    for (const sampleId of anomaly.affectedSampleIds) {
      await db.alignedSamples
        .where('id')
        .equals(sampleId)
        .modify(s => {
          if (!s.anomalyIds.includes(anomaly.id!)) {
            s.anomalyIds.push(anomaly.id!);
          }
        });
    }
  }
  
  for (const segment of segments) {
    const segmentAnomalies = anomalies.filter(a => 
      a.affectedSampleIds.some(id => segment.sampleIds.includes(id))
    );
    if (segmentAnomalies.length > 0) {
      segment.anomalyIds = segmentAnomalies.map(a => a.id!);
      segment.hasAnomaly = true;
      await db.segments.put(segment);
    }
  }
  
  const history = generateMockHistory();
  await db.history.bulkAdd(history.map(h => ({ ...h, id: undefined })));
  
  console.log('Mock data initialized successfully');
  console.log(`Batches: ${batches.length}`);
  console.log(`Raw samples: ${rawSamples.length}`);
  console.log(`Aligned samples: ${alignedSamples.length}`);
  console.log(`Segments: ${segments.length}`);
  console.log(`Anomalies: ${anomalies.length}`);
  console.log(`History records: ${history.length}`);
}

import type { SensorRecord, Batch } from '../types';
import { validateRecord } from './validator';
import { convertUnit, getCategory, getExpectedUnit } from './validator';

function calcField(raw: number, unit: string): number {
  const cat = getCategory(unit);
  if (!cat) return raw;
  const expected = getExpectedUnit(unit);
  if (unit === expected) return raw;
  return convertUnit(raw, unit, expected, cat);
}

function makeRecord(
  id: string,
  batchId: string,
  seq: number,
  ts: string,
  interval: number,
  gapRaw: number, gapUnit: string,
  heightRaw: number, heightUnit: string,
  currentRaw: number, currentUnit: string,
  dx: number, dy: number,
  recordType: SensorRecord['recordType'],
  source: string,
  deviceParam?: string,
  siteRemark?: string
): SensorRecord {
  const gap = { raw: gapRaw, unit: gapUnit, calculated: calcField(gapRaw, gapUnit) };
  const height = { raw: heightRaw, unit: heightUnit, calculated: calcField(heightRaw, heightUnit) };
  const current = { raw: currentRaw, unit: currentUnit, calculated: calcField(currentRaw, currentUnit) };
  const direction = { x: dx, y: dy };

  const rec: SensorRecord = {
    id,
    batchId,
    sequence: seq,
    timestamp: ts,
    timeSinceLast: interval,
    gap,
    height,
    current,
    direction,
    status: 'pending',
    recordType,
    source,
    checkSteps: [],
    notes: [],
    deviceParam,
    siteRemark,
  };

  rec.checkSteps = validateRecord(rec, seq - 1);

  const hasError = rec.checkSteps.some(s => s.judgment === 'error');
  const hasWarning = rec.checkSteps.some(s => s.judgment === 'warning');

  if (recordType === 'smooth' && !hasError && !hasWarning) {
    rec.status = 'auto_pass';
  } else if (recordType === 'old_caliber') {
    rec.status = 'pending';
  } else {
    rec.status = 'pending';
  }

  return rec;
}

export function createSampleBatch(): Batch {
  const batchId = 'batch-demo-001';
  const records: SensorRecord[] = [
    makeRecord(
      'rec-001', batchId, 1,
      '2025-11-15 09:00:00.000', 0,
      2.5, 'mm',
      1.8, 'mm',
      3.2, 'A',
      0.3, 1.2,
      'smooth',
      'sensor',
      'GS-3200 标准型',
      '3号轨道正常启动，环境温度22°C'
    ),
    makeRecord(
      'rec-002', batchId, 2,
      '2025-11-15 09:00:00.100', 100,
      2.6, 'mm',
      1.7, 'mm',
      3.3, 'A',
      -2.8, 0.5,
      'pending',
      'sensor',
      'GS-3200 标准型',
      '5号弯道处出现异常振动'
    ),
    makeRecord(
      'rec-003', batchId, 3,
      '2025-11-15 09:00:00.350', 250,
      0.25, 'cm',
      1500, 'μm',
      2800, 'mA',
      -1.5, 4.2,
      'old_caliber',
      'wechat',
      'GS-2100 旧型（已停产）',
      '维修微信群2025-08-20记录：旧口径数据，单位未统一'
    ),
  ];

  return {
    id: batchId,
    name: '磁悬浮小车3号轨道调参数据',
    createdAt: '2025-11-15 09:00:00',
    updatedAt: '2025-11-15 09:05:00',
    source: '传感器自动采集 + 维修微信群补录',
    status: 'completed',
    records,
  };
}

export function createSupplementaryNote(
  recordId: string,
  content: string,
  author: string
) {
  return {
    id: `note-${Date.now()}`,
    content,
    author,
    createdAt: new Date().toISOString(),
    isSupplementary: true,
  };
}

export function createRerunBatch(originalBatch: Batch): Batch {
  const newBatchId = `batch-rerun-${Date.now()}`;
  const newRecords = originalBatch.records.map((rec, idx) => {
    const jitter = () => (Math.random() - 0.5) * 0.1;
    const newRec: SensorRecord = {
      ...rec,
      id: `rec-rerun-${idx + 1}`,
      batchId: newBatchId,
      gap: {
        ...rec.gap,
        calculated: rec.gap.calculated + jitter(),
      },
      height: {
        ...rec.height,
        calculated: rec.height.calculated + jitter(),
      },
      current: {
        ...rec.current,
        calculated: rec.current.calculated + jitter() * 0.5,
      },
      direction: {
        x: rec.direction.x + jitter(),
        y: rec.direction.y + jitter(),
      },
      checkSteps: [],
      notes: [],
      status: 'pending',
    };
    newRec.checkSteps = validateRecord(newRec, idx);
    return newRec;
  });

  return {
    id: newBatchId,
    name: `${originalBatch.name}（重跑）`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    source: originalBatch.source,
    status: 'completed',
    records: newRecords,
    parentBatchId: originalBatch.id,
  };
}

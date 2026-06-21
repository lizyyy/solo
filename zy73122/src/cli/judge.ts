import type { BuoyCliRecord, RemarkImpact, ValidatedRow } from './types';

export const CALC_FORMULA = '海况等级 = 0.8 × 波高 + 0.2 × 风速系数';
export const ANOMALY_THRESHOLD = 6;
export const CRITERIA_VERSION = 'v2.3.1';

export interface StatusJudgement {
  status: BuoyCliRecord['status'];
  isAnomaly: boolean;
  isBoundary: boolean;
}

export function judgeStatus(row: ValidatedRow): StatusJudgement {
  const isAnomaly = row.seaState >= ANOMALY_THRESHOLD;
  const isBoundary = row.isBoundaryNote ?? false;

  if (isAnomaly) return { status: 'anomaly', isAnomaly: true, isBoundary };
  if (isBoundary) return { status: 'boundary', isAnomaly: false, isBoundary: true };
  if (row.manualRemark?.includes('已复核') || row.manualRemark?.includes('确认正常')) {
    return { status: 'reviewed', isAnomaly: false, isBoundary };
  }
  return { status: 'pending', isAnomaly: false, isBoundary };
}

export function rowToRecord(
  row: ValidatedRow,
  sourceFile: string,
): BuoyCliRecord {
  const judgement = judgeStatus(row);
  const now = new Date().toISOString();
  const id = `${row.buoyId}-${new Date(row.recordTime).toISOString().slice(0, 10)}-${row.lineNumber}`;

  return {
    id,
    buoyId: row.buoyId,
    recordTime: row.recordTime,
    latitude: row.latitude,
    longitude: row.longitude,
    latRaw: row.latRaw,
    lonRaw: row.lonRaw,
    logPage: row.logPage,
    logDate: new Date(row.recordTime).toISOString().slice(0, 10),
    seaState: row.seaState,
    waveHeight: row.waveHeight,
    windSpeed: row.windSpeed,
    status: judgement.status,
    isAnomaly: judgement.isAnomaly,
    isBoundary: judgement.isBoundary,
    isCloudOccluded: row.isCloudOccludedNote ?? false,
    manualRemark: row.manualRemark,
    calculationCriteria: {
      formula: CALC_FORMULA,
      threshold: ANOMALY_THRESHOLD,
      version: CRITERIA_VERSION,
      calculatedAt: now,
    },
    createdAt: now,
    updatedAt: now,
    sourceFile,
    sourceLine: row.lineNumber,
  };
}

function anomalyExplanation(rec: BuoyCliRecord): string {
  if (rec.isAnomaly) {
    const exceed = (rec.seaState - ANOMALY_THRESHOLD).toFixed(1);
    return `海况 ${rec.seaState} 级，超阈值 ${exceed} 级`;
  }
  return `海况 ${rec.seaState} 级，在正常范围内`;
}

function communicationVerdict(rec: BuoyCliRecord): string {
  if (rec.isAnomaly) return '需在周会上说明异常原因';
  if (rec.isBoundary) return '边界样本，附原始备注供参考';
  if (rec.status === 'reviewed') return '可直接用于对外沟通';
  return '待复核，暂不用于沟通';
}

export function computeRemarkImpacts(
  updatedRecords: BuoyCliRecord[],
  existingMap: Map<string, BuoyCliRecord>,
  getKey: (r: BuoyCliRecord) => string,
): RemarkImpact[] {
  const impacts: RemarkImpact[] = [];

  for (const newRec of updatedRecords) {
    const key = getKey(newRec);
    const oldRec = existingMap.get(key);
    if (!oldRec) continue;

    const oldRemark = oldRec.manualRemark ?? '';
    const newRemark = newRec.manualRemark ?? '';
    if (oldRemark === newRemark) continue;

    const changes: RemarkImpact['changes'] = [];

    if (oldRec.status !== newRec.status) {
      changes.push({
        field: '状态判定',
        before: oldRec.status,
        after: newRec.status,
        reason: `备注从"${oldRemark || '（空）'}"更新为"${newRemark}"`,
      });
    }

    if (oldRec.isAnomaly !== newRec.isAnomaly) {
      changes.push({
        field: '异常解释',
        before: anomalyExplanation(oldRec),
        after: anomalyExplanation(newRec),
        reason: '备注变更导致异常判断变化',
      });
    }

    if (communicationVerdict(oldRec) !== communicationVerdict(newRec)) {
      changes.push({
        field: '沟通结论',
        before: communicationVerdict(oldRec),
        after: communicationVerdict(newRec),
        reason: '状态变化影响是否可用于对外沟通',
      });
    }

    if (changes.length > 0) {
      impacts.push({
        buoyId: newRec.buoyId,
        recordTime: newRec.recordTime,
        oldRemark,
        newRemark,
        changes,
      });
    }
  }

  return impacts;
}

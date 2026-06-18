import type { RunParams, SurveyRecord, ParamSnapshot } from '@/types';
import { buildSnapshot, nextVersion } from './anomaly';

function iso(d: string): string {
  return new Date(d + 'T08:30:00').toISOString();
}

const BASE_RECORDS: Omit<SurveyRecord, 'flags' | 'anomalyTags'>[] = [
  { id: 'r01', siteName: '海沟湾站3号', timestamp: iso('2024-03-02'), coverage: 62, tideLevel: 1.2, tideUnit: 'm',  waterQuality: 78, sourceRow: 2,  sourceBatch: 'B2024Q1' },
  { id: 'r02', siteName: '海沟湾站3号', timestamp: iso('2024-03-16'), coverage: 65, tideLevel: 1.4, tideUnit: 'm',  waterQuality: 80, sourceRow: 3,  sourceBatch: 'B2024Q1' },
  { id: 'r03', siteName: '海沟湾站3号', timestamp: iso('2024-03-30'), coverage: 64, tideLevel: 1.1, tideUnit: 'm',  waterQuality: 77, sourceRow: 4,  sourceBatch: 'B2024Q1' },
  { id: 'r04', siteName: '海沟湾站3号', timestamp: iso('2024-04-13'), coverage: 68, tideLevel: 1.6, tideUnit: 'm',  waterQuality: 82, sourceRow: 5,  sourceBatch: 'B2024Q1' },
  { id: 'r05', siteName: '海沟湾站3号', timestamp: iso('2024-04-27'), coverage: 22, tideLevel: 1.3, tideUnit: 'm',  waterQuality: 79, sourceRow: 6,  sourceBatch: 'B2024Q2' },
  { id: 'r06', siteName: '海沟湾站3号', timestamp: iso('2024-05-11'), coverage: 71, tideLevel: 98,  tideUnit: 'cm', waterQuality: 84, sourceRow: 7,  sourceBatch: 'B2024Q2' },
  { id: 'r07', siteName: '海沟湾三号', timestamp: iso('2024-05-18'), coverage: 70, tideLevel: 1.5, tideUnit: 'm',  waterQuality: 83, sourceRow: 8,  sourceBatch: 'B2024Q2' },
  { id: 'r08', siteName: '海沟湾站3号', timestamp: iso('2024-05-25'), coverage: 73, tideLevel: 1.7, tideUnit: 'm',  waterQuality: 81, sourceRow: 9,  sourceBatch: 'B2024Q2' },
  { id: 'r09', siteName: '海沟湾站3号', timestamp: iso('2024-06-08'), coverage: 75, tideLevel: 1.8, tideUnit: 'm',  waterQuality: 85, sourceRow: 10, sourceBatch: 'B2024Q2' },
  { id: 'r10', siteName: '海沟湾站3号', timestamp: iso('2024-06-22'), coverage: 77, tideLevel: 155, tideUnit: 'cm', waterQuality: 87, sourceRow: 11, sourceBatch: 'B2024Q2' },
  { id: 'r11', siteName: '海沟湾站2号', timestamp: iso('2024-03-05'), coverage: 58, tideLevel: 1.0, tideUnit: 'm',  waterQuality: 74, sourceRow: 12, sourceBatch: 'B2024Q1' },
  { id: 'r12', siteName: '海沟湾站2号', timestamp: iso('2024-03-19'), coverage: 60, tideLevel: 1.2, tideUnit: 'm',  waterQuality: 76, sourceRow: 13, sourceBatch: 'B2024Q1' },
  { id: 'r13', siteName: '海沟湾站2号', timestamp: iso('2024-04-02'), coverage: 61, tideLevel: 0.9, tideUnit: 'm',  waterQuality: 75, sourceRow: 14, sourceBatch: 'B2024Q1' },
  { id: 'r14', siteName: '海沟湾站2号', timestamp: iso('2024-04-16'), coverage: 142,tideLevel: 1.3, tideUnit: 'm',  waterQuality: 77, sourceRow: 15, sourceBatch: 'B2024Q2' },
  { id: 'r15', siteName: '海沟湾站2号', timestamp: iso('2024-04-30'), coverage: 66, tideLevel: 1.1, tideUnit: 'm',  waterQuality: 78, sourceRow: 16, sourceBatch: 'B2024Q2' },
  { id: 'r16', siteName: '海沟湾站2号', timestamp: iso('2024-05-14'), coverage: 68, tideLevel: 1.4, tideUnit: 'm',  waterQuality: 80, sourceRow: 17, sourceBatch: 'B2024Q2' },
  { id: 'r17', siteName: '海沟湾站2号', timestamp: iso('2024-05-28'), coverage: 69, tideLevel: 85,  tideUnit: 'cm', waterQuality: 79, sourceRow: 18, sourceBatch: 'B2024Q2' },
  { id: 'r18', siteName: '海沟湾站2号', timestamp: iso('2024-06-11'), coverage: 70, tideLevel: 1.6, tideUnit: 'm',  waterQuality: 82, sourceRow: 19, sourceBatch: 'B2024Q2' },
  { id: 'r19', siteName: '海沟湾站2号', timestamp: iso('2024-06-25'), coverage: 72, tideLevel: 1.7, tideUnit: 'm',  waterQuality: 83, sourceRow: 20, sourceBatch: 'B2024Q2' },
  { id: 'r20', siteName: '海沟湾站1号', timestamp: iso('2024-03-08'), coverage: 52, tideLevel: 0.8, tideUnit: 'm',  waterQuality: 70, sourceRow: 21, sourceBatch: 'B2024Q1' },
  { id: 'r21', siteName: '海沟湾站1号', timestamp: iso('2024-03-22'), coverage: 55, tideLevel: 1.0, tideUnit: 'm',  waterQuality: 72, sourceRow: 22, sourceBatch: 'B2024Q1' },
  { id: 'r22', siteName: '海沟湾站1号', timestamp: iso('2024-04-05'), coverage: 57, tideLevel: 0.9, tideUnit: 'm',  waterQuality: 71, sourceRow: 23, sourceBatch: 'B2024Q1' },
  { id: 'r23', siteName: '海沟湾站1号', timestamp: iso('2024-04-19'), coverage: 60, tideLevel: 1.2, tideUnit: 'm',  waterQuality: 74, sourceRow: 24, sourceBatch: 'B2024Q2' },
  { id: 'r24', siteName: '海沟湾站1号', timestamp: iso('2024-05-03'), coverage: 62, tideLevel: 1.1, tideUnit: 'm',  waterQuality: 75, sourceRow: 25, sourceBatch: 'B2024Q2' },
  { id: 'r25', siteName: '海沟湾站1号', timestamp: iso('2024-05-17'), coverage: 64, tideLevel: 1.3, tideUnit: 'm',  waterQuality: 76, sourceRow: 26, sourceBatch: 'B2024Q2' },
  { id: 'r26', siteName: '海沟湾站1号', timestamp: iso('2024-05-31'), coverage: 66, tideLevel: 1.4, tideUnit: 'm',  waterQuality: 78, sourceRow: 27, sourceBatch: 'B2024Q2' },
  { id: 'r27', siteName: '海沟湾站1号', timestamp: iso('2024-06-14'), coverage: 68, tideLevel: 1.6, tideUnit: 'm',  waterQuality: 80, sourceRow: 28, sourceBatch: 'B2024Q2' },
  { id: 'r28', siteName: '海沟湾站1号', timestamp: iso('2024-06-28'), coverage: 70, tideLevel: 1.7, tideUnit: 'm',  waterQuality: 81, sourceRow: 29, sourceBatch: 'B2024Q2' },
];

const PENDING_FLAGS: Record<string, { isPendingMaterial: boolean; pendingNote?: string; remark?: string; manualOverride?: SurveyRecord['manualOverride']; processedAt?: string }> = {
  r05: { isPendingMaterial: true, pendingNote: '缺遥感截图（云遮挡）', remark: '现场同事备注：当天有雾，下午补拍' },
  r23: { isPendingMaterial: true, pendingNote: '缺潮位记录（记录仪电池耗尽）' },
  r07: {
    isPendingMaterial: false,
    manualOverride: {
      by: '阿乔',
      at: new Date('2024-06-01T10:12:00').toISOString(),
      reason: '历史命名习惯，保留原记录；与规范名"海沟湾站3号"视为同一站点',
      newStatus: 'outlier_keep',
    },
    processedAt: new Date('2024-06-01T10:12:00').toISOString(),
  },
  r14: {
    isPendingMaterial: false,
    manualOverride: {
      by: '阿乔',
      at: new Date('2024-06-05T15:40:00').toISOString(),
      reason: '卫星过境瞬时值异常，但现场照片确认该点未出现大片海草死亡，判为保留的噪声',
      newStatus: 'outlier_keep',
    },
    processedAt: new Date('2024-06-05T15:40:00').toISOString(),
  },
  r09: {
    isPendingMaterial: false,
    remark: '覆盖度环比+4%，潮汐同步升高，属正常季节回升',
    processedAt: new Date('2024-06-10T09:30:00').toISOString(),
  },
  r26: {
    isPendingMaterial: false,
    remark: '覆盖度+3%，水质同步提升，对应投放人工鱼礁后观察',
    processedAt: new Date('2024-06-12T14:05:00').toISOString(),
  },
};

export const INITIAL_PARAMS: RunParams = {
  smoothWindow: 3,
  outlierThreshold: 2.0,
  normalizeUnit: false,
  keepSuspicious: true,
  nameFuzzyMatch: 85,
};

const PARAMS_V1: RunParams = { ...INITIAL_PARAMS };
const PARAMS_V2: RunParams = { ...INITIAL_PARAMS, smoothWindow: 5 };
const PARAMS_V3: RunParams = { ...INITIAL_PARAMS, smoothWindow: 5, outlierThreshold: 3.0 };

export function buildInitialRecords(): SurveyRecord[] {
  return BASE_RECORDS.map((r) => {
    const extra = PENDING_FLAGS[r.id] ?? { isPendingMaterial: false };
    return {
      ...r,
      flags: {
        isOutlier: false,
        isUnitMismatch: false,
        isNameMismatch: false,
        isPendingMaterial: extra.isPendingMaterial,
      },
      pendingNote: extra.pendingNote,
      remark: extra.remark,
      manualOverride: extra.manualOverride,
      processedAt: extra.processedAt,
      anomalyTags: [],
    } satisfies SurveyRecord;
  });
}

export function buildInitialSnapshots(): ParamSnapshot[] {
  const base = new Date('2024-06-15T09:00:00').getTime();
  const v1 = buildSnapshot('v1', PARAMS_V1, ['r05', 'r14', 'r06', 'r10', 'r17', 'r07']);
  const v2 = buildSnapshot('v2', PARAMS_V2, ['r05', 'r14'], [
    { paramKey: 'smoothWindow', oldValue: 3, newValue: 5 },
  ]);
  const v3 = buildSnapshot('v3', PARAMS_V3, ['r14'], [
    { paramKey: 'smoothWindow', oldValue: 3, newValue: 5 },
    { paramKey: 'outlierThreshold', oldValue: 2.0, newValue: 3.0 },
  ]);
  v1.createdAt = new Date(base).toISOString();
  v2.createdAt = new Date(base + 3600_000 * 2).toISOString();
  v3.createdAt = new Date(base + 3600_000 * 5).toISOString();
  return [v1, v2, v3];
}

export function buildIncomingBatch(): SurveyRecord[] {
  const existing = buildInitialRecords();
  const subset = existing.slice(0, 10).map((r) => ({
    ...r,
    id: `dup-${r.id}`,
    remark: undefined,
    sourceBatch: 'B2024Q2-重复批次',
  }));
  const extra: SurveyRecord = {
    ...existing[existing.length - 1],
    id: 'r99',
    timestamp: new Date('2024-07-12T08:30:00').toISOString(),
    coverage: 71,
    tideLevel: 1.8,
    waterQuality: 82,
    sourceRow: 30,
    sourceBatch: 'B2024Q3',
    siteName: '海沟湾站1号',
    tideUnit: 'm',
    flags: { isOutlier: false, isUnitMismatch: false, isNameMismatch: false, isPendingMaterial: false },
  };
  return [...subset, extra];
}

export function latestVersion(snapshots: ParamSnapshot[]): string {
  if (snapshots.length === 0) return 'v1';
  return snapshots.reduce((acc, s) => nextVersion(acc), snapshots[snapshots.length - 1].version);
}

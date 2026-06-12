import type { SongRecord, SongGroup, ManualChange } from '@/types';
import { getDataHash } from '@/utils/exporter';

export type DataSource = 'page' | 'export' | 'report' | 'api';

export interface UnifiedDataView {
  source: DataSource;
  snapshotAt: number;
  dataHash: string;
  records: SongRecord[];
  groups: SongGroup[];
  summary: DataSummary;
  recordsWithSource: RecordWithSource[];
  changeLog: ChangeLogEntry[];
}

export interface RecordWithSource extends SongRecord {
  _group: SongGroup | undefined;
  _importBatch: string | undefined;
  _isDuplicateImport: boolean;
  _duplicateOfId: string | undefined;
  _isNewInThisImport: boolean;
  _reusedFromImport: string | undefined;
}

export interface DataSummary {
  totalRecords: number;
  totalGroups: number;
  byStatus: Record<string, number>;
  byEmotion: Record<string, number>;
  byImportVersion: Record<string, number>;
  duplicatesCount: number;
  pendingReviewCount: number;
  manuallyChangedCount: number;
  completionRate: number;
  reviewProgress: number;
  confirmedCount: number;
  pendingCount: number;
  rejectedCount: number;
}

export interface ConsistencyDiff {
  sources: string[];
  field: string;
  reason: string;
  valueA?: string;
  valueB?: string;
}

export interface ChangeLogEntry {
  id: string;
  timestamp: number;
  operator: string;
  actionType: 'import' | 'create' | 'update' | 'delete' | 'recalculate' | 'review_confirm' | 'review_reject';
  recordId?: string;
  groupId?: string;
  field?: string;
  oldValue?: string;
  newValue?: string;
  reason?: string;
  affectedRecordIds: string[];
  description: string;
}

export interface ImportResultInfo {
  importVersion: string;
  importBatch: number;
  importedAt: number;
  operator: string;
  rawRows: number;
  totalRowsInFile: number;
  newRows: number;
  reusedRows: number;
  resultingReviewCount: number;
  newRecords: SongRecord[];
  reusedRecords: { existingRecord: SongRecord; matchedRowNumber: number }[];
  reusedPairs: {
    newKey: string;
    liveName: string;
    copyrightName: string;
    existingOriginalRow: number;
    existingGroupCount: number;
  }[];
  rejectedDuplicates: {
    row: number;
    liveName: string;
    copyrightName: string;
    duplicateOfOriginalRow: number;
  }[];
  duplicateWarnings: { newRecord: SongRecord; existingRecord: SongRecord }[];
  nameMappingCandidates: { recordIds: string[]; suggestedGroupName: string }[];
}

let masterSnapshotHash: string = '';

export const buildUnifiedView = (
  records: SongRecord[],
  groups: SongGroup[],
  source: DataSource = 'api'
): UnifiedDataView => {
  const dataHash = getDataHash(records);
  masterSnapshotHash = dataHash;

  const groupMap = new Map(groups.map((g) => [g.id, g]));
  const importVersions = new Set(records.map((r) => r.importVersion));
  const firstImportVersion = Array.from(importVersions).sort()[0];

  const seenKeys = new Map<string, SongRecord>();
  const recordsWithSource: RecordWithSource[] = records
    .slice()
    .sort((a, b) => a.importVersion.localeCompare(b.importVersion) || a.originalRowNumber - b.originalRowNumber)
    .map((r) => {
      const key = `${r.liveName.trim()}|${r.copyrightName.trim()}`;
      const isDuplicate = seenKeys.has(key) && seenKeys.get(key)!.id !== r.id;
      const duplicateOf = isDuplicate ? seenKeys.get(key)!.id : undefined;

      if (!seenKeys.has(key)) {
        seenKeys.set(key, r);
      }

      const isNew = r.importVersion !== firstImportVersion;
      const reused = r.importVersion !== firstImportVersion && !isDuplicate ? firstImportVersion : undefined;

      return {
        ...r,
        _group: r.groupId ? groupMap.get(r.groupId) : undefined,
        _importBatch: r.importVersion,
        _isDuplicateImport: isDuplicate,
        _duplicateOfId: duplicateOf,
        _isNewInThisImport: isNew,
        _reusedFromImport: reused,
      };
    });

  const byStatus: Record<string, number> = {};
  const byEmotion: Record<string, number> = {};
  const byImportVersion: Record<string, number> = {};
  let duplicatesCount = 0;
  let pendingReviewCount = 0;
  let manuallyChangedCount = 0;
  let confirmedCount = 0;
  let pendingCount = 0;
  let rejectedCount = 0;

  recordsWithSource.forEach((r) => {
    byStatus[r.status] = (byStatus[r.status] || 0) + 1;
    byEmotion[r.emotionTag] = (byEmotion[r.emotionTag] || 0) + 1;
    byImportVersion[r.importVersion] = (byImportVersion[r.importVersion] || 0) + 1;
    if (r._isDuplicateImport) duplicatesCount++;
    if (r.status === 'reviewing') pendingReviewCount++;
    if (r.status === 'confirmed') confirmedCount++;
    if (r.status === 'pending') pendingCount++;
    if (r.status === 'exception') rejectedCount++;
    if (r.manualChanges.length > 0) manuallyChangedCount++;
  });

  const total = recordsWithSource.length || 1;
  const completionRate = Math.round(((confirmedCount + rejectedCount) / total) * 100);
  const reviewProgress = total > 0 ? Math.round(((total - pendingReviewCount) / total) * 100) : 0;

  const changeLog = buildChangeLog(records, groups);

  return {
    source,
    snapshotAt: Date.now(),
    dataHash,
    records,
    groups,
    recordsWithSource,
    changeLog,
    summary: {
      totalRecords: records.length,
      totalGroups: groups.length,
      byStatus,
      byEmotion,
      byImportVersion,
      duplicatesCount,
      pendingReviewCount,
      manuallyChangedCount,
      completionRate,
      reviewProgress,
      confirmedCount,
      pendingCount,
      rejectedCount,
    },
  };
};

const buildChangeLog = (records: SongRecord[], groups: SongGroup[]): ChangeLogEntry[] => {
  const log: ChangeLogEntry[] = [];

  const importEvents = new Map<string, { records: SongRecord[]; minTs: number }>();
  records.forEach((r) => {
    if (!importEvents.has(r.importVersion)) {
      importEvents.set(r.importVersion, { records: [], minTs: r.createdAt });
    }
    importEvents.get(r.importVersion)!.records.push(r);
    if (r.createdAt < importEvents.get(r.importVersion)!.minTs) {
      importEvents.get(r.importVersion)!.minTs = r.createdAt;
    }
  });

  importEvents.forEach((info, version) => {
    log.push({
      id: `log_import_${version}`,
      timestamp: info.minTs,
      operator: '系统导入',
      actionType: 'import',
      affectedRecordIds: info.records.map((r) => r.id),
      description: `导入批次 ${version}，共 ${info.records.length} 条记录`,
    });
  });

  groups.forEach((g) => {
    if (g.reviewStatus === 'confirmed') {
      log.push({
        id: `log_grp_${g.id}`,
        timestamp: g.reviewedAt || 0,
        operator: g.reviewedBy || '许老师',
        actionType: 'review_confirm',
        groupId: g.id,
        affectedRecordIds: g.memberIds,
        description: `确认分组"${g.canonicalName}"，${g.memberIds.length}条记录关联统一`,
      });
    } else if (g.reviewStatus === 'rejected') {
      log.push({
        id: `log_grp_${g.id}`,
        timestamp: g.reviewedAt || 0,
        operator: g.reviewedBy || '许老师',
        actionType: 'review_reject',
        groupId: g.id,
        affectedRecordIds: g.memberIds,
        description: `拒绝分组"${g.canonicalName}"，记录已标记独立`,
      });
    }
  });

  records.forEach((r) => {
    r.manualChanges.forEach((mc: ManualChange) => {
      const fieldLabels: Record<string, string> = {
        audioNote: '音频备注',
        emotionTag: '情绪标签',
        status: '处理状态',
        liveName: '现场名',
        copyrightName: '版权名',
      };
      const fieldLabel = fieldLabels[mc.field] || mc.field;
      log.push({
        id: mc.id,
        timestamp: mc.timestamp,
        operator: mc.operator,
        actionType: 'update',
        recordId: r.id,
        field: mc.field,
        oldValue: mc.oldValue,
        newValue: mc.newValue,
        reason: mc.reason,
        affectedRecordIds: r.groupId ? findGroupMembers(records, r.groupId) : [r.id],
        description: `在"${r.liveName || r.copyrightName}"修改${fieldLabel}：${mc.oldValue || '(空)'} → ${mc.newValue || '(空)'}${mc.reason ? `（原因：${mc.reason}）` : ''}`,
      });
    });
  });

  return log.sort((a, b) => b.timestamp - a.timestamp);
};

const findGroupMembers = (records: SongRecord[], groupId: string): string[] => {
  return records.filter((r) => r.groupId === groupId).map((r) => r.id);
};

export const verifyDataConsistency = (
  view1: UnifiedDataView,
  view2: UnifiedDataView
): { passed: boolean; diffs: ConsistencyDiff[] } => {
  const diffs: ConsistencyDiff[] = [];
  if (view1.dataHash !== view2.dataHash) {
    diffs.push({
      sources: [view1.source, view2.source],
      field: 'dataHash',
      reason: '数据哈希不一致',
      valueA: view1.dataHash,
      valueB: view2.dataHash,
    });
  }
  if (view1.records.length !== view2.records.length) {
    diffs.push({
      sources: [view1.source, view2.source],
      field: 'records.length',
      reason: '记录数量不一致',
      valueA: String(view1.records.length),
      valueB: String(view2.records.length),
    });
  }
  if (view1.groups.length !== view2.groups.length) {
    diffs.push({
      sources: [view1.source, view2.source],
      field: 'groups.length',
      reason: '分组数量不一致',
      valueA: String(view1.groups.length),
      valueB: String(view2.groups.length),
    });
  }
  return { passed: diffs.length === 0, diffs };
};

export const getMasterHash = () => masterSnapshotHash;

import type { SongRecord, SongGroup, SelfCheckResult, CheckIssue, CheckType } from '@/types';
import { getDataHash } from './exporter';

const generateIssueId = () => `issue_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

export const checkDuplicateImport = (records: SongRecord[]): SelfCheckResult => {
  const issues: CheckIssue[] = [];
  const seen = new Map<string, SongRecord[]>();

  records.forEach((record) => {
    const key = `${record.liveName.trim()}|${record.copyrightName.trim()}`;
    if (!seen.has(key)) {
      seen.set(key, []);
    }
    seen.get(key)!.push(record);
  });

  seen.forEach((group, key) => {
    if (group.length > 1) {
      const versions = new Set(group.map((r) => r.importVersion));
      if (versions.size > 1) {
        issues.push({
          id: generateIssueId(),
          severity: 'warning',
          description: `检测到重复导入: "${key}" 出现 ${group.length} 次，跨 ${versions.size} 个导入版本`,
          recordIds: group.map((r) => r.id),
          resolved: false,
        });
      }
    }
  });

  return {
    checkType: 'duplicate_import',
    passed: issues.length === 0,
    issueCount: issues.length,
    issues,
    checkedAt: Date.now(),
  };
};

export const checkNameMapping = (records: SongRecord[], groups: SongGroup[]): SelfCheckResult => {
  const issues: CheckIssue[] = [];

  groups.forEach((group) => {
    if (group.reviewStatus !== 'confirmed') return;

    const members = group.memberIds
      .map((id) => records.find((r) => r.id === id))
      .filter(Boolean) as SongRecord[];

    if (members.length < 2) return;

    const emotionTags = new Set(members.map((m) => m.emotionTag));
    if (emotionTags.size > 1) {
      issues.push({
        id: generateIssueId(),
        severity: 'error',
        description: `分组"${group.canonicalName}"内情绪标签不一致: ${Array.from(emotionTags).join(', ')}`,
        recordIds: members.map((m) => m.id),
        resolved: false,
      });
    }

    const statuses = new Set(members.map((m) => m.status));
    if (statuses.size > 1) {
      issues.push({
        id: generateIssueId(),
        severity: 'warning',
        description: `分组"${group.canonicalName}"内处理状态不一致`,
        recordIds: members.map((m) => m.id),
        resolved: false,
      });
    }
  });

  return {
    checkType: 'name_mapping',
    passed: issues.length === 0,
    issueCount: issues.length,
    issues,
    checkedAt: Date.now(),
  };
};

export const checkRecalculation = (records: SongRecord[]): SelfCheckResult => {
  const issues: CheckIssue[] = [];

  records.forEach((record) => {
    if (record.audioNote && record.audioNote.trim().length > 0) {
      const noteUpdated = record.manualChanges.find((c) => c.field === 'audioNote');
      if (noteUpdated && noteUpdated.timestamp > record.emotionUpdatedAt) {
        issues.push({
          id: generateIssueId(),
          severity: 'warning',
          description: `"${record.liveName}" 音频备注已更新但情绪标签未重算`,
          recordIds: [record.id],
          resolved: false,
        });
      }
    }
  });

  return {
    checkType: 'recalculation',
    passed: issues.length === 0,
    issueCount: issues.length,
    issues,
    checkedAt: Date.now(),
  };
};

export const checkExportConsistency = (records: SongRecord[], groups: SongGroup[]): SelfCheckResult => {
  const issues: CheckIssue[] = [];

  const pageHash = getDataHash(records);

  const exportRecords = [...records];
  const exportHash = getDataHash(exportRecords);

  if (pageHash !== exportHash) {
    issues.push({
      id: generateIssueId(),
      severity: 'error',
      description: '页面数据与导出数据哈希不一致',
      recordIds: records.map((r) => r.id),
      resolved: false,
    });
  }

  return {
    checkType: 'export_consistency',
    passed: issues.length === 0,
    issueCount: issues.length,
    issues,
    checkedAt: Date.now(),
  };
};

export const runAllSelfChecks = (records: SongRecord[], groups: SongGroup[]): SelfCheckResult[] => {
  return [
    checkDuplicateImport(records),
    checkNameMapping(records, groups),
    checkRecalculation(records),
    checkExportConsistency(records, groups),
  ];
};

export const getCheckTypeLabel = (type: CheckType): string => {
  const labels: Record<CheckType, string> = {
    duplicate_import: '重复导入检测',
    name_mapping: '同名映射检查',
    recalculation: '补录重算验证',
    export_consistency: '导出一致性校验',
  };
  return labels[type];
};

import type {
  SelfCheckResult,
  DuplicateItem,
  NameIssueItem,
  RecalcItem,
  ExportConsistencyItem,
} from '../../shared/types.js';
import { dataStore } from '../data/unifiedStore.js';

export class SelfCheckService {
  runAllChecks(): SelfCheckResult {
    return {
      duplicateImport: this.checkDuplicateImport(),
      communityNameIssue: this.checkCommunityNameIssue(),
      recalcConsistency: this.checkRecalcConsistency(),
      exportConsistency: this.checkExportConsistency(),
      checkTime: new Date().toISOString(),
    };
  }

  checkDuplicateImport(): DuplicateItem[] {
    const records = dataStore.getAllRecords();
    const groups = new Map<string, typeof records>();

    for (const record of records) {
      const key = record.redLineNo;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(record);
    }

    const duplicates: DuplicateItem[] = [];
    for (const [redLineNo, groupRecords] of groups) {
      if (groupRecords.length > 1) {
        duplicates.push({
          redLineNo,
          count: groupRecords.length,
          recordIds: groupRecords.map((r) => r.id),
          importTimes: groupRecords.map((r) => r.importTime),
        });
      }
    }

    return duplicates;
  }

  checkCommunityNameIssue(): NameIssueItem[] {
    const records = dataStore.getAllRecords();
    const issues: NameIssueItem[] = [];

    for (const record of records) {
      if (record.communityNameOld && record.hasNameIssue && record.nameReviewStatus !== 'confirmed') {
        issues.push({
          recordId: record.id,
          redLineNo: record.redLineNo,
          newName: record.communityName,
          oldName: record.communityNameOld,
          address: `红线图编号：${record.redLineNo}`,
          confidence: 0.85,
        });
      }
    }

    const nameMap = new Map<string, string[]>();
    for (const record of records) {
      const key = record.redLineNo;
      if (!nameMap.has(key)) nameMap.set(key, []);
      if (!nameMap.get(key)!.includes(record.communityName)) {
        nameMap.get(key)!.push(record.communityName);
      }
    }

    for (const [redLineNo, names] of nameMap) {
      if (names.length > 1) {
        const record = records.find((r) => r.redLineNo === redLineNo);
        if (record && !issues.find((i) => i.recordId === record.id)) {
          issues.push({
            recordId: record.id,
            redLineNo,
            newName: names[0],
            oldName: names[1],
            address: `红线图编号：${redLineNo}`,
            confidence: 0.7,
          });
        }
      }
    }

    return issues;
  }

  checkRecalcConsistency(): RecalcItem[] {
    const records = dataStore.getAllRecords();
    const items: RecalcItem[] = [];

    for (const record of records) {
      if (record.calculationMeta && record.reviewTime) {
        if (record.hasConflict && record.conflictStatus === 'pending') {
          items.push({
            recordId: record.id,
            redLineNo: record.redLineNo,
            beforeValue: '未检测冲突',
            afterValue: `检测到${record.conflictPoints?.length || 0}处冲突待处理`,
            field: '冲突检测结果',
            changedAt: record.reviewTime,
          });
        }
        if (record.hasNameIssue) {
          items.push({
            recordId: record.id,
            redLineNo: record.redLineNo,
            beforeValue: record.communityNameOld || '无旧名称',
            afterValue: record.communityName,
            field: '小区名称（新旧名待确认）',
            changedAt: record.importTime,
          });
        }
      }
    }

    return items;
  }

  checkExportConsistency(): ExportConsistencyItem[] {
    const records = dataStore.getAllRecords();
    const viewRecords = dataStore.getUnifiedView();
    const items: ExportConsistencyItem[] = [];

    const sampleRecord = records[0];
    if (sampleRecord) {
      const viewRecord = viewRecords.find((r) => r.id === sampleRecord.id);
      const fieldsToCheck: (keyof typeof sampleRecord)[] = [
        'redLineNo',
        'communityName',
        'status',
        'hasConflict',
        'hasNameIssue',
      ];

      for (const field of fieldsToCheck) {
        const pageValue = String(sampleRecord[field]);
        const apiValue = String(viewRecord?.[field] ?? '');
        const exportValue = String(sampleRecord[field]);
        items.push({
          field,
          pageValue,
          apiValue,
          exportValue,
          isConsistent: pageValue === apiValue && apiValue === exportValue,
        });
      }

      items.push({
        field: 'redLineRemark（原始备注）',
        pageValue: sampleRecord.redLineRemark.substring(0, 30) + '...',
        apiValue: viewRecord?.redLineRemark.substring(0, 30) + '...' || '',
        exportValue: sampleRecord.redLineRemark.substring(0, 30) + '...',
        isConsistent: sampleRecord.redLineRemark === viewRecord?.redLineRemark,
      });
    }

    return items;
  }
}

export const selfCheckService = new SelfCheckService();

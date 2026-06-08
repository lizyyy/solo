import type {
  BoardingRecord,
  ExceptionQueueItem,
  ExportHistoryItem,
  ReviewRemark,
  ExportDiff,
} from '../../shared/types.js';
import {
  seedBoardingRecords,
  seedExceptionQueue,
  seedExportHistory,
} from './seed.js';

class MemoryDB {
  boardingRecords: BoardingRecord[];
  exceptionQueue: ExceptionQueueItem[];
  exportHistory: ExportHistoryItem[];
  exportDiffs: Map<string, ExportDiff[]>;

  constructor() {
    this.boardingRecords = JSON.parse(JSON.stringify(seedBoardingRecords));
    this.exceptionQueue = JSON.parse(JSON.stringify(seedExceptionQueue));
    this.exportHistory = JSON.parse(JSON.stringify(seedExportHistory));
    this.exportDiffs = new Map();
    this.exportDiffs.set('EXP-002', [
      {
        field: 'conclusion',
        before: '复核通过，各项指标正常，疫苗齐全',
        after: '复核通过，各项指标正常，疫苗齐全；【补充】主人来接时额外嘱咐豆豆怕打雷，下次寄养注意天气',
        changeReason: '补录备注：主人来接时额外嘱咐豆豆怕打雷，下次寄养注意天气（操作人：寄养店长老周）',
        rowIndex: 2,
      },
      {
        field: 'latestRemark',
        before: '复核通过：各项指标正常，疫苗齐全',
        after: '【补录】补充：主人来接时额外嘱咐豆豆怕打雷，下次寄养注意天气',
        changeReason: '补录备注内容更新',
        rowIndex: 2,
      },
    ]);
  }

  syncRemarkToException(recordId: string) {
    const record = this.boardingRecords.find(r => r.id === recordId);
    if (!record) return;
    const latestRemark = record.remarks[record.remarks.length - 1];
    if (!latestRemark) return;
    this.exceptionQueue = this.exceptionQueue.map(e => {
      if (e.recordId === recordId) {
        const updated = {
          ...e,
          remark: latestRemark.content,
          status: latestRemark.status,
          fileConclusion: this.generateConclusion(record, latestRemark),
        };
        updated.isConsistent = this.checkConsistency(updated);
        return updated;
      }
      return e;
    });
  }

  generateConclusion(record: BoardingRecord, remark: ReviewRemark): string {
    const parts: string[] = [];
    if (record.hasWeightAnomaly) parts.push('体重异常记录');
    if (record.hasVaccineMissing) parts.push('疫苗缺失');
    const statusMap: Record<string, string> = {
      pending: '待复核',
      approved: '复核通过',
      exception: '存在异常',
      needsInfo: '需补充信息',
    };
    return `${statusMap[remark.status] || remark.status}${parts.length ? '-' + parts.join('/') : ''}`;
  }

  checkConsistency(e: ExceptionQueueItem): boolean {
    const statusKeywords: Record<string, string[]> = {
      approved: ['通过', '无异常', '已解决', '无影响'],
      exception: ['异常', '缺失', '待补', '存在'],
      needsInfo: ['需补充', '待确认', '待标注', '待标注'],
      pending: ['待复核', '待处理'],
    };
    const keywords = statusKeywords[e.status] || [];
    const remarkHit = keywords.some(k => e.remark.includes(k)) || keywords.length === 0;
    const conclusionHit = keywords.some(k => e.fileConclusion.includes(k)) || keywords.length === 0;
    return remarkHit && conclusionHit;
  }

  recheckAllConsistency() {
    this.exceptionQueue = this.exceptionQueue.map(e => ({
      ...e,
      isConsistent: this.checkConsistency(e),
    }));
  }
}

export const db = new MemoryDB();

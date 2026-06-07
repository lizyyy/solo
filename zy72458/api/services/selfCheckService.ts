import { randomUUID } from 'crypto';
import { SelfCheckResult, SelfCheckType, SELF_CHECK_NAMES } from '../../shared/types.js';
import { dataSource } from '../data/dataSource.js';
import { complaintService } from './complaintService.js';
import { operationRecordService } from './operationRecordService.js';

export const selfCheckService = {
  async runAllChecks(operator: string): Promise<SelfCheckResult[]> {
    const results: SelfCheckResult[] = [];
    
    results.push(await this.checkDuplicateImport());
    results.push(await this.checkMissingOpinion());
    results.push(await this.checkRecalcAfterAdd());
    results.push(await this.checkExportConsistency());

    await dataSource.saveSelfCheckResults(results);
    
    await operationRecordService.record({
      command: 'run_self_check',
      operator,
      parameters: { checks: 4 },
      result: 'success',
    });

    return results;
  },

  async checkDuplicateImport(): Promise<SelfCheckResult> {
    const complaints = await complaintService.getAll();
    const complaintNoMap = new Map<string, number[]>();
    
    complaints.forEach(c => {
      const existing = complaintNoMap.get(c.complaintNo) || [];
      existing.push(c.originalRowNo);
      complaintNoMap.set(c.complaintNo, existing);
    });

    const duplicates: Array<{ complaintNo: string; rowNumbers: number[]; count: number }> = [];
    complaintNoMap.forEach((rowNumbers, complaintNo) => {
      if (rowNumbers.length > 1) {
        duplicates.push({ complaintNo, rowNumbers, count: rowNumbers.length });
      }
    });

    return {
      checkId: randomUUID(),
      checkType: 'duplicate_import',
      checkName: SELF_CHECK_NAMES.duplicate_import,
      status: duplicates.length > 0 ? 'warning' : 'pass',
      message: duplicates.length > 0 
        ? `发现 ${duplicates.length} 个重复导入的投诉编号` 
        : '未检测到重复导入',
      details: duplicates,
      runTime: new Date().toISOString(),
    };
  },

  async checkMissingOpinion(): Promise<SelfCheckResult> {
    const complaints = await complaintService.getAll();
    const missingOpinions = complaints.filter(c => !c.residentOpinion.hasOriginal);

    const details = missingOpinions.map(c => ({
      id: c.id,
      complaintNo: c.complaintNo,
      originalRowNo: c.originalRowNo,
      status: c.status,
      summary: c.residentOpinion.summary,
    }));

    return {
      checkId: randomUUID(),
      checkType: 'missing_opinion',
      checkName: SELF_CHECK_NAMES.missing_opinion,
      status: missingOpinions.length > 0 ? 'error' : 'pass',
      message: missingOpinions.length > 0
        ? `发现 ${missingOpinions.length} 条居民意见只剩汇总无原文，需社区书记复核`
        : '所有居民意见均有原文',
      details,
      runTime: new Date().toISOString(),
    };
  },

  async checkRecalcAfterAdd(): Promise<SelfCheckResult> {
    const complaints = await complaintService.getAll();
    const issues: Array<{ 
      id: string; 
      complaintNo: string; 
      issue: string;
      currentStep: number;
      hasPhoto: boolean;
      hasOriginal: boolean;
    }> = [];

    complaints.forEach(c => {
      let expectedStep: 1 | 2 | 3 = 1;
      if (c.intersectionPhoto.hasPhoto) expectedStep = 2;
      if (c.reviewBy) expectedStep = 3;

      if (c.currentStep !== expectedStep) {
        issues.push({
          id: c.id,
          complaintNo: c.complaintNo,
          issue: `步骤不匹配：当前为第${c.currentStep}步，应为第${expectedStep}步`,
          currentStep: c.currentStep,
          hasPhoto: c.intersectionPhoto.hasPhoto,
          hasOriginal: c.residentOpinion.hasOriginal,
        });
      }

      let expectedStatus = c.status;
      if (!c.residentOpinion.hasOriginal) {
        expectedStatus = 'missing_opinion';
      } else if (!c.intersectionPhoto.hasPhoto) {
        expectedStatus = 'pending_photo';
      } else if (!c.reviewBy) {
        expectedStatus = 'pending_review';
      } else {
        expectedStatus = 'resolved';
      }

      if (c.status !== expectedStatus) {
        issues.push({
          id: c.id,
          complaintNo: c.complaintNo,
          issue: `状态不匹配：当前为${c.status}，应为${expectedStatus}`,
          currentStep: c.currentStep,
          hasPhoto: c.intersectionPhoto.hasPhoto,
          hasOriginal: c.residentOpinion.hasOriginal,
        });
      }
    });

    return {
      checkId: randomUUID(),
      checkType: 'recalc_after_add',
      checkName: SELF_CHECK_NAMES.recalc_after_add,
      status: issues.length > 0 ? 'warning' : 'pass',
      message: issues.length > 0
        ? `发现 ${issues.length} 条补录后未正确重算的记录`
        : '所有记录状态和步骤计算正确',
      details: issues,
      runTime: new Date().toISOString(),
    };
  },

  async checkExportConsistency(): Promise<SelfCheckResult> {
    const currentData = await complaintService.getForExport();
    const snapshot = await dataSource.getExportSnapshot();
    
    const issues: Array<{ type: string; complaintNo?: string; details: string }> = [];

    if (!snapshot) {
      return {
        checkId: randomUUID(),
        checkType: 'export_consistency',
        checkName: SELF_CHECK_NAMES.export_consistency,
        status: 'warning',
        message: '尚无导出快照，无法对比。请先执行一次导出',
        details: [],
        runTime: new Date().toISOString(),
      };
    }

    if (currentData.length !== snapshot.data.length) {
      issues.push({
        type: 'count_mismatch',
        details: `记录数量不一致：当前${currentData.length}条，快照${snapshot.data.length}条`,
      });
    }

    const currentMap = new Map(currentData.map(c => [c.id, c]));
    const snapshotMap = new Map(snapshot.data.map(c => [c.id, c]));

    currentData.forEach(c => {
      const snapshotItem = snapshotMap.get(c.id);
      if (!snapshotItem) {
        issues.push({
          type: 'new_record',
          complaintNo: c.complaintNo,
          details: `新增记录：${c.complaintNo}`,
        });
      } else if (JSON.stringify(c) !== JSON.stringify(snapshotItem)) {
        issues.push({
          type: 'modified_record',
          complaintNo: c.complaintNo,
          details: `记录已修改：${c.complaintNo}`,
        });
      }
    });

    snapshot.data.forEach(c => {
      if (!currentMap.has(c.id)) {
        issues.push({
          type: 'deleted_record',
          complaintNo: c.complaintNo,
          details: `记录已删除：${c.complaintNo}`,
        });
      }
    });

    return {
      checkId: randomUUID(),
      checkType: 'export_consistency',
      checkName: SELF_CHECK_NAMES.export_consistency,
      status: issues.length > 0 ? 'warning' : 'pass',
      message: issues.length > 0
        ? `发现 ${issues.length} 处导出数据不一致`
        : `导出数据与当前数据一致（快照时间：${new Date(snapshot.timestamp).toLocaleString('zh-CN')}）`,
      details: issues,
      runTime: new Date().toISOString(),
    };
  },

  async getLatestResults(): Promise<SelfCheckResult[]> {
    return dataSource.getSelfCheckResults();
  },
};

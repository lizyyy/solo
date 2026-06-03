import { dataStore } from '../store/DataStore';
import { conflictDetectionService } from './ConflictDetectionService';
import { selfCheckService } from './SelfCheckService';
import {
  PensionFundSwapRecord,
  ImportEmailRequest,
  SupplyBatchRequest,
  ResolveConflictRequest,
  SupervisorReviewRequest
} from '../types';

export class WorkflowService {
  async step1_importManagerEmail(request: ImportEmailRequest): Promise<PensionFundSwapRecord> {
    const record = dataStore.createRecordFromEmail(request);
    conflictDetectionService.detectAllConflicts(record.id);
    selfCheckService.runAllChecks(record.id);
    return dataStore.getRecord(record.id)!;
  }

  async step2_supplySettlementBatch(
    request: SupplyBatchRequest
  ): Promise<PensionFundSwapRecord | null> {
    const record = dataStore.getRecord(request.recordId);
    if (!record) return null;

    if (record.status !== 'EMAIL_IMPORTED' &&
        record.status !== 'CONFLICT_RESOLVED' &&
        record.status !== 'CONFLICT_DETECTED' &&
        record.status !== 'SPLIT_LINES_PENDING') {
      throw new Error(
        `当前状态 ${record.status} 不允许补录清算批次号`
      );
    }

    const now = new Date().toISOString();
    const updated = dataStore.updateRecord(request.recordId, {
      settlementBatchNo: request.settlementBatchNo,
      settlementBatchSuppliedAt: now,
      settlementBatchSuppliedBy: request.suppliedBy,
      status: 'BATCH_SUPPLIED'
    });

    selfCheckService.runAllChecks(request.recordId);
    conflictDetectionService.detectAllConflicts(request.recordId);

    return dataStore.getRecord(request.recordId)!;
  }

  async resolveConflict(
    request: ResolveConflictRequest
  ): Promise<PensionFundSwapRecord | null> {
    const record = dataStore.getRecord(request.recordId);
    if (!record) return null;

    if (record.status !== 'CONFLICT_DETECTED') {
      throw new Error(`当前状态 ${record.status} 无待处理冲突`);
    }

    const resolved = conflictDetectionService.resolveConflict(
      request.recordId,
      request.conflictId,
      request.resolution,
      request.resolvedBy
    );

    if (!resolved) {
      throw new Error('冲突不存在或已处理');
    }

    return dataStore.getRecord(request.recordId)!;
  }

  async supervisorReview(
    request: SupervisorReviewRequest
  ): Promise<PensionFundSwapRecord | null> {
    const record = dataStore.getRecord(request.recordId);
    if (!record) return null;

    if (record.status !== 'SPLIT_LINES_PENDING' &&
        record.status !== 'BATCH_SUPPLIED') {
      throw new Error(
        `当前状态 ${record.status} 不允许结算主管复核`
      );
    }

    const principalLines = record.lines.filter(l => l.lineType === 'PRINCIPAL');
    const feeLines = record.lines.filter(l => l.lineType === 'FEE');
    const hasSplitLines = principalLines.length > 0 && feeLines.length > 0;

    if (!hasSplitLines && record.status === 'SPLIT_LINES_PENDING') {
      throw new Error('该记录没有拆分行，无需主管复核');
    }

    const now = new Date().toISOString();
    const newStatus = request.approved ? 'SUPERVISOR_REVIEWED' : record.status;

    const updated = dataStore.updateRecord(request.recordId, {
      supervisorReviewedAt: now,
      supervisorReviewedBy: request.reviewedBy,
      status: newStatus
    });

    return updated;
  }

  async step3_updateDiffList(
    recordId: string,
    operator: string
  ): Promise<PensionFundSwapRecord | null> {
    const record = dataStore.getRecord(recordId);
    if (!record) return null;

    const principalLines = record.lines.filter(l => l.lineType === 'PRINCIPAL');
    const feeLines = record.lines.filter(l => l.lineType === 'FEE');
    const hasSplitLines = principalLines.length > 0 && feeLines.length > 0;

    if (hasSplitLines && record.status !== 'SUPERVISOR_REVIEWED') {
      throw new Error('拆分行记录需先经结算主管复核后才能更新差异清单');
    }

    if (record.conflicts.some(c => !c.resolvedAt)) {
      throw new Error('存在未解决的冲突，请先处理冲突');
    }

    if (record.status !== 'SUPERVISOR_REVIEWED' &&
        record.status !== 'BATCH_SUPPLIED' &&
        record.status !== 'CONFLICT_RESOLVED') {
      throw new Error(`当前状态 ${record.status} 不允许更新差异清单`);
    }

    const failedChecks = selfCheckService.getFailedChecks(recordId);
    if (failedChecks.length > 0) {
      const failedTypes = failedChecks.map(c => c.checkType).join(', ');
      throw new Error(`自检未通过：${failedTypes}，请先修复问题`);
    }

    const now = new Date().toISOString();
    const updated = dataStore.updateRecord(recordId, {
      diffListUpdatedAt: now,
      status: 'DIFF_UPDATED'
    });

    return updated;
  }

  async completeRecord(
    recordId: string,
    operator: string
  ): Promise<PensionFundSwapRecord | null> {
    const record = dataStore.getRecord(recordId);
    if (!record) return null;

    if (record.status !== 'DIFF_UPDATED') {
      throw new Error('差异清单尚未更新，无法完成流程');
    }

    const updated = dataStore.updateRecord(recordId, {
      status: 'COMPLETED'
    });

    return updated;
  }

  canProceedToNextStep(recordId: string): { canProceed: boolean; nextStep: string; blockers: string[] } {
    const record = dataStore.getRecord(recordId);
    if (!record) return { canProceed: false, nextStep: '', blockers: ['记录不存在'] };

    const blockers: string[] = [];
    let nextStep = '';

    switch (record.status) {
      case 'EMAIL_IMPORTED':
        nextStep = '补录清算批次号';
        if (record.conflicts.some(c => !c.resolvedAt)) {
          blockers.push('存在未解决的冲突');
        }
        break;
      case 'CONFLICT_DETECTED':
        nextStep = '处理冲突（确认/驳回）';
        blockers.push('请先处理所有冲突');
        break;
      case 'CONFLICT_RESOLVED':
        nextStep = '补录清算批次号';
        break;
      case 'BATCH_SUPPLIED':
        const principalLines = record.lines.filter(l => l.lineType === 'PRINCIPAL');
        const feeLines = record.lines.filter(l => l.lineType === 'FEE');
        const hasSplitLines = principalLines.length > 0 && feeLines.length > 0;
        if (hasSplitLines) {
          nextStep = '结算主管复核拆分行';
        } else {
          nextStep = '更新差异清单';
        }
        if (record.conflicts.some(c => !c.resolvedAt)) {
          blockers.push('存在未解决的冲突');
        }
        break;
      case 'SPLIT_LINES_PENDING':
        nextStep = '结算主管复核拆分行';
        break;
      case 'SUPERVISOR_REVIEWED':
        nextStep = '更新差异清单';
        break;
      case 'DIFF_UPDATED':
        nextStep = '完成流程';
        break;
      case 'COMPLETED':
        nextStep = '流程已完成';
        break;
      default:
        nextStep = '未知状态';
        blockers.push('无法确定下一步');
    }

    return {
      canProceed: blockers.length === 0,
      nextStep,
      blockers
    };
  }

  getWorkflowSummary(recordId: string): {
    currentStep: number;
    totalSteps: number;
    stepNames: string[];
    completedSteps: string[];
  } {
    const record = dataStore.getRecord(recordId);
    if (!record) return { currentStep: 0, totalSteps: 3, stepNames: [], completedSteps: [] };

    const stepNames = [
      '客户经理补充邮件导入',
      '对账运营补录清算批次号',
      '差异清单更新'
    ];

    const completedSteps: string[] = [];

    if (record.status === 'EMAIL_IMPORTED' ||
        record.status === 'CONFLICT_DETECTED' ||
        record.status === 'CONFLICT_RESOLVED' ||
        record.status === 'BATCH_SUPPLIED' ||
        record.status === 'SPLIT_LINES_PENDING' ||
        record.status === 'SUPERVISOR_REVIEWED' ||
        record.status === 'DIFF_UPDATED' ||
        record.status === 'COMPLETED') {
      completedSteps.push(stepNames[0]);
    }

    if (record.status === 'BATCH_SUPPLIED' ||
        record.status === 'SPLIT_LINES_PENDING' ||
        record.status === 'SUPERVISOR_REVIEWED' ||
        record.status === 'DIFF_UPDATED' ||
        record.status === 'COMPLETED') {
      completedSteps.push(stepNames[1]);
    }

    if (record.status === 'DIFF_UPDATED' ||
        record.status === 'COMPLETED') {
      completedSteps.push(stepNames[2]);
    }

    let currentStep = completedSteps.length;
    if (record.status === 'COMPLETED') {
      currentStep = 4;
    }

    return {
      currentStep,
      totalSteps: 3,
      stepNames,
      completedSteps
    };
  }
}

export const workflowService = new WorkflowService();

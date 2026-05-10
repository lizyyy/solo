import {
  Requisition,
  ApprovalRecord,
  ApprovalStage,
  RequisitionStatus,
  ApprovalAction
} from '../types';
import { store } from '../dataStore/inMemoryStore';
import {
  InvalidStateTransitionError,
  NotFoundError,
  ApprovalFlowError,
  BusinessRuleViolationError
} from '../utils/errors';
import { LoggerContext, createLoggerContext } from '../utils/logger';
import { intervalRuleService } from './intervalRuleService';

interface ApprovalContext {
  processorId: string;
  processorName: string;
  comments?: string;
  isAutoProcessed?: boolean;
}

interface FlowProgress {
  currentStage: ApprovalStage;
  currentStatus: RequisitionStatus;
  lastRecord: ApprovalRecord | null;
  previousRecord: ApprovalRecord | null;
  processingHistory: ApprovalRecord[];
  isBlocked: boolean;
  blockReason: string | null;
  nextStages: ApprovalStage[];
}

const APPROVAL_FLOW: ApprovalStage[] = [
  'DRAFT',
  'PLOT_VERIFICATION',
  'INTERVAL_CHECK',
  'INVENTORY_CHECK',
  'SUPERVISOR_APPROVAL',
  'FINAL_APPROVAL',
  'COMPLETED'
];

const STAGE_DESCRIPTIONS: Record<ApprovalStage, string> = {
  'DRAFT': '草稿状态',
  'PLOT_VERIFICATION': '地块信息验证',
  'INTERVAL_CHECK': '间隔期规则校验',
  'INVENTORY_CHECK': '库存检查',
  'SUPERVISOR_APPROVAL': '主管审批',
  'FINAL_APPROVAL': '最终审批',
  'COMPLETED': '流程完成'
};

class ApprovalFlowService {
  private logger: LoggerContext;

  constructor(logger?: LoggerContext) {
    this.logger = logger || createLoggerContext();
    this.logger.addContext('service', 'ApprovalFlowService');
  }

  async getFlowProgress(requisitionId: string): Promise<FlowProgress> {
    this.logger.info('Getting flow progress', { requisitionId });

    const requisition = store.requisitionsStore().findById(requisitionId);
    if (!requisition) {
      throw new NotFoundError('Requisition', requisitionId);
    }

    const records = store.approvalRecordsStore().findByRequisitionId(requisitionId);
    const lastRecord = records.length > 0 ? records[records.length - 1] : null;
    const previousRecord = records.length > 1 ? records[records.length - 2] : null;

    const currentIndex = APPROVAL_FLOW.indexOf(requisition.currentStage);
    const nextStages = APPROVAL_FLOW.slice(currentIndex + 1);

    const isBlocked = requisition.status === 'REJECTED';
    const blockReason = isBlocked ? requisition.rejectionReason : null;

    return {
      currentStage: requisition.currentStage,
      currentStatus: requisition.status,
      lastRecord,
      previousRecord,
      processingHistory: records,
      isBlocked,
      blockReason,
      nextStages
    };
  }

  async submitRequisition(
    requisitionId: string,
    context: ApprovalContext
  ): Promise<{ requisition: Requisition; record: ApprovalRecord }> {
    this.logger.info('Submitting requisition', { requisitionId });

    const requisition = store.requisitionsStore().findById(requisitionId);
    if (!requisition) {
      throw new NotFoundError('Requisition', requisitionId);
    }

    if (requisition.status !== 'DRAFT') {
      throw new InvalidStateTransitionError(requisition.status, 'PENDING_APPROVAL');
    }

    const items = store.requisitionItemsStore().findByRequisitionId(requisitionId);
    if (items.length === 0) {
      throw new ApprovalFlowError('领用单必须包含至少一个农药条目');
    }

    const previousStatus = requisition.status;
    const newStatus: RequisitionStatus = 'PENDING_APPROVAL';
    const newStage: ApprovalStage = 'PLOT_VERIFICATION';

    const updated = store.requisitionsStore().update(requisitionId, {
      status: newStatus,
      currentStage: newStage,
      lastProcessedById: context.processorId,
      lastProcessedAt: new Date()
    });

    if (!updated) {
      throw new ApprovalFlowError('更新领用单状态失败');
    }

    const record = store.approvalRecordsStore().create({
      requisitionId,
      stage: 'DRAFT',
      action: 'SUBMIT',
      processorId: context.processorId,
      processorName: context.processorName,
      processedAt: new Date(),
      comments: context.comments || null,
      previousStatus,
      newStatus,
      isAutoProcessed: context.isAutoProcessed ?? false,
      failureReason: null
    });

    this.logger.info('Requisition submitted', { requisitionId, newStage });
    return { requisition: updated, record };
  }

  async processStage(
    requisitionId: string,
    stage: ApprovalStage,
    action: ApprovalAction,
    context: ApprovalContext
  ): Promise<{ requisition: Requisition; record: ApprovalRecord }> {
    this.logger.info('Processing stage', { requisitionId, stage, action });

    const requisition = store.requisitionsStore().findById(requisitionId);
    if (!requisition) {
      throw new NotFoundError('Requisition', requisitionId);
    }

    if (requisition.currentStage !== stage) {
      throw new BusinessRuleViolationError(
        `当前阶段为${requisition.currentStage}，无法处理${stage}阶段`,
        { currentStage: requisition.currentStage, requestedStage: stage }
      );
    }

    const previousStatus = requisition.status;
    let newStatus: RequisitionStatus = requisition.status;
    let newStage: ApprovalStage = requisition.currentStage;
    let rejectionReason: string | null = null;

    switch (action) {
      case 'APPROVE':
        ({ newStatus, newStage } = this.getNextState(stage, true));
        break;
      case 'REJECT':
        newStatus = 'REJECTED';
        rejectionReason = context.comments || '审批被拒绝';
        break;
      case 'RETURN':
        newStatus = 'DRAFT';
        newStage = 'DRAFT';
        break;
      default:
        throw new BusinessRuleViolationError(`不支持的操作类型: ${action}`);
    }

    this.logger.debug('State transition', {
      from: { status: previousStatus, stage },
      to: { status: newStatus, stage: newStage }
    });

    const updated = store.requisitionsStore().update(requisitionId, {
      status: newStatus,
      currentStage: newStage,
      rejectionReason,
      lastProcessedById: context.processorId,
      lastProcessedAt: new Date()
    });

    if (!updated) {
      throw new ApprovalFlowError('更新领用单状态失败');
    }

    const record = store.approvalRecordsStore().create({
      requisitionId,
      stage,
      action,
      processorId: context.processorId,
      processorName: context.processorName,
      processedAt: new Date(),
      comments: context.comments || null,
      previousStatus,
      newStatus,
      isAutoProcessed: context.isAutoProcessed ?? false,
      failureReason: null
    });

    this.logger.info('Stage processed', { 
      requisitionId, 
      stage, 
      action, 
      newStage, 
      newStatus 
    });

    return { requisition: updated, record };
  }

  private getNextState(
    currentStage: ApprovalStage,
    approved: boolean
  ): { newStatus: RequisitionStatus; newStage: ApprovalStage } {
    if (!approved) {
      return { newStatus: 'REJECTED', newStage: currentStage };
    }

    const currentIndex = APPROVAL_FLOW.indexOf(currentStage);
    if (currentIndex === -1) {
      throw new ApprovalFlowError(`无效的审批阶段: ${currentStage}`);
    }

    const nextIndex = currentIndex + 1;

    if (nextIndex >= APPROVAL_FLOW.length) {
      return { newStatus: 'FULFILLED', newStage: 'COMPLETED' };
    }

    const nextStage = APPROVAL_FLOW[nextIndex];
    const nextStatus: RequisitionStatus = 
      nextStage === 'COMPLETED' ? 'FULFILLED' : 'APPROVING';

    return { newStatus: nextStatus, newStage: nextStage };
  }

  async autoProcessPlotVerification(
    requisitionId: string
  ): Promise<{ passed: boolean; failures: string[] }> {
    this.logger.info('Auto-processing plot verification', { requisitionId });

    const items = store.requisitionItemsStore().findByRequisitionId(requisitionId);
    const failures: string[] = [];

    for (const item of items) {
      const plot = store.plotsStore().findById(item.plotId);
      if (!plot) {
        failures.push(`条目 ${item.id}: 地块 ${item.plotId} 不存在`);
        continue;
      }

      if (plot.status !== 'PLANTED') {
        failures.push(`条目 ${item.id}: 地块 ${plot.name} 状态为${plot.status}，不是种植状态`);
        continue;
      }

      if (plot.currentCropId !== item.cropId) {
        failures.push(`条目 ${item.id}: 地块当前作物与申请作物不匹配`);
        continue;
      }
    }

    const passed = failures.length === 0;
    this.logger.info('Plot verification result', { requisitionId, passed, failureCount: failures.length });

    return { passed, failures };
  }

  async autoProcessIntervalCheck(
    requisitionId: string
  ): Promise<{ passed: boolean; violations: string[]; warning: string[] }> {
    this.logger.info('Auto-processing interval check', { requisitionId });

    const items = store.requisitionItemsStore().findByRequisitionId(requisitionId);
    const violations: string[] = [];
    const warnings: string[] = [];

    for (const item of items) {
      const previousApps = await intervalRuleService.getPreviousApplications(
        item.plotId,
        item.expectedApplicationDate,
        item.id
      );

      const result = await intervalRuleService.checkItemCompliance(item, previousApps);

      if (!result.passed) {
        for (const violation of result.violations) {
          violations.push(`条目 ${item.id}: ${violation.description}`);
        }
        await intervalRuleService.createViolationRecords(requisitionId, item, result.violations);
      }

      for (const warning of result.warnings) {
        warnings.push(`条目 ${item.id}: ${warning.description}`);
      }
    }

    const passed = violations.length === 0;
    this.logger.info('Interval check result', { 
      requisitionId, 
      passed, 
      violationCount: violations.length,
      warningCount: warnings.length
    });

    return { passed, violations, warning: warnings };
  }

  async autoProcessInventoryCheck(
    requisitionId: string
  ): Promise<{ passed: boolean; shortfalls: string[] }> {
    this.logger.info('Auto-processing inventory check', { requisitionId });

    const items = store.requisitionItemsStore().findByRequisitionId(requisitionId);
    const shortfalls: string[] = [];

    for (const item of items) {
      const available = store.inventoriesStore().getTotalByPesticideId(item.pesticideId);
      if (available < item.quantity) {
        shortfalls.push(
          `条目 ${item.id}: ${item.pesticideName} 库存不足。需求: ${item.quantity} ${item.unit}, 可用: ${available} ${item.unit}`
        );
      }
    }

    const passed = shortfalls.length === 0;
    this.logger.info('Inventory check result', { requisitionId, passed, shortfallCount: shortfalls.length });

    return { passed, shortfalls };
  }

  async cancelRequisition(
    requisitionId: string,
    context: ApprovalContext
  ): Promise<{ requisition: Requisition; record: ApprovalRecord }> {
    this.logger.info('Cancelling requisition', { requisitionId });

    const requisition = store.requisitionsStore().findById(requisitionId);
    if (!requisition) {
      throw new NotFoundError('Requisition', requisitionId);
    }

    const terminalStatuses: RequisitionStatus[] = ['FULFILLED', 'CANCELLED', 'REJECTED'];
    if (terminalStatuses.includes(requisition.status)) {
      throw new InvalidStateTransitionError(requisition.status, 'CANCELLED');
    }

    const previousStatus = requisition.status;
    const newStatus: RequisitionStatus = 'CANCELLED';

    const updated = store.requisitionsStore().update(requisitionId, {
      status: newStatus,
      lastProcessedById: context.processorId,
      lastProcessedAt: new Date()
    });

    if (!updated) {
      throw new ApprovalFlowError('取消领用单失败');
    }

    const record = store.approvalRecordsStore().create({
      requisitionId,
      stage: requisition.currentStage,
      action: 'CANCEL',
      processorId: context.processorId,
      processorName: context.processorName,
      processedAt: new Date(),
      comments: context.comments || null,
      previousStatus,
      newStatus,
      isAutoProcessed: false,
      failureReason: null
    });

    this.logger.info('Requisition cancelled', { requisitionId });
    return { requisition: updated, record };
  }

  getStageDescription(stage: ApprovalStage): string {
    return STAGE_DESCRIPTIONS[stage] || stage;
  }

  getFlowStages(): ApprovalStage[] {
    return [...APPROVAL_FLOW];
  }
}

export const approvalFlowService = new ApprovalFlowService();
export { ApprovalContext, FlowProgress, APPROVAL_FLOW, STAGE_DESCRIPTIONS };

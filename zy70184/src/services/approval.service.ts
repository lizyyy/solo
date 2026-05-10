import { ApprovalFlow, ApprovalRecord, PaymentBatch, ApprovalStatus } from '@prisma/client';
import { prisma } from '../config/database';
import { NotFoundError, ValidationError, ForbiddenError } from '../utils/error';
import { ApprovalLevelConfig, OperatorContext } from '../types/payment';

export interface CreateApprovalFlowInput {
  flowName: string;
  flowType: string;
  minAmount: string;
  maxAmount: string;
  levels: ApprovalLevelConfig[];
  description?: string;
}

export const approvalService = {
  async createFlow(input: CreateApprovalFlowInput): Promise<ApprovalFlow> {
    const exists = await prisma.approvalFlow.findUnique({
      where: { flowName: input.flowName },
    });
    if (exists) {
      throw new ValidationError('审批流名称已存在');
    }

    return prisma.approvalFlow.create({
      data: {
        flowName: input.flowName,
        flowType: input.flowType,
        minAmount: input.minAmount,
        maxAmount: input.maxAmount,
        levels: input.levels as unknown as object,
        description: input.description,
      },
    });
  },

  async getFlowByName(flowName: string): Promise<ApprovalFlow | null> {
    return prisma.approvalFlow.findUnique({
      where: { flowName },
    });
  },

  async findMatchingFlow(totalAmount: string, flowType: string = 'PAYMENT_BATCH'): Promise<ApprovalFlow | null> {
    const amount = parseFloat(totalAmount);
    const flows = await prisma.approvalFlow.findMany({
      where: {
        flowType,
        isActive: true,
      },
      orderBy: { minAmount: 'asc' },
    });

    for (const flow of flows) {
      const min = parseFloat(flow.minAmount.toString());
      const max = parseFloat(flow.maxAmount.toString());
      if (amount >= min && amount <= max) {
        return flow;
      }
    }

    return null;
  },

  getLevels(flow: ApprovalFlow): ApprovalLevelConfig[] {
    return (flow.levels as unknown as ApprovalLevelConfig[]).sort((a, b) => a.level - b.level);
  },

  async initializeApprovalRecords(batchId: string, levels: ApprovalLevelConfig[]): Promise<ApprovalRecord[]> {
    const records = levels.map((level) => ({
      batchId,
      level: level.level,
      status: ApprovalStatus.PENDING,
    }));

    return prisma.approvalRecord.createManyAndReturn({
      data: records,
    });
  },

  async getApprovalContext(batchId: string): Promise<{
    records: ApprovalRecord[];
    currentLevel: number;
    isFullyApproved: boolean;
    isRejected: boolean;
  }> {
    const records = await prisma.approvalRecord.findMany({
      where: { batchId },
      orderBy: { level: 'asc' },
    });

    const rejected = records.find((r) => r.status === ApprovalStatus.REJECTED);
    if (rejected) {
      return {
        records,
        currentLevel: rejected.level,
        isFullyApproved: false,
        isRejected: true,
      };
    }

    let currentLevel = 1;
    let allApproved = true;

    for (const record of records) {
      if (record.status === ApprovalStatus.PENDING) {
        currentLevel = record.level;
        allApproved = false;
        break;
      }
    }

    return {
      records,
      currentLevel,
      isFullyApproved: allApproved,
      isRejected: false,
    };
  },

  async canApprove(
    batchId: string,
    operator: OperatorContext,
    flow?: ApprovalLevelConfig[]
  ): Promise<{ approved: boolean; reason?: string; requiredLevel?: ApprovalLevelConfig }> {
    const context = await this.getApprovalContext(batchId);

    if (context.isRejected) {
      return { approved: false, reason: '该批次已被拒绝' };
    }

    if (context.isFullyApproved) {
      return { approved: false, reason: '该批次已完成审批' };
    }

    const currentRecord = context.records.find((r) => r.level === context.currentLevel);
    if (!currentRecord) {
      return { approved: false, reason: '找不到当前审批级别' };
    }

    const levelConfig = flow?.find((l) => l.level === context.currentLevel);
    if (!levelConfig) {
      return { approved: false, reason: '审批级别配置缺失' };
    }

    if (currentRecord.approverId && currentRecord.approverId !== operator.id) {
      return { approved: false, reason: '非当前审批人' };
    }

    return { approved: true, requiredLevel: levelConfig };
  },

  async approve(
    batchId: string,
    operator: OperatorContext,
    comment?: string
  ): Promise<{ batch: PaymentBatch; record: ApprovalRecord; isFullyApproved: boolean }> {
    const batch = await prisma.paymentBatch.findUnique({
      where: { id: batchId },
      include: { approvals: true },
    });

    if (!batch) {
      throw new NotFoundError('批次不存在');
    }

    const flow = await this.findMatchingFlow(batch.totalAmount.toString());
    if (!flow) {
      throw new ValidationError('未找到匹配的审批流');
    }

    const levels = this.getLevels(flow);
    const canApprove = await this.canApprove(batchId, operator, levels);

    if (!canApprove.approved) {
      throw new ForbiddenError(canApprove.reason || '无权审批');
    }

    const currentLevel = canApprove.requiredLevel!;
    const updatedRecord = await prisma.approvalRecord.update({
      where: { id: batch.approvals.find((a) => a.level === currentLevel.level)?.id },
      data: {
        status: ApprovalStatus.APPROVED,
        approverId: operator.id,
        approverName: operator.name,
        approvedAt: new Date(),
        comment,
      },
    });

    const context = await this.getApprovalContext(batchId);
    const updatedBatch = batch;

    if (context.isFullyApproved) {
      await prisma.paymentBatch.update({
        where: { id: batchId },
        data: {
          status: 'APPROVED',
          approvedAt: new Date(),
          approvedBy: operator.id,
        },
      });
      updatedBatch.status = 'APPROVED';
    }

    return {
      batch: updatedBatch,
      record: updatedRecord,
      isFullyApproved: context.isFullyApproved,
    };
  },

  async reject(
    batchId: string,
    operator: OperatorContext,
    reason: string
  ): Promise<{ batch: PaymentBatch; record: ApprovalRecord }> {
    const batch = await prisma.paymentBatch.findUnique({
      where: { id: batchId },
      include: { approvals: true },
    });

    if (!batch) {
      throw new NotFoundError('批次不存在');
    }

    const context = await this.getApprovalContext(batchId);

    if (context.isRejected) {
      throw new ValidationError('批次已被拒绝');
    }

    const currentRecord = context.records.find((r) => r.level === context.currentLevel);
    if (!currentRecord) {
      throw new ValidationError('找不到当前审批记录');
    }

    const updatedRecord = await prisma.approvalRecord.update({
      where: { id: currentRecord.id },
      data: {
        status: ApprovalStatus.REJECTED,
        approverId: operator.id,
        approverName: operator.name,
        rejectedAt: new Date(),
        comment: reason,
      },
    });

    const updatedBatch = await prisma.paymentBatch.update({
      where: { id: batchId },
      data: {
        status: 'REJECTED',
        rejectedAt: new Date(),
        rejectedBy: operator.id,
        rejectedReason: reason,
      },
    });

    return { batch: updatedBatch, record: updatedRecord };
  },

  async listFlows(params: {
    page: number;
    pageSize: number;
    flowType?: string;
    isActive?: boolean;
  }): Promise<{ items: ApprovalFlow[]; total: number }> {
    const where: Record<string, unknown> = {};
    if (params.flowType) where.flowType = params.flowType;
    if (params.isActive !== undefined) where.isActive = params.isActive;

    const [items, total] = await Promise.all([
      prisma.approvalFlow.findMany({
        where,
        skip: (params.page - 1) * params.pageSize,
        take: params.pageSize,
        orderBy: { minAmount: 'asc' },
      }),
      prisma.approvalFlow.count({ where }),
    ]);

    return { items, total };
  },
};

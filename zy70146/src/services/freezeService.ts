import { FreezeReason } from '../types/enums';
import prisma from '../lib/prisma';
import { processTraceService } from './processTraceService';

export const freezeService = {
  async freezeBudget(
    budgetId: string,
    reason: FreezeReason,
    options: { description?: string; operator?: string } = {}
  ) {
    const budget = await prisma.timeWindowBudget.findUnique({
      where: { id: budgetId },
      include: { sloConfig: true },
    });

    if (!budget) {
      throw new Error('预算记录不存在');
    }

    const trace = await processTraceService.create({
      tenantId: budget.tenantId,
      sloConfigId: budget.sloConfigId,
      step: 'BUDGET_FREEZE',
      status: 'IN_PROGRESS',
      currentCheckpoint: 'FREEZE_START',
      checkpointMessage: `开始执行预算冻结`,
      operator: options.operator,
      metadata: { reason, description: options.description },
    });

    try {
      if (budget.isFrozen) {
        await processTraceService.update(trace.id, {
          status: 'REJECTED',
          currentCheckpoint: 'ALREADY_FROZEN',
          checkpointMessage: '该预算已处于冻结状态',
        });
        throw new Error('该预算已处于冻结状态');
      }

      const freeze = await prisma.budgetFreeze.create({
        data: {
          tenantId: budget.tenantId,
          budgetId,
          reason,
          description: options.description,
          frozenBy: options.operator,
        },
      });

      const updatedBudget = await prisma.timeWindowBudget.update({
        where: { id: budgetId },
        data: {
          isFrozen: true,
          frozenAt: new Date(),
          frozenReason: reason,
        },
      });

      await processTraceService.update(trace.id, {
        status: 'APPROVED',
        currentCheckpoint: 'FROZEN',
        checkpointMessage: `预算已冻结: ${reason}`,
      });

      return {
        freeze,
        budget: updatedBudget,
      };
    } catch (error) {
      await processTraceService.update(trace.id, {
        status: 'REJECTED',
        currentCheckpoint: 'FREEZE_FAILED',
        checkpointMessage: error instanceof Error ? error.message : '冻结失败',
      });
      throw error;
    }
  },

  async unfreezeBudget(
    budgetId: string,
    options: { reason?: string; operator?: string } = {}
  ) {
    const budget = await prisma.timeWindowBudget.findUnique({
      where: { id: budgetId },
      include: { sloConfig: true },
    });

    if (!budget) {
      throw new Error('预算记录不存在');
    }

    if (!budget.isFrozen) {
      throw new Error('该预算未处于冻结状态');
    }

    const activeFreezes = await prisma.budgetFreeze.findMany({
      where: {
        budgetId,
        isActive: true,
      },
    });

    for (const freeze of activeFreezes) {
      await prisma.budgetFreeze.update({
        where: { id: freeze.id },
        data: {
          isActive: false,
          unfrozenAt: new Date(),
          unfrozenBy: options.operator,
          unfreezeReason: options.reason,
        },
      });
    }

    const updatedBudget = await prisma.timeWindowBudget.update({
      where: { id: budgetId },
      data: {
        isFrozen: false,
        frozenAt: null,
        frozenReason: null,
      },
    });

    return {
      unfrozenFreezes: activeFreezes,
      budget: updatedBudget,
    };
  },

  async listFreezes(tenantId: string, options: { isActive?: boolean; budgetId?: string; limit?: number } = {}) {
    const where: any = { tenantId };
    if (options.isActive !== undefined) where.isActive = options.isActive;
    if (options.budgetId) where.budgetId = options.budgetId;

    return prisma.budgetFreeze.findMany({
      where,
      orderBy: { frozenAt: 'desc' },
      take: options.limit || 50,
      include: {
        budget: {
          include: {
            sloConfig: true,
          },
        },
      },
    });
  },

  async getActiveFreeze(budgetId: string) {
    return prisma.budgetFreeze.findFirst({
      where: {
        budgetId,
        isActive: true,
      },
      orderBy: { frozenAt: 'desc' },
    });
  },
};

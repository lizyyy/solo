import prisma from '../lib/prisma';
import { getTimeWindowRange, isRollingWindow } from '../lib/timeWindow';
import { calculateTotalBudget, calculateDeductionAmount, calculateBudgetPercentage } from '../lib/budgetCalculator';
import { SLOType, TimeWindowType, TimeWindowTypeValues } from '../types/enums';
import { processTraceService } from './processTraceService';

function asSLOType(type: string): SLOType {
  return type as SLOType;
}

function asTimeWindowType(type: string): TimeWindowType {
  return type as TimeWindowType;
}

export const budgetService = {
  async getOrCreateBudget(sloConfigId: string, referenceTime?: Date) {
    const sloConfig = await prisma.sLOConfiguration.findUnique({
      where: { id: sloConfigId },
    });

    if (!sloConfig) {
      throw new Error('SLO 配置不存在');
    }

    if (!sloConfig.isActive) {
      throw new Error('SLO 配置已停用');
    }

    const { start, end } = getTimeWindowRange(asTimeWindowType(sloConfig.timeWindowType), referenceTime);

    let budget = await prisma.timeWindowBudget.findFirst({
      where: {
        sloConfigId,
        windowStart: start,
      },
    });

    if (!budget) {
      const totalBudget = calculateTotalBudget(
        asSLOType(sloConfig.type),
        sloConfig.targetValue,
        asTimeWindowType(sloConfig.timeWindowType)
      );

      budget = await prisma.timeWindowBudget.create({
        data: {
          tenantId: sloConfig.tenantId,
          sloConfigId,
          windowStart: start,
          windowEnd: end,
          windowType: sloConfig.timeWindowType,
          totalBudget,
          remainingBudget: totalBudget,
        },
      });
    }

    return budget;
  },

  async deductFromBudget(sloConfigId: string, errorSampleId: string, options: {
    reason?: string; metadata?: any; operator?: string } = {}) {
    const sloConfigPre = await prisma.sLOConfiguration.findUnique({
      where: { id: sloConfigId },
    });
    
    if (!sloConfigPre) {
      throw new Error('SLO 配置不存在');
    }

    const trace = await processTraceService.create({
      tenantId: sloConfigPre.tenantId,
      sloConfigId,
      step: 'BUDGET_DEDUCTION',
      status: 'IN_PROGRESS',
      currentCheckpoint: 'DEDUCTION_START',
      checkpointMessage: '开始执行预算扣减',
      operator: options.operator,
      metadata: { errorSampleId, reason: options.reason },
    });

    try {
      const budget = await this.getOrCreateBudget(sloConfigId);

      if (budget.isFrozen) {
        await processTraceService.update(trace.id, {
          status: 'REJECTED',
          currentCheckpoint: 'BUDGET_FROZEN',
          checkpointMessage: `预算已被冻结: ${budget.frozenReason || '未知原因'}，无法扣减`,
        });
        throw new Error('预算已被冻结，无法扣减');
      }

      const sloConfig = await prisma.sLOConfiguration.findUnique({
        where: { id: sloConfigId },
      });

      const errorSample = await prisma.errorSample.findUnique({
        where: { id: errorSampleId },
      });

      if (!sloConfig || !errorSample) {
        await processTraceService.update(trace.id, {
          status: 'REJECTED',
          currentCheckpoint: 'DATA_MISSING',
          checkpointMessage: 'SLO 配置或错误样本不存在',
        });
        throw new Error('SLO 配置或错误样本不存在');
      }

      if (errorSample.isDeducted) {
        await processTraceService.update(trace.id, {
          status: 'REJECTED',
          currentCheckpoint: 'ALREADY_DEDUCTED',
          checkpointMessage: '该错误样本已被扣减过',
        });
        throw new Error('该错误样本已被扣减过');
      }

      const deductionAmount = calculateDeductionAmount(
        asSLOType(sloConfig.type),
        options.metadata
      );

      const actualDeduction = Math.min(deductionAmount, budget.remainingBudget);

      if (actualDeduction <= 0) {
        await prisma.errorSample.update({
          where: { id: errorSampleId },
          data: {
            isDeducted: true,
            deductedAt: new Date(),
          },
        });

        await processTraceService.update(trace.id, {
          status: 'APPROVED',
          currentCheckpoint: 'NO_DEDUCTION_NEEDED',
          checkpointMessage: '错误样本无需扣减预算（如延迟未超标）',
        });

        return {
          budget,
          deductionAmount: 0,
          reason: '无需扣减',
        };
      }

      const newUsedBudget = budget.usedBudget + actualDeduction;
      const newRemainingBudget = budget.totalBudget - newUsedBudget;

      const updatedBudget = await prisma.timeWindowBudget.update({
        where: { id: budget.id },
        data: {
          usedBudget: newUsedBudget,
          remainingBudget: newRemainingBudget,
        },
      });

      await prisma.budgetDeduction.create({
        data: {
          budgetId: budget.id,
          errorSampleId,
          deductedAmount: actualDeduction,
          reason: options.reason,
        },
      });

      await prisma.errorSample.update({
        where: { id: errorSampleId },
        data: {
          isDeducted: true,
          deductedAt: new Date(),
        },
      });

      const remainingPercentage = calculateBudgetPercentage(
        newRemainingBudget,
        updatedBudget.totalBudget
      );

      await processTraceService.update(trace.id, {
        status: 'APPROVED',
        currentCheckpoint: 'DEDUCTION_COMPLETED',
        checkpointMessage: `预算扣减完成: 扣减 ${actualDeduction}，剩余 ${newRemainingBudget}/${updatedBudget.totalBudget} (${remainingPercentage}%)`,
      });

      return {
        budget: updatedBudget,
        deductionAmount: actualDeduction,
        remainingPercentage,
      };
    } catch (error) {
      await processTraceService.update(trace.id, {
        status: 'REJECTED',
        currentCheckpoint: 'DEDUCTION_FAILED',
        checkpointMessage: error instanceof Error ? error.message : '扣减失败',
      });
      throw error;
    }
  },

  async getBudgetStatus(sloConfigId: string, referenceTime?: Date) {
    const budget = await this.getOrCreateBudget(sloConfigId);
    
    const freezes = await prisma.budgetFreeze.findMany({
      where: {
        budgetId: budget.id,
        isActive: true,
      },
      orderBy: { frozenAt: 'desc' },
    });

    const suppressions = await prisma.alertSuppression.findMany({
      where: {
        budgetId: budget.id,
        isActive: true,
      },
      orderBy: { suppressedAt: 'desc' },
    });

    const recentDeductions = await prisma.budgetDeduction.findMany({
      where: { budgetId: budget.id },
      orderBy: { deductedAt: 'desc' },
      take: 10,
      include: { errorSample: true },
    });

    return {
      budget,
      freezes,
      suppressions,
      recentDeductions,
      utilization: {
        percentage: (budget.usedBudget / budget.totalBudget) * 100,
        remainingPercentage: (budget.remainingBudget / budget.totalBudget) * 100,
        isDepleted: budget.remainingBudget <= 0,
        isWarning: budget.remainingBudget <= budget.totalBudget * 0.2,
      },
    };
  },

  async listBudgets(tenantId: string, options: { isFrozen?: boolean; windowType?: string; limit?: number } = {}) {
    const where: any = { tenantId };
    if (options.isFrozen !== undefined) where.isFrozen = options.isFrozen;
    if (options.windowType) where.windowType = options.windowType;

    return prisma.timeWindowBudget.findMany({
      where,
      orderBy: { windowStart: 'desc' },
      take: options.limit || 50,
      include: {
        sloConfig: {
          include: {
            service: true,
            endpoint: true,
          },
        },
      },
    });
  },
};

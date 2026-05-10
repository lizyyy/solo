import { PaymentLimit, DailyLimitUsage } from '@prisma/client';
import { prisma } from '../config/database';
import { ValidationError } from '../utils/error';
import { LimitCheckResult } from '../types/payment';
import dayjs from 'dayjs';

export interface CreateLimitInput {
  limitType: string;
  limitKey: string;
  dailyAmountLimit: string;
  dailyCountLimit: number;
  singleAmountMax: string;
  singleAmountMin: string;
  description?: string;
}

const DEFAULT_LIMITS = {
  dailyAmountLimit: '10000000.00',
  dailyCountLimit: 1000,
  singleAmountMax: '500000.00',
  singleAmountMin: '0.01',
};

export const limitService = {
  async createLimit(input: CreateLimitInput): Promise<PaymentLimit> {
    const existing = await prisma.paymentLimit.findUnique({
      where: { limitType_limitKey: { limitType: input.limitType, limitKey: input.limitKey } },
    });

    if (existing) {
      throw new ValidationError('该类型和Key组合已存在');
    }

    return prisma.paymentLimit.create({
      data: {
        limitType: input.limitType,
        limitKey: input.limitKey,
        dailyAmountLimit: input.dailyAmountLimit,
        dailyCountLimit: input.dailyCountLimit,
        singleAmountMax: input.singleAmountMax,
        singleAmountMin: input.singleAmountMin,
        description: input.description,
      },
    });
  },

  async getLimit(limitType: string, limitKey: string): Promise<PaymentLimit | null> {
    return prisma.paymentLimit.findUnique({
      where: { limitType_limitKey: { limitType, limitKey },
    });
  },

  async getOrCreateDefault(limitType: string, limitKey: string): Promise<PaymentLimit> {
    let limit = await this.getLimit(limitType, limitKey);
    if (!limit) {
      limit = await this.createLimit({
        limitType,
        limitKey,
        ...DEFAULT_LIMITS,
        description: '系统默认限额',
      });
    }
    return limit;
  },

  async getDailyUsage(limitType: string, limitKey: string, date?: Date): Promise<DailyLimitUsage> {
    const targetDate = date || dayjs().startOf('day').toDate();
    
    let usage = await prisma.dailyLimitUsage.findUnique({
      where: {
        limitType_limitKey_date: { limitType, limitKey, date: targetDate },
      },
    });

    if (!usage) {
      usage = await prisma.dailyLimitUsage.upsert({
        where: {
          limitType_limitKey_date: { limitType, limitKey, date: targetDate },
        },
        update: {},
        create: {
          limitType,
          limitKey,
          date: targetDate,
          usedAmount: '0.00',
          usedCount: 0,
        },
      });
    }

    return usage;
  },

  async checkBatchLimit(
    limitType: string,
    limitKey: string,
    totalAmount: string,
    totalCount: number,
    items: { amount: string }[]
  ): Promise<LimitCheckResult> {
    const limit = await this.getOrCreateDefault(limitType, limitKey);
    const usage = await this.getDailyUsage(limitType, limitKey);

    const totalAmountNum = parseFloat(totalAmount);
    const limitAmount = parseFloat(limit.dailyAmountLimit.toString());
    const limitCount = limit.dailyCountLimit;
    const singleMax = parseFloat(limit.singleAmountMax.toString());
    const singleMin = parseFloat(limit.singleAmountMin.toString());
    const usedAmount = parseFloat(usage.usedAmount.toString());
    const usedCount = usage.usedCount;

    for (let i = 0; i < items.length; i++) {
      const itemAmount = parseFloat(items[i].amount);
      if (itemAmount > singleMax) {
        return {
          passed: false,
          exceededLimit: 'SINGLE_AMOUNT_MAX',
          limit: {
            dailyAmountLimit: limit.dailyAmountLimit.toString(),
            dailyCountLimit: limit.dailyCountLimit,
            singleAmountMax: limit.singleAmountMax.toString(),
          },
          currentUsage: {
            amount: usage.usedAmount.toString(),
            count: usage.usedCount,
          },
        };
      }
      if (itemAmount < singleMin) {
        return {
          passed: false,
          exceededLimit: 'SINGLE_AMOUNT_MIN',
        };
      }
    }

    if (totalAmountNum + usedAmount > limitAmount) {
      return {
        passed: false,
        exceededLimit: 'DAILY_AMOUNT_LIMIT',
        currentUsage: {
          amount: usage.usedAmount.toString(),
          count: usage.usedCount,
        },
        limit: {
          dailyAmountLimit: limit.dailyAmountLimit.toString(),
          dailyCountLimit: limit.dailyCountLimit,
          singleAmountMax: limit.singleAmountMax.toString(),
        },
      };
    }

    if (totalCount + usedCount > limitCount) {
      return {
        passed: false,
        exceededLimit: 'DAILY_COUNT_LIMIT',
        currentUsage: {
          amount: usage.usedAmount.toString(),
          count: usage.usedCount,
        },
        limit: {
          dailyAmountLimit: limit.dailyAmountLimit.toString(),
          dailyCountLimit: limit.dailyCountLimit,
          singleAmountMax: limit.singleAmountMax.toString(),
        },
      };
    }

    return { passed: true };
  },

  async consumeLimit(
    limitType: string,
    limitKey: string,
    amount: string,
    count: number
  ): Promise<DailyLimitUsage> {
    const targetDate = dayjs().startOf('day').toDate();
    
    return prisma.dailyLimitUsage.upsert({
      where: {
        limitType_limitKey_date: { limitType, limitKey, date: targetDate },
      },
      update: {
        usedAmount: {
          increment: parseFloat(amount) },
        usedCount: {
          increment: count,
        },
      },
      create: {
        limitType,
        limitKey,
        date: targetDate,
        usedAmount: parseFloat(amount),
        usedCount: count,
      },
    });
  },

  async releaseLimit(
    limitType: string,
    limitKey: string,
    amount: string,
    count: number
  ): Promise<DailyLimitUsage> {
    const targetDate = dayjs().startOf('day').toDate();
    
    return prisma.dailyLimitUsage.update({
      where: {
        limitType_limitKey_date: { limitType, limitKey, date: targetDate },
      },
      data: {
        usedAmount: {
          decrement: parseFloat(amount) },
        usedCount: {
          decrement: count,
        },
      },
    });
  },

  async listLimits(params: {
    page: number;
    pageSize: number;
    limitType?: string;
    isActive?: boolean;
  }): Promise<{ items: PaymentLimit[]; total: number }> {
    const where: Record<string, unknown> = {};
    if (params.limitType) where.limitType = params.limitType;
    if (params.isActive !== undefined) where.isActive = params.isActive;

    const [items, total] = await Promise.all([
      prisma.paymentLimit.findMany({
        where,
        skip: (params.page - 1) * params.pageSize,
        take: params.pageSize,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.paymentLimit.count({ where }),
    ]);

    return { items, total };
  },
};

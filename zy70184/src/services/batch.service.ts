import { PaymentBatch, Payment, BatchStatus, PaymentStatus } from '@prisma/client';
import { prisma } from '../config/database';
import {
  ValidationError,
  NotFoundError,
  ConflictError,
  IdempotentKeyConflict,
} from '../utils/error';
import {
  CreatePaymentBatchInput,
  PaymentValidationResult,
  ValidationErrorItem,
  OperatorContext,
} from '../types/payment';
import { accountService } from './account.service';
import { limitService } from './limit.service';
import { approvalService } from './approval.service';
import { auditService } from './audit.service';
import { v4 as uuidv4 } from 'uuid';
import dayjs from 'dayjs';

const generateBatchNo = (): string => {
  const dateStr = dayjs().format('YYYYMMDD');
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `PB${dateStr}${random}`;
};

const generatePaymentNo = (batchNo: string, index: number): string => {
  return `${batchNo}${String(index + 1).padStart(4, '0')}`;
};

export const batchService = {
  async validateBatch(
    input: CreatePaymentBatchInput
  ): Promise<PaymentValidationResult> {
    const errors: ValidationErrorItem[] = [];
    const warnings: ValidationErrorItem[] = [];

    if (!input.idempotencyKey || input.idempotencyKey.trim().length < 5) {
      errors.push({
        type: 'error',
        code: 'INVALID_IDEMPOTENCY_KEY',
        message: '幂等键无效',
        field: 'idempotencyKey',
      });
    }

    if (!input.items || input.items.length === 0) {
      errors.push({
        type: 'error',
        code: 'EMPTY_ITEMS',
        message: '付款明细不能为空',
      });
    } else if (input.items.length > 500) {
      errors.push({
        type: 'error',
        code: 'TOO_MANY_ITEMS',
        message: '单笔批次最多支持500条',
      });
    }

    const seenAccounts = new Map<string, number>();

    for (let i = 0; i < (input.items || []).length; i++) {
      const item = input.items[i];
      const amount = parseFloat(item.amount);

      const formatResult = accountService.validateAccountFormat(item.accountNumber, item.bankCode);
      if (!formatResult.valid) {
        errors.push({
          type: 'error',
          code: 'INVALID_ACCOUNT_FORMAT',
          message: formatResult.errors.join(', '),
          itemIndex: i,
        });
      }

      if (isNaN(amount) || amount <= 0) {
        errors.push({
          type: 'error',
          code: 'INVALID_AMOUNT',
          message: '金额必须大于0',
          field: 'amount',
          itemIndex: i,
        });
      }

      const accountKey = `${item.accountNumber}-${item.amount}`;
      if (seenAccounts.has(accountKey)) {
        warnings.push({
          type: 'warning',
          code: 'DUPLICATE_ITEM',
          message: `与第${seenAccounts.get(accountKey)! + 1}条重复`,
          itemIndex: i,
        });
      } else {
        seenAccounts.set(accountKey, i);
      }

      const existing = await accountService.getAccountByNumber(item.accountNumber);
      if (existing && !existing.isVerified) {
        warnings.push({
          type: 'warning',
          code: 'UNVERIFIED_ACCOUNT',
          message: '该账户尚未验证',
          itemIndex: i,
        });
      }
    }

    let totalAmount = '0.00';
    if (input.items?.length) {
      totalAmount = input.items
        .reduce((sum, item) => sum + parseFloat(item.amount || '0'), 0)
        .toFixed(2);
    }

    const limitCheck = await limitService.checkBatchLimit(
      'GLOBAL',
      'DEFAULT',
      totalAmount,
      input.items?.length || 0,
      input.items?.map((i) => ({ amount: i.amount })) || []
    );

    if (!limitCheck.passed) {
      errors.push({
        type: 'error',
        code: 'LIMIT_EXCEEDED',
        message: `限额校验失败: ${limitCheck.exceededLimit}`,
      });
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  },

  async checkIdempotency(idempotencyKey: string): Promise<{
    exists: boolean; existing?: PaymentBatch }> {
    const existing = await prisma.paymentBatch.findUnique({
      where: { idempotencyKey },
    });
    return { exists: !!existing, existing };
  },

  async createBatch(input: CreatePaymentBatchInput): Promise<{
    batch: PaymentBatch;
    payments: Payment[];
    validation: PaymentValidationResult;
  }> {
    const idempotencyCheck = await this.checkIdempotency(input.idempotencyKey);
    if (idempotencyCheck.exists && idempotencyCheck.existing) {
      const payments = await prisma.payment.findMany({
        where: { batchId: idempotencyCheck.existing.id },
      });
      return {
        batch: idempotencyCheck.existing,
        payments,
        validation: { valid: true, errors: [], warnings: [] },
      };
    }

    const validation = await this.validateBatch(input);

    if (!validation.valid) {
      throw new ValidationError('批次校验失败', {
        errors: validation.errors });
    }

    const batchNo = generateBatchNo();

    return prisma.$transaction(async (tx) => {
      const accounts = new Map<string, { id: string }>();
      for (const item of input.items) {
        const account = await accountService.getOrCreateAccount(
          item.accountNumber,
          item.accountName,
          item.bankCode,
          item.bankName,
          item.branchName
        );
        accounts.set(item.accountNumber, { id: account.id });
      }

      const totalAmount = input.items
        .reduce((sum, item) => sum + parseFloat(item.amount || '0'), 0)
        .toFixed(2);

      const batch = await tx.paymentBatch.create({
        data: {
          batchNo,
          batchName: input.batchName,
          totalAmount,
          totalCount: input.items.length,
          status: BatchStatus.DRAFT,
          currency: input.currency || 'CNY',
          initiatorId: input.operator.id,
          initiatorName: input.operator.name,
          idempotencyKey: input.idempotencyKey,
          notes: input.notes,
        },
      });

      const payments = await Promise.all(
        input.items.map((item, index) => {
          const account = accounts.get(item.accountNumber);
          if (!account) throw new Error('账户映射错误');

          return tx.payment.create({
            data: {
              batchId: batch.id,
              paymentNo: generatePaymentNo(batchNo, index),
              accountId: account.id,
              amount: item.amount,
              currency: item.currency || input.currency || 'CNY',
              status: PaymentStatus.PENDING,
              idempotencyKey: `${input.idempotencyKey}-${index}`,
              purpose: item.purpose,
              remark: item.remark,
            },
          });
        }
      );

      await auditService.createLog({
        actionType: 'BATCH_CREATE',
        entityType: 'PaymentBatch',
        entityId: batch.id,
        operatorId: input.operator.id,
        operatorName: input.operator.name,
        afterValue: {
          batchNo,
          totalAmount,
          totalCount: input.items.length,
        },
      });

      return { batch, payments, validation };
    });
  },

  async submitBatch(batchId: string, operator: OperatorContext): Promise<PaymentBatch> {
    const batch = await prisma.paymentBatch.findUnique({
      where: { id: batchId },
      include: { approvals: true },
    });

    if (!batch) {
      throw new NotFoundError('批次不存在');
    }

    if (batch.status !== BatchStatus.DRAFT) {
      throw new ConflictError('批次状态不正确', { currentStatus: batch.status });
    }

    const flow = await approvalService.findMatchingFlow(batch.totalAmount.toString());
    let targetStatus = BatchStatus.PENDING_REVIEW;

    if (!flow) {
      targetStatus = BatchStatus.APPROVED;

      return prisma.$transaction(async (tx) => {
        const updatedBatch = await tx.paymentBatch.update({
          where: { id: batchId },
          data: {
            status: targetStatus,
            submittedAt: new Date(),
          },
        });

        await tx.payment.updateMany({
          where: { batchId },
          data: { status: PaymentStatus.PROCESSING },
        });

        await limitService.consumeLimit(
          'GLOBAL',
          'DEFAULT',
          batch.totalAmount.toString(),
          batch.totalCount
        );

        await auditService.createLog({
          actionType: 'BATCH_SUBMIT',
          entityType: 'PaymentBatch',
          entityId: batchId,
          operatorId: operator.id,
          operatorName: operator.name,
          afterValue: { status: targetStatus },
        });

        return updatedBatch;
      });
    }

    const levels = approvalService.getLevels(flow);
    await approvalService.initializeApprovalRecords(batchId, levels);

    const updatedBatch = await prisma.paymentBatch.update({
      where: { id: batchId },
      data: {
        status: BatchStatus.PENDING_REVIEW,
        submittedAt: new Date(),
      },
    });

    await auditService.createLog({
      actionType: 'BATCH_SUBMIT',
      entityType: 'PaymentBatch',
      entityId: batchId,
      operatorId: operator.id,
      operatorName: operator.name,
      afterValue: { status: BatchStatus.PENDING_REVIEW, approvalFlow: flow.flowName },
    });

    return updatedBatch;
  },

  async getBatchById(id: string): Promise<PaymentBatch & { payments: Payment[] }> {
    const batch = await prisma.paymentBatch.findUnique({
      where: { id },
      include: {
        payments: {
          include: {
          account: true,
          refunds: true,
        },
        orderBy: { createdAt: 'asc' },
      },
    });

    if (!batch) {
      throw new NotFoundError('批次不存在');
    }

    return batch;
  },

  async listBatches(params: {
    page: number;
    pageSize: number;
    status?: BatchStatus;
    initiatorId?: string;
    startDate?: string;
    endDate?: string;
    search?: string;
  }): Promise<{ items: (PaymentBatch & { paymentCount: number })[]; total: number }> {
    const where: Record<string, unknown> = {};
    if (params.status) where.status = params.status;
    if (params.initiatorId) where.initiatorId = params.initiatorId;
    if (params.search) where.batchNo = { contains: params.search };
    if (params.startDate || params.endDate) {
      where.createdAt = {};
      if (params.startDate) where.createdAt.gte = new Date(params.startDate);
      if (params.endDate) where.createdAt.lte = new Date(params.endDate);
    }

    const [items, total] = await Promise.all([
      prisma.paymentBatch.findMany({
        where,
        skip: (params.page - 1) * params.pageSize,
        take: params.pageSize,
        orderBy: { createdAt: 'desc' },
        include: { _count: { select: { payments: true } } },
      }),
      prisma.paymentBatch.count({ where }),
    ]);

    const itemsWithCount = items.map((item) => ({
      ...item,
      paymentCount: item._count.payments,
    }));

    return { items: itemsWithCount, total };
  },

  async cancelBatch(batchId: string, operator: OperatorContext, reason: string): Promise<PaymentBatch> {
    const batch = await prisma.paymentBatch.findUnique({ where: { id: batchId } });

    if (!batch) {
      throw new NotFoundError('批次不存在');
    }

    const allowedStatuses = [BatchStatus.DRAFT, BatchStatus.PENDING_REVIEW, BatchStatus.REVIEWING];
    if (!allowedStatuses.includes(batch.status)) {
      throw new ConflictError('当前状态不允许取消', { currentStatus: batch.status });
    }

    const updated = await prisma.paymentBatch.update({
      where: { id: batchId },
      data: {
        status: BatchStatus.CANCELLED,
        notes: reason ? `${batch.notes || ''}\n取消原因: ${reason}`.trim() : batch.notes,
      },
    });

    await auditService.createLog({
      actionType: 'BATCH_CANCEL',
      entityType: 'PaymentBatch',
      entityId: batchId,
      operatorId: operator.id,
      operatorName: operator.name,
      afterValue: { status: BatchStatus.CANCELLED, reason },
    });

    return updated;
  },
};

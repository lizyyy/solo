import { Prisma, Payment, Refund, RefundReason, PaymentStatus, BatchStatus } from '@prisma/client';
import { prisma } from '../config/database';
import { ValidationError, NotFoundError, ConflictError } from '../utils/error';
import { OperatorContext } from '../types/payment';
import { v4 as uuidv4 } from 'uuid';
import dayjs from 'dayjs';
import { limitService } from './limit.service';
import { auditService } from './audit.service';

const generateRefundNo = (): string => {
  const dateStr = dayjs().format('YYYYMMDD');
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `RF${dateStr}${random}`;
};

export interface ProcessRefundInput {
  paymentId: string;
  amount?: string;
  reason: RefundReason;
  reasonDetail?: string;
  idempotencyKey: string;
  operator: OperatorContext;
}

export const refundService = {
  async processRefund(input: ProcessRefundInput): Promise<{ refund: Refund; updatedPayment: Payment }> {
    const existingRefund = await prisma.refund.findUnique({
      where: { idempotencyKey: input.idempotencyKey },
    });

    if (existingRefund) {
      const payment = await prisma.payment.findUnique({
        where: { id: existingRefund.paymentId },
      });
      return { refund: existingRefund, updatedPayment: payment! };
    }

    const payment = await prisma.payment.findUnique({
      where: { id: input.paymentId },
      include: { refunds: true },
    });

    if (!payment) {
      throw new NotFoundError('付款记录不存在');
    }

    const allowedStatuses = [PaymentStatus.SUCCESS, PaymentStatus.PARTIAL_REFUND];
    if (!allowedStatuses.includes(payment.status)) {
      throw new ConflictError('当前付款状态不支持退票', { currentStatus: payment.status });
    }

    const refundedAmount = payment.refunds.reduce(
      (sum, r) => sum + parseFloat(r.amount.toString()),
      0
    );
    const remainingAmount = parseFloat(payment.amount.toString()) - refundedAmount;

    const requestAmount = input.amount ? parseFloat(input.amount) : remainingAmount;

    if (requestAmount <= 0) {
      throw new ValidationError('退票金额必须大于0');
    }

    if (requestAmount > remainingAmount) {
      throw new ValidationError('退票金额超过剩余可退金额', {
        requested: requestAmount,
        remaining: remainingAmount,
      });
    }

    return prisma.$transaction(async (tx) => {
      const refundNo = generateRefundNo();

      const refund = await tx.refund.create({
        data: {
          paymentId: input.paymentId,
          refundNo,
          amount: requestAmount,
          reason: input.reason,
          reasonDetail: input.reasonDetail,
          idempotencyKey: input.idempotencyKey,
          processedAt: new Date(),
        },
      });

      const updatedRefunds = [...payment.refunds, refund];
      const totalRefunded = updatedRefunds.reduce(
        (sum, r) => sum + parseFloat(r.amount.toString()),
        0
      );
      const newRemaining = parseFloat(payment.amount.toString()) - totalRefunded;

      let newStatus: PaymentStatus;
      if (newRemaining <= 0) {
        newStatus = PaymentStatus.REFUNDED;
      } else {
        newStatus = PaymentStatus.PARTIAL_REFUND;
      }

      const updatedPayment = await tx.payment.update({
        where: { id: input.paymentId },
        data: {
          status: newStatus,
        },
        include: { refunds: true },
      });

      await limitService.releaseLimit('GLOBAL', 'DEFAULT', requestAmount.toFixed(2), 0);

      await this.updateBatchStatusFromPayment(tx, payment.batchId);

      await auditService.createLog({
        actionType: 'REFUND_CREATE',
        entityType: 'Refund',
        entityId: refund.id,
        operatorId: input.operator.id,
        operatorName: input.operator.name,
        afterValue: {
          refundNo,
          paymentId: input.paymentId,
          amount: requestAmount,
          reason: input.reason,
        },
      });

      return { refund, updatedPayment };
    });
  },

  async updateBatchStatusFromPayment(
    tx: Prisma.TransactionClient,
    batchId: string
  ): Promise<void> {
    const batch = await tx.paymentBatch.findUnique({
      where: { id: batchId },
      include: { payments: true },
    });

    if (!batch) return;

    const payments = batch.payments;
    const totalCount = payments.length;
    
    const failedCount = payments.filter(
      (p) => p.status === PaymentStatus.FAILED
    ).length;
    
    const refundedCount = payments.filter(
      (p) => p.status === PaymentStatus.REFUNDED || p.status === PaymentStatus.PARTIAL_REFUND
    ).length;

    const successCount = payments.filter(
      (p) => p.status === PaymentStatus.SUCCESS
    ).length;

    let newStatus = batch.status;

    if (failedCount > 0 && successCount > 0) {
      newStatus = BatchStatus.PARTIAL_SUCCESS;
    } else if (refundedCount > 0 && successCount > 0) {
      newStatus = BatchStatus.PARTIAL_SUCCESS;
    } else if (refundedCount === totalCount && totalCount > 0) {
      newStatus = BatchStatus.FAILED;
    }

    if (newStatus !== batch.status) {
      await tx.paymentBatch.update({
        where: { id: batchId },
        data: {
          status: newStatus,
          failCount: failedCount + refundedCount,
          successCount,
        },
      });
    } else {
      await tx.paymentBatch.update({
        where: { id: batchId },
        data: {
          failCount: failedCount + refundedCount,
          successCount,
        },
      });
    }
  },

  async getRefundById(id: string): Promise<Refund> {
    const refund = await prisma.refund.findUnique({
      where: { id },
      include: { payment: { include: { account: true } } },
    });

    if (!refund) {
      throw new NotFoundError('退票记录不存在');
    }

    return refund;
  },

  async listRefunds(params: {
    page: number;
    pageSize: number;
    paymentId?: string;
    reason?: RefundReason;
    startDate?: string;
    endDate?: string;
  }): Promise<{ items: Refund[]; total: number }> {
    const where: Prisma.RefundWhereInput = {};
    if (params.paymentId) where.paymentId = params.paymentId;
    if (params.reason) where.reason = params.reason;
    if (params.startDate || params.endDate) {
      where.createdAt = {};
      if (params.startDate) where.createdAt.gte = new Date(params.startDate);
      if (params.endDate) where.createdAt.lte = new Date(params.endDate);
    }

    const [items, total] = await Promise.all([
      prisma.refund.findMany({
        where,
        skip: (params.page - 1) * params.pageSize,
        take: params.pageSize,
        orderBy: { createdAt: 'desc' },
        include: { payment: { include: { account: true } } },
      }),
      prisma.refund.count({ where }),
    ]);

    return { items, total };
  },

  async getRefundByPayment(paymentId: string): Promise<Refund[]> {
    return prisma.refund.findMany({
      where: { paymentId },
      orderBy: { createdAt: 'desc' },
    });
  },
};

import prisma from '../utils/prisma';
import { PaymentStatus, SettlementStatus } from '../types';
import { BusinessError } from '../utils/response';
import { getSettlementById } from './settlement.service';
import dayjs from 'dayjs';

export interface CreatePaymentDTO {
  settlementNo: string;
  operator?: string;
}

export interface PaymentCallbackDTO {
  paymentNo: string;
  status: PaymentStatus;
  failReason?: string;
  operator?: string;
}

async function updatePaymentStatus(
  paymentId: string,
  newStatus: PaymentStatus,
  reason?: string,
  operator?: string
) {
  const payment = await prisma.paymentRecord.findUnique({
    where: { id: paymentId },
  });

  if (!payment) throw BusinessError.PAYMENT_NOT_FOUND;

  return prisma.$transaction(async (tx) => {
    const updated = await tx.paymentRecord.update({
      where: { id: paymentId },
      data: {
        status: newStatus,
        payTime: newStatus === PaymentStatus.SUCCESS ? new Date() : null,
        failReason: newStatus === PaymentStatus.FAILED ? reason : null,
      },
    });

    await tx.paymentStatusHistory.create({
      data: {
        paymentId,
        oldStatus: payment.status,
        newStatus,
        reason,
        operator,
      },
    });

    return updated;
  });
}

export async function createPayment(dto: CreatePaymentDTO) {
  const settlement = await getSettlementById(
    (await prisma.settlement.findUnique({
      where: { settlementNo: dto.settlementNo },
      select: { id: true },
    }))?.id || ''
  );

  if (!settlement) throw BusinessError.SETTLEMENT_NOT_FOUND;

  if ([SettlementStatus.PENDING, SettlementStatus.CANCELLED, SettlementStatus.FROZEN].includes(settlement.status)) {
    throw BusinessError.SETTLEMENT_INVALID_STATUS;
  }

  if (settlement.payments.some(p => p.status === PaymentStatus.SUCCESS)) {
    throw BusinessError.PAYMENT_ALREADY_SUCCESS;
  }

  if (settlement.payments.some(p => p.status === PaymentStatus.PROCESSING)) {
    throw BusinessError.PAYMENT_PROCESSING;
  }

  const paymentNo = `PAY${dayjs().format('YYYYMMDD')}${Date.now()}${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`;

  return prisma.$transaction(async (tx) => {
    const payment = await tx.paymentRecord.create({
      data: {
        paymentNo,
        settlementId: settlement.id,
        merchantId: settlement.merchantId,
        amount: Number(settlement.payableAmount),
        status: PaymentStatus.PENDING,
        bankAccount: settlement.merchant.bankAccount,
        bankName: settlement.merchant.bankName,
        operator: dto.operator,
      },
    });

    await tx.settlement.update({
      where: { id: settlement.id },
      data: { status: SettlementStatus.PAYING },
    });

    await tx.settlementStatusHistory.create({
      data: {
        settlementId: settlement.id,
        oldStatus: settlement.status,
        newStatus: SettlementStatus.PAYING,
        reason: '发起打款',
        operator: dto.operator,
      },
    });

    await tx.paymentStatusHistory.create({
      data: {
        paymentId: payment.id,
        oldStatus: PaymentStatus.PENDING,
        newStatus: PaymentStatus.PENDING,
        reason: '创建打款记录',
        operator: dto.operator,
      },
    });

    return payment;
  });
}

export async function processPayment(paymentNo: string, operator?: string) {
  const payment = await prisma.paymentRecord.findUnique({
    where: { paymentNo },
  });

  if (!payment) throw BusinessError.PAYMENT_NOT_FOUND;

  if (payment.status === PaymentStatus.SUCCESS) {
    throw BusinessError.PAYMENT_ALREADY_SUCCESS;
  }

  return updatePaymentStatus(
    payment.id,
    PaymentStatus.PROCESSING,
    '打款处理中',
    operator
  );
}

export async function confirmPaymentSuccess(paymentNo: string, operator?: string) {
  const payment = await prisma.paymentRecord.findUnique({
    where: { paymentNo },
    include: { settlement: true },
  });

  if (!payment) throw BusinessError.PAYMENT_NOT_FOUND;

  if (payment.status === PaymentStatus.SUCCESS) {
    throw BusinessError.PAYMENT_ALREADY_SUCCESS;
  }

  return prisma.$transaction(async (tx) => {
    const updatedPayment = await tx.paymentRecord.update({
      where: { id: payment.id },
      data: {
        status: PaymentStatus.SUCCESS,
        payTime: new Date(),
      },
    });

    await tx.paymentStatusHistory.create({
      data: {
        paymentId: payment.id,
        oldStatus: payment.status,
        newStatus: PaymentStatus.SUCCESS,
        reason: '打款成功',
        operator,
      },
    });

    await tx.settlement.update({
      where: { id: payment.settlementId },
      data: {
        status: SettlementStatus.PAID,
        actualPaidAmount: Number(payment.amount),
      },
    });

    await tx.settlementStatusHistory.create({
      data: {
        settlementId: payment.settlementId,
        oldStatus: payment.settlement.status,
        newStatus: SettlementStatus.PAID,
        reason: '打款成功',
        operator,
      },
    });

    return updatedPayment;
  });
}

export async function confirmPaymentFailed(paymentNo: string, failReason: string, operator?: string) {
  const payment = await prisma.paymentRecord.findUnique({
    where: { paymentNo },
    include: { settlement: true },
  });

  if (!payment) throw BusinessError.PAYMENT_NOT_FOUND;

  if (payment.status === PaymentStatus.SUCCESS) {
    throw BusinessError.PAYMENT_ALREADY_SUCCESS;
  }

  return prisma.$transaction(async (tx) => {
    const updatedPayment = await tx.paymentRecord.update({
      where: { id: payment.id },
      data: {
        status: PaymentStatus.FAILED,
        failReason,
      },
    });

    await tx.paymentStatusHistory.create({
      data: {
        paymentId: payment.id,
        oldStatus: payment.status,
        newStatus: PaymentStatus.FAILED,
        reason: failReason,
        operator,
      },
    });

    await tx.settlement.update({
      where: { id: payment.settlementId },
      data: {
        status: SettlementStatus.FAILED,
      },
    });

    await tx.settlementStatusHistory.create({
      data: {
        settlementId: payment.settlementId,
        oldStatus: payment.settlement.status,
        newStatus: SettlementStatus.FAILED,
        reason: `打款失败: ${failReason}`,
        operator,
      },
    });

    return updatedPayment;
  });
}

export async function retryPayment(paymentNo: string, operator?: string) {
  const payment = await prisma.paymentRecord.findUnique({
    where: { paymentNo },
    include: { settlement: true },
  });

  if (!payment) throw BusinessError.PAYMENT_NOT_FOUND;

  if (payment.status === PaymentStatus.SUCCESS) {
    throw BusinessError.PAYMENT_ALREADY_SUCCESS;
  }

  const newPaymentNo = `PAY${dayjs().format('YYYYMMDD')}${Date.now()}${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`;

  return prisma.$transaction(async (tx) => {
    const newPayment = await tx.paymentRecord.create({
      data: {
        paymentNo: newPaymentNo,
        settlementId: payment.settlementId,
        merchantId: payment.merchantId,
        amount: Number(payment.amount),
        status: PaymentStatus.PENDING,
        bankAccount: payment.bankAccount,
        bankName: payment.bankName,
        operator,
      },
    });

    await tx.settlement.update({
      where: { id: payment.settlementId },
      data: { status: SettlementStatus.PAYING },
    });

    await tx.settlementStatusHistory.create({
      data: {
        settlementId: payment.settlementId,
        oldStatus: payment.settlement.status,
        newStatus: SettlementStatus.PAYING,
        reason: '重新发起打款',
        operator,
      },
    });

    await tx.paymentStatusHistory.create({
      data: {
        paymentId: newPayment.id,
        oldStatus: PaymentStatus.PENDING,
        newStatus: PaymentStatus.PENDING,
        reason: '创建打款记录(重试)',
        operator,
      },
    });

    return newPayment;
  });
}

export async function getPaymentByNo(paymentNo: string) {
  const payment = await prisma.paymentRecord.findUnique({
    where: { paymentNo },
    include: {
      settlement: {
        include: {
          merchant: true,
        },
      },
      statusHistory: {
        orderBy: { createdAt: 'desc' },
      },
    },
  });

  if (!payment) throw BusinessError.PAYMENT_NOT_FOUND;
  return payment;
}

export async function listPayments(
  settlementNo?: string,
  status?: PaymentStatus,
  page: number = 1,
  pageSize: number = 20
) {
  const skip = (page - 1) * pageSize;

  const where: any = {};

  if (settlementNo) {
    const settlement = await prisma.settlement.findUnique({
      where: { settlementNo },
    });
    if (settlement) where.settlementId = settlement.id;
  }

  if (status) where.status = status;

  const [payments, total] = await Promise.all([
    prisma.paymentRecord.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: { createdAt: 'desc' },
      include: {
        settlement: {
          select: { settlementNo: true, period: true },
        },
        statusHistory: {
          orderBy: { createdAt: 'desc' },
          take: 3,
        },
      },
    }),
    prisma.paymentRecord.count({ where }),
  ]);

  return {
    payments,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    },
  };
}

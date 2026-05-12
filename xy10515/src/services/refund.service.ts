import prisma from '../utils/prisma';
import { RefundStatus, OrderStatus } from '../types';
import { BusinessError } from '../utils/response';
import dayjs from 'dayjs';

export interface CreateRefundDTO {
  orderNo: string;
  amount: number;
  refundFee?: number;
  reason?: string;
  applyTime: string;
  completeTime?: string;
}

export async function createRefund(dto: CreateRefundDTO) {
  const order = await prisma.order.findUnique({
    where: { orderNo: dto.orderNo },
    include: { refunds: true },
  });
  
  if (!order) throw BusinessError.ORDER_NOT_FOUND;

  const totalRefunded = order.refunds
    .filter(r => r.status === RefundStatus.COMPLETED)
    .reduce((sum, r) => sum + Number(r.amount), 0);

  if (totalRefunded + dto.amount > Number(order.amount)) {
    throw BusinessError.INVALID_PARAMETER('退款金额超过订单金额');
  }

  const refundNo = `R${dayjs(dto.applyTime).format('YYYYMMDD')}${Date.now()}${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`;

  const newRefunded = totalRefunded + dto.amount;
  const newOrderStatus = newRefunded >= Number(order.amount) 
    ? OrderStatus.REFUNDED 
    : OrderStatus.PARTIAL_REFUNDED;

  return prisma.$transaction(async (tx) => {
    const refund = await tx.refund.create({
      data: {
        refundNo,
        orderId: order.id,
        merchantId: order.merchantId,
        amount: dto.amount,
        refundFee: dto.refundFee || 0,
        reason: dto.reason,
        status: dto.completeTime ? RefundStatus.COMPLETED : RefundStatus.PENDING,
        applyTime: new Date(dto.applyTime),
        completeTime: dto.completeTime ? new Date(dto.completeTime) : null,
      },
    });

    await tx.order.update({
      where: { id: order.id },
      data: { status: newOrderStatus },
    });

    return refund;
  });
}

export async function getRefundById(id: string) {
  const refund = await prisma.refund.findUnique({
    where: { id },
    include: {
      order: true,
      merchant: true,
    },
  });
  
  if (!refund) throw BusinessError.REFUND_NOT_FOUND;
  return refund;
}

export async function getRefundByNo(refundNo: string) {
  const refund = await prisma.refund.findUnique({
    where: { refundNo },
    include: {
      order: true,
      merchant: true,
    },
  });
  
  if (!refund) throw BusinessError.REFUND_NOT_FOUND;
  return refund;
}

export async function listRefunds(
  merchantNo?: string,
  orderNo?: string,
  startDate?: string,
  endDate?: string,
  status?: RefundStatus,
  page: number = 1,
  pageSize: number = 20
) {
  const skip = (page - 1) * pageSize;
  
  const where: any = {};
  
  if (merchantNo) {
    const merchant = await prisma.merchant.findUnique({
      where: { merchantNo },
    });
    if (!merchant) throw BusinessError.MERCHANT_NOT_FOUND;
    where.merchantId = merchant.id;
  }
  
  if (orderNo) {
    const order = await prisma.order.findUnique({ where: { orderNo } });
    if (order) where.orderId = order.id;
  }
  
  if (startDate || endDate) {
    where.applyTime = {};
    if (startDate) where.applyTime.gte = new Date(startDate);
    if (endDate) where.applyTime.lte = new Date(endDate);
  }
  
  if (status) where.status = status;

  const [refunds, total] = await Promise.all([
    prisma.refund.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: { applyTime: 'desc' },
      include: {
        order: {
          select: { orderNo: true },
        },
        merchant: {
          select: { merchantNo: true, name: true },
        },
      },
    }),
    prisma.refund.count({ where }),
  ]);

  return {
    refunds,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    },
  };
}

export async function getUnsettledRefunds(
  merchantId: string,
  endDate: Date
) {
  const settlementItems = await prisma.settlementItem.findMany({
    where: {
      merchantId,
      itemType: 'REFUND',
    },
    select: { itemNo: true },
  });

  const settledRefundNos = settlementItems.map(item => item.itemNo);

  return prisma.refund.findMany({
    where: {
      merchantId,
      status: RefundStatus.COMPLETED,
      applyTime: {
        lte: endDate,
      },
      NOT: {
        refundNo: {
          in: settledRefundNos,
        },
      },
    },
    orderBy: { applyTime: 'asc' },
  });
}

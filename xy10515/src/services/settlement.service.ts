import prisma from '../utils/prisma';
import { SettlementStatus, SettlementItemType, PaymentStatus, AdjustmentType } from '../types';
import { BusinessError } from '../utils/response';
import { getUnsettledOrders } from './order.service';
import { getUnsettledRefunds } from './refund.service';
import { getUnsettledPenalties } from './penalty.service';
import * as NumberUtils from '../utils/number';
import dayjs from 'dayjs';

export interface CreateSettlementDTO {
  merchantNo: string;
  period: string;
  settlementDate: string;
  operator?: string;
}

export interface CalculateSettlementDTO {
  merchantNo: string;
  period: string;
  settlementDate: string;
}

export interface ConfirmSettlementDTO {
  operator?: string;
}

export interface FreezeSettlementDTO {
  reason: string;
  operator?: string;
}

export interface ManualAdjustmentDTO {
  adjustmentType: AdjustmentType;
  amount: number;
  reason: string;
  operator: string;
}

export interface SettleResult {
  settlement: any;
  items: any[];
  calculations: {
    orderAmount: number;
    refundAmount: number;
    serviceFee: number;
    penaltyAmount: number;
    previousCarryOver: number;
    totalAmount: number;
    frozenAmount: number;
    payableAmount: number;
    nextCarryOver: number;
  };
}

function getPeriodDates(period: string): { start: Date; end: Date } {
  const [year, month] = period.split('-').map(Number);
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 0, 23, 59, 59, 999);
  return { start, end };
}

async function getPreviousCarryOver(merchantId: string, currentPeriod: string): Promise<number> {
  const [year, month] = currentPeriod.split('-').map(Number);
  const prevMonth = month === 1 ? 12 : month - 1;
  const prevYear = month === 1 ? year - 1 : year;
  const prevPeriod = `${prevYear}-${String(prevMonth).padStart(2, '0')}`;

  const prevSettlement = await prisma.settlement.findFirst({
    where: {
      merchantId,
      period: prevPeriod,
    },
    select: { nextCarryOver: true },
  });

  return prevSettlement ? Number(prevSettlement.nextCarryOver) : 0;
}

export async function calculateSettlement(dto: CalculateSettlementDTO): Promise<SettleResult> {
  const merchant = await prisma.merchant.findUnique({
    where: { merchantNo: dto.merchantNo },
  });

  if (!merchant) throw BusinessError.MERCHANT_NOT_FOUND;

  const existing = await prisma.settlement.findUnique({
    where: {
      merchantId_period: {
        merchantId: merchant.id,
        period: dto.period,
      },
    },
  });

  if (existing && existing.status !== SettlementStatus.PENDING) {
    throw BusinessError.SETTLEMENT_ALREADY_EXISTS;
  }

  const { start, end } = getPeriodDates(dto.period);

  const [orders, refunds, penalties, previousCarryOver] = await Promise.all([
    getUnsettledOrders(merchant.id, start, end),
    getUnsettledRefunds(merchant.id, end),
    getUnsettledPenalties(merchant.id, end),
    getPreviousCarryOver(merchant.id, dto.period),
  ]);

  const orderAmount = orders.reduce((sum, o) => NumberUtils.add(sum, o.amount), 0);
  const refundAmount = refunds.reduce((sum, r) => NumberUtils.add(sum, r.amount), 0);
  const serviceFee = orders.reduce((sum, o) => NumberUtils.add(sum, Number(o.serviceFee) + Number(o.platformFee)), 0);
  const penaltyAmount = penalties.reduce((sum, p) => NumberUtils.add(sum, p.amount), 0);

  const totalAmount = NumberUtils.subtract(
    NumberUtils.add(orderAmount, previousCarryOver),
    NumberUtils.add(refundAmount, NumberUtils.add(serviceFee, penaltyAmount))
  );

  let frozenAmount = 0;
  if (totalAmount < 0) {
    frozenAmount = NumberUtils.abs(totalAmount);
  }

  let payableAmount = totalAmount;
  let nextCarryOver = 0;

  if (totalAmount < 0) {
    payableAmount = 0;
    nextCarryOver = totalAmount;
  }

  const items: any[] = [];

  orders.forEach(order => {
    items.push({
      itemType: SettlementItemType.ORDER,
      itemNo: order.orderNo,
      amount: order.amount,
      description: `订单收入`,
    });
    if (order.serviceFee || order.platformFee) {
      items.push({
        itemType: SettlementItemType.SERVICE_FEE,
        itemNo: order.orderNo,
        amount: NumberUtils.toDecimal(-(Number(order.serviceFee) + Number(order.platformFee))),
        description: `订单服务费 + 平台费`,
      });
    }
  });

  refunds.forEach(refund => {
    items.push({
      itemType: SettlementItemType.REFUND,
      itemNo: refund.refundNo,
      relatedNo: refund.orderId,
      amount: NumberUtils.toDecimal(-refund.amount),
      description: `退款扣除`,
    });
  });

  penalties.forEach(penalty => {
    items.push({
      itemType: SettlementItemType.PENALTY,
      itemNo: penalty.penaltyNo,
      amount: NumberUtils.toDecimal(-penalty.amount),
      description: `扣罚扣除: ${penalty.reason}`,
    });
  });

  if (previousCarryOver !== 0) {
    items.push({
      itemType: SettlementItemType.CARRY_OVER,
      itemNo: `CO-${dto.period}-PREV`,
      amount: previousCarryOver,
      description: previousCarryOver > 0 ? '上期结转金额' : '上期负结转金额',
    });
  }

  return {
    settlement: existing,
    items,
    calculations: {
      orderAmount,
      refundAmount,
      serviceFee,
      penaltyAmount,
      previousCarryOver,
      totalAmount,
      frozenAmount,
      payableAmount,
      nextCarryOver,
    },
  };
}

export async function createSettlement(dto: CreateSettlementDTO) {
  const merchant = await prisma.merchant.findUnique({
    where: { merchantNo: dto.merchantNo },
  });

  if (!merchant) throw BusinessError.MERCHANT_NOT_FOUND;

  const existing = await prisma.settlement.findUnique({
    where: {
      merchantId_period: {
        merchantId: merchant.id,
        period: dto.period,
      },
    },
  });

  if (existing) {
    if (existing.status === SettlementStatus.PENDING) {
      return existing;
    }
    throw BusinessError.SETTLEMENT_ALREADY_EXISTS;
  }

  const { start, end } = getPeriodDates(dto.period);

  const result = await calculateSettlement(dto);

  const settlementNo = `S${dayjs(dto.settlementDate).format('YYYYMMDD')}${Date.now()}${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`;

  return prisma.$transaction(async (tx) => {
    const settlement = await tx.settlement.create({
      data: {
        settlementNo,
        merchantId: merchant.id,
        period: dto.period,
        settlementDate: new Date(dto.settlementDate),
        status: SettlementStatus.PENDING,
        orderAmount: result.calculations.orderAmount,
        refundAmount: result.calculations.refundAmount,
        serviceFee: result.calculations.serviceFee,
        penaltyAmount: result.calculations.penaltyAmount,
        previousCarryOver: result.calculations.previousCarryOver,
        totalAmount: result.calculations.totalAmount,
        frozenAmount: result.calculations.frozenAmount,
        payableAmount: result.calculations.payableAmount,
        nextCarryOver: result.calculations.nextCarryOver,
        operator: dto.operator,
      },
    });

    for (const item of result.items) {
      await tx.settlementItem.create({
        data: {
          settlementId: settlement.id,
          merchantId: merchant.id,
          itemType: item.itemType,
          itemNo: item.itemNo,
          relatedNo: item.relatedNo,
          amount: item.amount,
          description: item.description,
        },
      });
    }

    await tx.settlementStatusHistory.create({
      data: {
        settlementId: settlement.id,
        oldStatus: SettlementStatus.PENDING,
        newStatus: SettlementStatus.PENDING,
        reason: '创建结算单',
        operator: dto.operator,
      },
    });

    return settlement;
  });
}

export async function recalculateSettlement(settlementId: string, operator?: string) {
  const settlement = await getSettlementById(settlementId);

  if (settlement.status !== SettlementStatus.PENDING) {
    throw BusinessError.SETTLEMENT_INVALID_STATUS;
  }

  const result = await calculateSettlement({
    merchantNo: settlement.merchant.merchantNo,
    period: settlement.period,
    settlementDate: settlement.settlementDate.toISOString(),
  });

  return prisma.$transaction(async (tx) => {
    await tx.settlementItem.deleteMany({
      where: { settlementId },
    });

    const updated = await tx.settlement.update({
      where: { id: settlementId },
      data: {
        orderAmount: result.calculations.orderAmount,
        refundAmount: result.calculations.refundAmount,
        serviceFee: result.calculations.serviceFee,
        penaltyAmount: result.calculations.penaltyAmount,
        previousCarryOver: result.calculations.previousCarryOver,
        totalAmount: result.calculations.totalAmount,
        frozenAmount: result.calculations.frozenAmount,
        payableAmount: result.calculations.payableAmount,
        nextCarryOver: result.calculations.nextCarryOver,
      },
    });

    for (const item of result.items) {
      await tx.settlementItem.create({
        data: {
          settlementId,
          merchantId: settlement.merchantId,
          itemType: item.itemType,
          itemNo: item.itemNo,
          relatedNo: item.relatedNo,
          amount: item.amount,
          description: item.description,
        },
      });
    }

    return updated;
  });
}

export async function getSettlementById(id: string) {
  const settlement = await prisma.settlement.findUnique({
    where: { id },
    include: {
      merchant: true,
      items: {
        orderBy: { createdAt: 'asc' },
      },
      payments: true,
      statusHistory: {
        orderBy: { createdAt: 'desc' },
      },
      manualAdjustments: true,
    },
  });

  if (!settlement) throw BusinessError.SETTLEMENT_NOT_FOUND;
  return settlement;
}

export async function getSettlementByNo(settlementNo: string) {
  const settlement = await prisma.settlement.findUnique({
    where: { settlementNo },
    include: {
      merchant: true,
      items: {
        orderBy: { createdAt: 'asc' },
      },
      payments: true,
      statusHistory: {
        orderBy: { createdAt: 'desc' },
      },
      manualAdjustments: true,
    },
  });

  if (!settlement) throw BusinessError.SETTLEMENT_NOT_FOUND;
  return settlement;
}

export async function listSettlements(
  merchantNo?: string,
  period?: string,
  status?: SettlementStatus,
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

  if (period) where.period = period;
  if (status) where.status = status;

  const [settlements, total] = await Promise.all([
    prisma.settlement.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: { settlementDate: 'desc' },
      include: {
        merchant: {
          select: { merchantNo: true, name: true },
        },
        payments: {
          select: { paymentNo: true, status: true, amount: true },
        },
      },
    }),
    prisma.settlement.count({ where }),
  ]);

  return {
    settlements,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    },
  };
}

async function updateSettlementStatus(
  settlementId: string,
  newStatus: SettlementStatus,
  reason: string,
  operator?: string
) {
  const settlement = await getSettlementById(settlementId);

  return prisma.$transaction(async (tx) => {
    const updated = await tx.settlement.update({
      where: { id: settlementId },
      data: { status: newStatus },
    });

    await tx.settlementStatusHistory.create({
      data: {
        settlementId,
        oldStatus: settlement.status,
        newStatus,
        reason,
        operator,
      },
    });

    return updated;
  });
}

export async function confirmSettlement(settlementId: string, dto: ConfirmSettlementDTO) {
  const settlement = await getSettlementById(settlementId);

  if (settlement.status !== SettlementStatus.PENDING && settlement.status !== SettlementStatus.CALCULATED) {
    throw BusinessError.SETTLEMENT_INVALID_STATUS;
  }

  return updateSettlementStatus(
    settlementId,
    SettlementStatus.CONFIRMED,
    '确认结算',
    dto.operator
  );
}

export async function freezeSettlement(settlementId: string, dto: FreezeSettlementDTO) {
  const settlement = await getSettlementById(settlementId);

  if (settlement.status === SettlementStatus.PAID || settlement.status === SettlementStatus.CANCELLED) {
    throw BusinessError.SETTLEMENT_INVALID_STATUS;
  }

  return updateSettlementStatus(
    settlementId,
    SettlementStatus.FROZEN,
    dto.reason,
    dto.operator
  );
}

export async function unfreezeSettlement(settlementId: string, reason: string, operator?: string) {
  const settlement = await getSettlementById(settlementId);

  if (settlement.status !== SettlementStatus.FROZEN) {
    throw BusinessError.SETTLEMENT_INVALID_STATUS;
  }

  return updateSettlementStatus(
    settlementId,
    SettlementStatus.CONFIRMED,
    reason,
    operator
  );
}

export async function manualAdjustment(settlementId: string, dto: ManualAdjustmentDTO) {
  const settlement = await getSettlementById(settlementId);

  if (settlement.status === SettlementStatus.PAID || settlement.status === SettlementStatus.CANCELLED) {
    throw BusinessError.MANUAL_ADJUSTMENT_NOT_ALLOWED;
  }

  const adjustmentAmount = dto.adjustmentType === AdjustmentType.INCREASE 
    ? NumberUtils.abs(dto.amount) 
    : NumberUtils.toDecimal(-dto.amount);

  const newTotal = NumberUtils.add(settlement.totalAmount, adjustmentAmount);
  const newPayable = newTotal > 0 ? newTotal : 0;
  const newNextCarryOver = newTotal < 0 ? newTotal : 0;

  const adjustmentNo = `MA${dayjs().format('YYYYMMDD')}${Date.now()}`;

  return prisma.$transaction(async (tx) => {
    const adjustment = await tx.manualAdjustment.create({
      data: {
        adjustmentNo,
        settlementId,
        merchantId: settlement.merchantId,
        adjustmentType: dto.adjustmentType,
        amount: dto.amount,
        reason: dto.reason,
        beforeAmount: Number(settlement.totalAmount),
        afterAmount: newTotal,
        operator: dto.operator,
      },
    });

    await tx.settlementItem.create({
      data: {
        settlementId,
        merchantId: settlement.merchantId,
        itemType: SettlementItemType.MANUAL_ADJUSTMENT,
        itemNo: adjustmentNo,
        amount: adjustmentAmount,
        description: `人工调整: ${dto.reason}`,
      },
    });

    const updated = await tx.settlement.update({
      where: { id: settlementId },
      data: {
        status: SettlementStatus.MANUAL_ADJUSTED,
        totalAmount: newTotal,
        payableAmount: newPayable,
        nextCarryOver: newNextCarryOver,
      },
    });

    await tx.settlementStatusHistory.create({
      data: {
        settlementId,
        oldStatus: settlement.status,
        newStatus: SettlementStatus.MANUAL_ADJUSTED,
        reason: `人工调整: ${dto.reason}`,
        operator: dto.operator,
      },
    });

    return { adjustment, updatedSettlement: updated };
  });
}

export async function cancelSettlement(settlementId: string, reason: string, operator?: string) {
  const settlement = await getSettlementById(settlementId);

  if ([SettlementStatus.PAID, SettlementStatus.CANCELLED].includes(settlement.status)) {
    throw BusinessError.SETTLEMENT_INVALID_STATUS;
  }

  return updateSettlementStatus(
    settlementId,
    SettlementStatus.CANCELLED,
    reason,
    operator
  );
}

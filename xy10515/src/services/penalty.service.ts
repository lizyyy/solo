import prisma from '../utils/prisma';
import { PenaltyStatus, PenaltyType, AppealStatus } from '../types';
import { BusinessError } from '../utils/response';
import dayjs from 'dayjs';

export interface CreatePenaltyDTO {
  merchantNo: string;
  orderNo?: string;
  amount: number;
  type: PenaltyType;
  reason: string;
  applyTime: string;
}

export interface UpdatePenaltyStatusDTO {
  status: PenaltyStatus;
  reason?: string;
  operator?: string;
}

export async function createPenalty(dto: CreatePenaltyDTO) {
  const merchant = await prisma.merchant.findUnique({
    where: { merchantNo: dto.merchantNo },
  });
  
  if (!merchant) throw BusinessError.MERCHANT_NOT_FOUND;

  let orderId: string | undefined;
  if (dto.orderNo) {
    const order = await prisma.order.findUnique({ where: { orderNo: dto.orderNo } });
    if (!order) throw BusinessError.ORDER_NOT_FOUND;
    orderId = order.id;
  }

  const penaltyNo = `P${dayjs(dto.applyTime).format('YYYYMMDD')}${Date.now()}${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`;

  return prisma.$transaction(async (tx) => {
    const penalty = await tx.penalty.create({
      data: {
        penaltyNo,
        merchantId: merchant.id,
        orderId,
        amount: dto.amount,
        type: dto.type,
        reason: dto.reason,
        status: PenaltyStatus.PENDING,
        applyTime: new Date(dto.applyTime),
      },
    });

    await tx.penaltyStatusHistory.create({
      data: {
        penaltyId: penalty.id,
        oldStatus: PenaltyStatus.PENDING,
        newStatus: PenaltyStatus.PENDING,
        reason: '创建扣罚',
      },
    });

    return penalty;
  });
}

export async function getPenaltyById(id: string) {
  const penalty = await prisma.penalty.findUnique({
    where: { id },
    include: {
      merchant: true,
      order: true,
      appeal: true,
      statusHistory: {
        orderBy: { createdAt: 'desc' },
      },
    },
  });
  
  if (!penalty) throw BusinessError.PENALTY_NOT_FOUND;
  return penalty;
}

export async function getPenaltyByNo(penaltyNo: string) {
  const penalty = await prisma.penalty.findUnique({
    where: { penaltyNo },
    include: {
      merchant: true,
      order: true,
      appeal: true,
      statusHistory: {
        orderBy: { createdAt: 'desc' },
      },
    },
  });
  
  if (!penalty) throw BusinessError.PENALTY_NOT_FOUND;
  return penalty;
}

export async function updatePenaltyStatus(id: string, dto: UpdatePenaltyStatusDTO) {
  const penalty = await getPenaltyById(id);

  if (penalty.status === dto.status) return penalty;

  return prisma.$transaction(async (tx) => {
    const updated = await tx.penalty.update({
      where: { id },
      data: {
        status: dto.status,
        effectiveTime: dto.status === PenaltyStatus.CONFIRMED ? new Date() : null,
      },
    });

    await tx.penaltyStatusHistory.create({
      data: {
        penaltyId: id,
        oldStatus: penalty.status,
        newStatus: dto.status,
        reason: dto.reason,
        operator: dto.operator,
      },
    });

    return updated;
  });
}

export async function listPenalties(
  merchantNo?: string,
  startDate?: string,
  endDate?: string,
  status?: PenaltyStatus,
  type?: PenaltyType,
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
  
  if (startDate || endDate) {
    where.applyTime = {};
    if (startDate) where.applyTime.gte = new Date(startDate);
    if (endDate) where.applyTime.lte = new Date(endDate);
  }
  
  if (status) where.status = status;
  if (type) where.type = type;

  const [penalties, total] = await Promise.all([
    prisma.penalty.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: { applyTime: 'desc' },
      include: {
        merchant: {
          select: { merchantNo: true, name: true },
        },
        order: {
          select: { orderNo: true },
        },
        appeal: true,
        statusHistory: {
          orderBy: { createdAt: 'desc' },
          take: 5,
        },
      },
    }),
    prisma.penalty.count({ where }),
  ]);

  return {
    penalties,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    },
  };
}

export async function getUnsettledPenalties(
  merchantId: string,
  endDate: Date
) {
  const settlementItems = await prisma.settlementItem.findMany({
    where: {
      merchantId,
      itemType: 'PENALTY',
    },
    select: { itemNo: true },
  });

  const settledPenaltyNos = settlementItems.map(item => item.itemNo);

  const pendingAppeals = await prisma.appeal.findMany({
    where: {
      merchantId,
      status: {
        in: [AppealStatus.PENDING, AppealStatus.REVIEWING, AppealStatus.APPROVED],
      },
    },
    select: { penaltyId: true },
  });

  const appealingPenaltyIds = pendingAppeals.map(a => a.penaltyId);

  return prisma.penalty.findMany({
    where: {
      merchantId,
      status: PenaltyStatus.CONFIRMED,
      applyTime: {
        lte: endDate,
      },
      NOT: {
        penaltyNo: {
          in: settledPenaltyNos,
        },
        id: {
          in: appealingPenaltyIds,
        },
      },
    },
    orderBy: { applyTime: 'asc' },
  });
}

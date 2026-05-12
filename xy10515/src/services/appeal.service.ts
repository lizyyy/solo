import prisma from '../utils/prisma';
import { AppealStatus, PenaltyStatus } from '../types';
import { BusinessError } from '../utils/response';
import dayjs from 'dayjs';

export interface CreateAppealDTO {
  penaltyNo: string;
  merchantNo: string;
  reason: string;
  evidence?: string;
  applyTime: string;
}

export interface ReviewAppealDTO {
  status: AppealStatus;
  reviewResult: string;
  operator: string;
}

export async function createAppeal(dto: CreateAppealDTO) {
  const [penalty, merchant] = await Promise.all([
    prisma.penalty.findUnique({ where: { penaltyNo: dto.penaltyNo } }),
    prisma.merchant.findUnique({ where: { merchantNo: dto.merchantNo } }),
  ]);
  
  if (!penalty) throw BusinessError.PENALTY_NOT_FOUND;
  if (!merchant) throw BusinessError.MERCHANT_NOT_FOUND;
  if (penalty.merchantId !== merchant.id) {
    throw BusinessError.INVALID_PARAMETER('扣罚不属于该商户');
  }

  const existingAppeal = await prisma.appeal.findUnique({
    where: { penaltyId: penalty.id },
  });
  if (existingAppeal) {
    throw BusinessError.INVALID_PARAMETER('该扣罚已有申诉');
  }

  const appealNo = `A${dayjs(dto.applyTime).format('YYYYMMDD')}${Date.now()}${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`;

  return prisma.$transaction(async (tx) => {
    const appeal = await tx.appeal.create({
      data: {
        appealNo,
        penaltyId: penalty.id,
        merchantId: merchant.id,
        reason: dto.reason,
        evidence: dto.evidence,
        status: AppealStatus.PENDING,
        applyTime: new Date(dto.applyTime),
      },
    });

    await tx.penalty.update({
      where: { id: penalty.id },
      data: { status: PenaltyStatus.APPEALING },
    });

    await tx.penaltyStatusHistory.create({
      data: {
        penaltyId: penalty.id,
        oldStatus: penalty.status,
        newStatus: PenaltyStatus.APPEALING,
        reason: '商户提起申诉',
      },
    });

    await tx.appealStatusHistory.create({
      data: {
        appealId: appeal.id,
        oldStatus: AppealStatus.PENDING,
        newStatus: AppealStatus.PENDING,
        reason: '创建申诉',
      },
    });

    return appeal;
  });
}

export async function getAppealById(id: string) {
  const appeal = await prisma.appeal.findUnique({
    where: { id },
    include: {
      merchant: true,
      penalty: true,
      statusHistory: {
        orderBy: { createdAt: 'desc' },
      },
    },
  });
  
  if (!appeal) throw BusinessError.APPEAL_NOT_FOUND;
  return appeal;
}

export async function getAppealByNo(appealNo: string) {
  const appeal = await prisma.appeal.findUnique({
    where: { appealNo },
    include: {
      merchant: true,
      penalty: true,
      statusHistory: {
        orderBy: { createdAt: 'desc' },
      },
    },
  });
  
  if (!appeal) throw BusinessError.APPEAL_NOT_FOUND;
  return appeal;
}

export async function reviewAppeal(id: string, dto: ReviewAppealDTO) {
  const appeal = await getAppealById(id);

  if ([AppealStatus.APPROVED, AppealStatus.REJECTED, AppealStatus.CLOSED].includes(appeal.status)) {
    throw BusinessError.APPEAL_ALREADY_REVIEWED;
  }

  return prisma.$transaction(async (tx) => {
    const updatedAppeal = await tx.appeal.update({
      where: { id },
      data: {
        status: dto.status,
        reviewResult: dto.reviewResult,
        reviewTime: new Date(),
        operator: dto.operator,
      },
    });

    let newPenaltyStatus: PenaltyStatus;
    let penaltyReason: string;

    if (dto.status === AppealStatus.APPROVED) {
      newPenaltyStatus = PenaltyStatus.CANCELLED;
      penaltyReason = '申诉通过，扣罚取消';
    } else if (dto.status === AppealStatus.REJECTED) {
      newPenaltyStatus = PenaltyStatus.CONFIRMED;
      penaltyReason = '申诉驳回，扣罚生效';
    } else {
      newPenaltyStatus = PenaltyStatus.SUSPENDED;
      penaltyReason = '申诉关闭';
    }

    await tx.penalty.update({
      where: { id: appeal.penaltyId },
      data: {
        status: newPenaltyStatus,
        effectiveTime: dto.status === AppealStatus.REJECTED ? new Date() : null,
      },
    });

    await tx.penaltyStatusHistory.create({
      data: {
        penaltyId: appeal.penaltyId,
        oldStatus: PenaltyStatus.APPEALING,
        newStatus: newPenaltyStatus,
        reason: penaltyReason,
        operator: dto.operator,
      },
    });

    await tx.appealStatusHistory.create({
      data: {
        appealId: id,
        oldStatus: appeal.status,
        newStatus: dto.status,
        reason: dto.reviewResult,
        operator: dto.operator,
      },
    });

    return updatedAppeal;
  });
}

export async function listAppeals(
  merchantNo?: string,
  startDate?: string,
  endDate?: string,
  status?: AppealStatus,
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

  const [appeals, total] = await Promise.all([
    prisma.appeal.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: { applyTime: 'desc' },
      include: {
        merchant: {
          select: { merchantNo: true, name: true },
        },
        penalty: {
          select: { penaltyNo: true, amount: true, reason: true },
        },
        statusHistory: {
          orderBy: { createdAt: 'desc' },
          take: 5,
        },
      },
    }),
    prisma.appeal.count({ where }),
  ]);

  return {
    appeals,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    },
  };
}

import { prisma } from '../config/database';
import { createAuditLog } from './auditService';
import { DiscardRecord, DiscardReason, ReagentStatus } from '@prisma/client';

interface CreateDiscardParams {
  batchId: string;
  reason: DiscardReason;
  details?: string;
  discardedQty: number;
  createdBy: string;
}

export const createDiscard = async (params: CreateDiscardParams): Promise<DiscardRecord> => {
  const batch = await prisma.reagentBatch.findUnique({
    where: { id: params.batchId },
  });

  if (!batch) {
    throw new Error('试剂批号不存在');
  }

  if (params.discardedQty > batch.currentQty) {
    throw new Error('废弃数量不能大于当前库存');
  }

  if (params.discardedQty <= 0) {
    throw new Error('废弃数量必须大于0');
  }

  const discardRecord = await prisma.$transaction(async (tx) => {
    const record = await tx.discardRecord.create({
      data: {
        batchId: params.batchId,
        reason: params.reason,
        details: params.details,
        discardedQty: params.discardedQty,
        createdById: params.createdBy,
      },
    });

    const newQty = batch.currentQty - params.discardedQty;
    const updateData: any = { currentQty: newQty };

    if (newQty <= 0 || params.reason === DiscardReason.EXPIRED) {
      updateData.status = ReagentStatus.DISCARDED;
    }

    await tx.reagentBatch.update({
      where: { id: params.batchId },
      data: updateData,
    });

    return record;
  });

  await createAuditLog({
    action: 'CREATE_DISCARD',
    entityType: 'DISCARD',
    entityId: discardRecord.id,
    userId: params.createdBy,
    newValues: discardRecord,
  });

  await createAuditLog({
    action: 'UPDATE_BATCH_QTY',
    entityType: 'BATCH',
    entityId: params.batchId,
    userId: params.createdBy,
    oldValues: { currentQty: batch.currentQty, status: batch.status },
    newValues: {
      currentQty: batch.currentQty - params.discardedQty,
      status: (batch.currentQty - params.discardedQty <= 0 || params.reason === DiscardReason.EXPIRED)
        ? ReagentStatus.DISCARDED
        : batch.status,
    },
  });

  return discardRecord;
};

export const getDiscardRecords = async (params: {
  page?: number;
  limit?: number;
  batchId?: string;
  reason?: DiscardReason;
  startDate?: string;
  endDate?: string;
}) => {
  const { page = 1, limit = 50, batchId, reason, startDate, endDate } = params;

  const where: any = {};
  if (batchId) where.batchId = batchId;
  if (reason) where.reason = reason;

  if (startDate || endDate) {
    where.discardedAt = {};
    if (startDate) where.discardedAt.gte = new Date(startDate);
    if (endDate) where.discardedAt.lte = new Date(endDate);
  }

  const [records, total] = await Promise.all([
    prisma.discardRecord.findMany({
      where,
      include: {
        batch: {
          include: {
            reagent: true,
          },
        },
        createdBy: {
          select: {
            id: true,
            username: true,
            name: true,
          },
        },
      },
      orderBy: { discardedAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.discardRecord.count({ where }),
  ]);

  return {
    records,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
};

export const getDiscardStatistics = async (params: {
  startDate?: string;
  endDate?: string;
  reagentId?: string;
}) => {
  const { startDate, endDate, reagentId } = params;

  const where: any = {};

  if (startDate || endDate) {
    where.discardedAt = {};
    if (startDate) where.discardedAt.gte = new Date(startDate);
    if (endDate) where.discardedAt.lte = new Date(endDate);
  }

  if (reagentId) {
    where.batch = {
      reagentId,
    };
  }

  const discards = await prisma.discardRecord.findMany({
    where,
    include: {
      batch: {
        include: {
          reagent: true,
        },
      },
    },
  });

  const stats = {
    totalRecords: discards.length,
    totalQty: discards.reduce((sum, d) => sum + d.discardedQty, 0),
    byReason: {} as Record<string, { count: number; qty: number }>,
    byReagent: {} as Record<string, { name: string; count: number; qty: number }>,
  };

  discards.forEach((d) => {
    if (!stats.byReason[d.reason]) {
      stats.byReason[d.reason] = { count: 0, qty: 0 };
    }
    stats.byReason[d.reason].count++;
    stats.byReason[d.reason].qty += d.discardedQty;

    const reagentName = d.batch.reagent.name;
    if (!stats.byReagent[d.batch.reagentId]) {
      stats.byReagent[d.batch.reagentId] = { name: reagentName, count: 0, qty: 0 };
    }
    stats.byReagent[d.batch.reagentId].count++;
    stats.byReagent[d.batch.reagentId].qty += d.discardedQty;
  });

  return stats;
};

export const getDiscardById = async (id: string) => {
  return prisma.discardRecord.findUnique({
    where: { id },
    include: {
      batch: {
        include: {
          reagent: true,
        },
      },
      createdBy: {
        select: {
          id: true,
          username: true,
          name: true,
        },
      },
    },
  });
};

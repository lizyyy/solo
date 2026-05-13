import { prisma } from '../config/database';
import { createAuditLog } from './auditService';
import { OpenRecord, ReagentStatus, BlockReason } from '@prisma/client';

interface CreateOpenRecordParams {
  batchId: string;
  openDate: Date;
  notes?: string;
  createdBy: string;
}

export const createOpenRecord = async (params: CreateOpenRecordParams): Promise<OpenRecord> => {
  const batch = await prisma.reagentBatch.findUnique({
    where: { id: params.batchId },
    include: { reagent: true },
  });

  if (!batch) {
    throw new Error('试剂批号不存在');
  }

  const openDate = new Date(params.openDate);
  const now = new Date();

  if (openDate > now) {
    throw new Error('开封日期不能晚于当前日期');
  }

  if (openDate < new Date(batch.productionDate)) {
    throw new Error('开封日期不能早于生产日期');
  }

  const existingOpenRecord = await prisma.openRecord.findFirst({
    where: {
      batchId: params.batchId,
      isOpened: true,
    },
  });

  if (existingOpenRecord) {
    throw new Error('该批号已有未关闭的开封记录');
  }

  const defaultExpiryDays = batch.reagent.defaultExpiryDays || 30;
  const expectedExpiry = new Date(openDate);
  expectedExpiry.setDate(expectedExpiry.getDate() + defaultExpiryDays);

  const minExpiry = new Date(openDate);
  minExpiry.setDate(minExpiry.getDate() + 1);

  if (expectedExpiry > new Date(batch.expiryDate)) {
    throw new Error(`开封后期效日期(${expectedExpiry.toISOString().split('T')[0]})不能晚于批号有效期(${batch.expiryDate.toISOString().split('T')[0]})`);
  }

  const openRecord = await prisma.openRecord.create({
    data: {
      batchId: params.batchId,
      openDate: openDate,
      expectedExpiry: expectedExpiry,
      notes: params.notes,
      createdById: params.createdBy,
    },
  });

  await prisma.reagentBatch.update({
    where: { id: params.batchId },
    data: { status: ReagentStatus.ACTIVE },
  });

  await createAuditLog({
    action: 'CREATE_OPEN_RECORD',
    entityType: 'OPEN_RECORD',
    entityId: openRecord.id,
    userId: params.createdBy,
    newValues: openRecord,
  });

  await createAuditLog({
    action: 'UPDATE_BATCH_STATUS',
    entityType: 'BATCH',
    entityId: params.batchId,
    userId: params.createdBy,
    oldValues: { status: batch.status },
    newValues: { status: ReagentStatus.ACTIVE },
  });

  return openRecord;
};

export const updateOpenRecord = async (
  id: string,
  updates: { openDate?: Date; notes?: string },
  userId: string
) => {
  const oldOpenRecord = await prisma.openRecord.findUnique({
    where: { id },
    include: { batch: { include: { reagent: true } } },
  });

  if (!oldOpenRecord) {
    throw new Error('开封记录不存在');
  }

  if (updates.openDate) {
    const openDate = new Date(updates.openDate);
    const now = new Date();

    if (openDate > now) {
      throw new Error('开封日期不能晚于当前日期');
    }

    if (openDate < new Date(oldOpenRecord.batch.productionDate)) {
      throw new Error('开封日期不能早于生产日期');
    }

    const defaultExpiryDays = oldOpenRecord.batch.reagent.defaultExpiryDays || 30;
    const expectedExpiry = new Date(openDate);
    expectedExpiry.setDate(expectedExpiry.getDate() + defaultExpiryDays);

    if (expectedExpiry > new Date(oldOpenRecord.batch.expiryDate)) {
      throw new Error('开封后期效日期不能晚于批号有效期');
    }

    (updates as any).expectedExpiry = expectedExpiry;
  }

  const openRecord = await prisma.openRecord.update({
    where: { id },
    data: updates,
  });

  await createAuditLog({
    action: 'UPDATE_OPEN_RECORD',
    entityType: 'OPEN_RECORD',
    entityId: id,
    userId,
    oldValues: oldOpenRecord,
    newValues: openRecord,
  });

  return openRecord;
};

export const closeOpenRecord = async (id: string, userId: string) => {
  const oldOpenRecord = await prisma.openRecord.findUnique({
    where: { id },
  });

  if (!oldOpenRecord) {
    throw new Error('开封记录不存在');
  }

  if (!oldOpenRecord.isOpened) {
    throw new Error('该开封记录已关闭');
  }

  const openRecord = await prisma.openRecord.update({
    where: { id },
    data: {
      isOpened: false,
      actualExpiry: new Date(),
    },
  });

  await createAuditLog({
    action: 'CLOSE_OPEN_RECORD',
    entityType: 'OPEN_RECORD',
    entityId: id,
    userId,
    oldValues: oldOpenRecord,
    newValues: openRecord,
  });

  return openRecord;
};

export const getOpenRecords = async (params: {
  page?: number;
  limit?: number;
  batchId?: string;
  isOpened?: boolean;
}) => {
  const { page = 1, limit = 50, batchId, isOpened } = params;

  const where: any = {};
  if (batchId) where.batchId = batchId;
  if (typeof isOpened === 'boolean') where.isOpened = isOpened;

  const [records, total] = await Promise.all([
    prisma.openRecord.findMany({
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
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.openRecord.count({ where }),
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

export const getOpenRecordById = async (id: string) => {
  return prisma.openRecord.findUnique({
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
      experiments: true,
      blockRecords: true,
      reviewRecords: {
        include: {
          reviewer: {
            select: {
              id: true,
              username: true,
              name: true,
            },
          },
        },
      },
    },
  });
};

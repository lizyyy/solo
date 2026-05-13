import { prisma } from '../config/database';
import { createAuditLog } from './auditService';
import { Reagent, ReagentBatch, ReagentStatus } from '@prisma/client';

interface CreateReagentParams {
  name: string;
  code: string;
  description?: string;
  defaultExpiryDays?: number;
  nearExpiryDays?: number;
  createdBy: string;
}

interface UpdateReagentParams {
  name?: string;
  description?: string;
  defaultExpiryDays?: number;
  nearExpiryDays?: number;
  isActive?: boolean;
}

export const createReagent = async (params: CreateReagentParams): Promise<Reagent> => {
  const reagent = await prisma.reagent.create({
    data: {
      name: params.name,
      code: params.code,
      description: params.description,
      defaultExpiryDays: params.defaultExpiryDays || 30,
      nearExpiryDays: params.nearExpiryDays || 7,
    },
  });

  await createAuditLog({
    action: 'CREATE_REAGENT',
    entityType: 'REAGENT',
    entityId: reagent.id,
    userId: params.createdBy,
    newValues: reagent,
  });

  return reagent;
};

export const updateReagent = async (
  id: string,
  params: UpdateReagentParams,
  userId: string
): Promise<Reagent> => {
  const oldReagent = await prisma.reagent.findUnique({ where: { id } });
  
  const reagent = await prisma.reagent.update({
    where: { id },
    data: params,
  });

  await createAuditLog({
    action: 'UPDATE_REAGENT',
    entityType: 'REAGENT',
    entityId: id,
    userId,
    oldValues: oldReagent,
    newValues: reagent,
  });

  return reagent;
};

export const getReagents = async (params: {
  page?: number;
  limit?: number;
  isActive?: boolean;
  search?: string;
}) => {
  const { page = 1, limit = 50, isActive, search } = params;

  const where: any = {};
  if (typeof isActive === 'boolean') where.isActive = isActive;
  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { code: { contains: search, mode: 'insensitive' } },
    ];
  }

  const [reagents, total] = await Promise.all([
    prisma.reagent.findMany({
      where,
      include: {
        batches: {
          select: {
            id: true,
            batchNumber: true,
            status: true,
          },
          orderBy: { createdAt: 'desc' },
          take: 5,
        },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.reagent.count({ where }),
  ]);

  return {
    reagents,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
};

export const getReagentById = async (id: string) => {
  return prisma.reagent.findUnique({
    where: { id },
    include: {
      batches: {
        orderBy: { createdAt: 'desc' },
      },
    },
  });
};

interface CreateBatchParams {
  reagentId: string;
  batchNumber: string;
  productionDate: Date;
  expiryDate: Date;
  originalQty: number;
  unit: string;
  createdBy: string;
}

export const createBatch = async (params: CreateBatchParams): Promise<ReagentBatch> => {
  const existingBatch = await prisma.reagentBatch.findUnique({
    where: {
      reagentId_batchNumber: {
        reagentId: params.reagentId,
        batchNumber: params.batchNumber,
      },
    },
  });

  if (existingBatch) {
    throw new Error('该试剂已有相同批号');
  }

  if (new Date(params.productionDate) >= new Date(params.expiryDate)) {
    throw new Error('生产日期必须早于有效期');
  }

  const batch = await prisma.reagentBatch.create({
    data: {
      reagentId: params.reagentId,
      batchNumber: params.batchNumber,
      productionDate: new Date(params.productionDate),
      expiryDate: new Date(params.expiryDate),
      originalQty: params.originalQty,
      currentQty: params.originalQty,
      unit: params.unit,
      status: ReagentStatus.PENDING,
      createdById: params.createdBy,
    },
  });

  await createAuditLog({
    action: 'CREATE_BATCH',
    entityType: 'BATCH',
    entityId: batch.id,
    userId: params.createdBy,
    newValues: batch,
  });

  return batch;
};

export const getBatches = async (params: {
  page?: number;
  limit?: number;
  reagentId?: string;
  status?: ReagentStatus;
  search?: string;
}) => {
  const { page = 1, limit = 50, reagentId, status, search } = params;

  const where: any = {};
  if (reagentId) where.reagentId = reagentId;
  if (status) where.status = status;
  if (search) {
    where.OR = [
      { batchNumber: { contains: search, mode: 'insensitive' } },
      { reagent: { name: { contains: search, mode: 'insensitive' } } },
    ];
  }

  const [batches, total] = await Promise.all([
    prisma.reagentBatch.findMany({
      where,
      include: {
        reagent: true,
        createdBy: {
          select: {
            id: true,
            username: true,
            name: true,
          },
        },
        openRecords: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.reagentBatch.count({ where }),
  ]);

  return {
    batches,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
};

export const getBatchById = async (id: string) => {
  return prisma.reagentBatch.findUnique({
    where: { id },
    include: {
      reagent: true,
      createdBy: {
        select: {
          id: true,
          username: true,
          name: true,
        },
      },
      openRecords: {
        orderBy: { createdAt: 'desc' },
      },
      experiments: {
        orderBy: { scheduledDate: 'desc' },
      },
      blockRecords: {
        orderBy: { blockedAt: 'desc' },
      },
      reviewRecords: {
        orderBy: { reviewedAt: 'desc' },
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
      discardRecords: {
        orderBy: { discardedAt: 'desc' },
      },
    },
  });
};

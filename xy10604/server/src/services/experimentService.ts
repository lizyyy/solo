import { prisma } from '../config/database';
import { createAuditLog } from './auditService';
import { Experiment, ExperimentStatus, BlockReason, ReagentStatus } from '@prisma/client';

interface CreateExperimentParams {
  name: string;
  code: string;
  batchId: string;
  scheduledDate: Date;
  createdBy: string;
}

export interface ValidationResult {
  valid: boolean;
  blocked: boolean;
  blockReason?: BlockReason;
  blockDetails?: string;
  warnings?: string[];
}

export const validateExperiment = async (
  batchId: string,
  scheduledDate: Date
): Promise<ValidationResult> => {
  const batch = await prisma.reagentBatch.findUnique({
    where: { id: batchId },
    include: {
      reagent: true,
      openRecords: {
        where: { isOpened: true },
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
      blockRecords: {
        where: { isResolved: false },
        orderBy: { blockedAt: 'desc' },
        take: 1,
      },
    },
  });

  if (!batch) {
    return {
      valid: false,
      blocked: false,
      blockDetails: '试剂批号不存在',
    };
  }

  const warnings: string[] = [];

  if (batch.status === ReagentStatus.BLOCKED) {
    return {
      valid: false,
      blocked: true,
      blockReason: BlockReason.MANUAL_BLOCK,
      blockDetails: '该试剂批号已被人工封锁',
    };
  }

  if (batch.status === ReagentStatus.DISCARDED) {
    return {
      valid: false,
      blocked: true,
      blockReason: BlockReason.EXPIRED,
      blockDetails: '该试剂批号已废弃',
    };
  }

  if (batch.status === ReagentStatus.EXPIRED) {
    return {
      valid: false,
      blocked: true,
      blockReason: BlockReason.EXPIRED,
      blockDetails: '该试剂批号已过期',
    };
  }

  if (batch.blockRecords.length > 0) {
    const blockRecord = batch.blockRecords[0];
    return {
      valid: false,
      blocked: true,
      blockReason: blockRecord.reason,
      blockDetails: blockRecord.details || '该试剂批号被规则拦截',
    };
  }

  const scheduled = new Date(scheduledDate);
  const batchExpiry = new Date(batch.expiryDate);

  if (scheduled > batchExpiry) {
    return {
      valid: false,
      blocked: true,
      blockReason: BlockReason.EXPIRED,
      blockDetails: `实验日期(${scheduled.toISOString().split('T')[0]})晚于批号有效期(${batchExpiry.toISOString().split('T')[0]})`,
    };
  }

  const nearExpiryDays = batch.reagent.nearExpiryDays || 7;
  const nearExpiryThreshold = new Date(batchExpiry);
  nearExpiryThreshold.setDate(nearExpiryThreshold.getDate() - nearExpiryDays);

  if (scheduled >= nearExpiryThreshold) {
    warnings.push(
      `警告：实验日期接近批号有效期(剩余${Math.ceil((batchExpiry.getTime() - scheduled.getTime()) / (1000 * 60 * 60 * 24))}天)`
    );
  }

  if (batch.openRecords.length > 0) {
    const openRecord = batch.openRecords[0];
    const expectedExpiry = new Date(openRecord.expectedExpiry);

    if (scheduled > expectedExpiry) {
      return {
        valid: false,
        blocked: true,
        blockReason: BlockReason.EXPIRED,
        blockDetails: `实验日期(${scheduled.toISOString().split('T')[0]})晚于开封后期效日期(${expectedExpiry.toISOString().split('T')[0]})`,
      };
    }

    const openNearExpiryThreshold = new Date(expectedExpiry);
    openNearExpiryThreshold.setDate(openNearExpiryThreshold.getDate() - nearExpiryDays);

    if (scheduled >= openNearExpiryThreshold) {
      warnings.push(
        `警告：实验日期接近开封后期效日期(剩余${Math.ceil((expectedExpiry.getTime() - scheduled.getTime()) / (1000 * 60 * 60 * 24))}天)`
      );
    }
  } else if (batch.status === ReagentStatus.PENDING) {
    warnings.push('提示：该批号尚未开封，需要先创建开封记录');
  }

  return {
    valid: true,
    blocked: false,
    warnings: warnings.length > 0 ? warnings : undefined,
  };
};

export const createExperiment = async (
  params: CreateExperimentParams,
  applyValidation: boolean = true
): Promise<{ experiment: Experiment; validation: ValidationResult }> => {
  const batch = await prisma.reagentBatch.findUnique({
    where: { id: params.batchId },
  });

  if (!batch) {
    throw new Error('试剂批号不存在');
  }

  const existingExperiment = await prisma.experiment.findFirst({
    where: {
      code: params.code,
    },
  });

  if (existingExperiment) {
    throw new Error('实验编号已存在');
  }

  let validation: ValidationResult = { valid: true, blocked: false };
  let status: ExperimentStatus = ExperimentStatus.PENDING;
  let openRecordId: string | undefined;

  if (applyValidation) {
    validation = await validateExperiment(params.batchId, params.scheduledDate);

    if (!validation.valid) {
      if (validation.blocked) {
        status = ExperimentStatus.BLOCKED;
      } else {
        throw new Error(validation.blockDetails);
      }
    }
  }

  const openRecord = await prisma.openRecord.findFirst({
    where: {
      batchId: params.batchId,
      isOpened: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  if (openRecord) {
    openRecordId = openRecord.id;
  }

  const experiment = await prisma.experiment.create({
    data: {
      name: params.name,
      code: params.code,
      batchId: params.batchId,
      openRecordId,
      scheduledDate: new Date(params.scheduledDate),
      status,
      createdById: params.createdBy,
    },
  });

  await createAuditLog({
    action: 'CREATE_EXPERIMENT',
    entityType: 'EXPERIMENT',
    entityId: experiment.id,
    userId: params.createdBy,
    newValues: experiment,
  });

  if (status === ExperimentStatus.BLOCKED && validation.blockReason) {
    await prisma.blockRecord.create({
      data: {
        batchId: params.batchId,
        experimentId: experiment.id,
        openRecordId,
        reason: validation.blockReason,
        details: validation.blockDetails,
      },
    });
  }

  return { experiment, validation };
};

export const updateExperimentStatus = async (
  id: string,
  status: ExperimentStatus,
  userId: string
) => {
  const oldExperiment = await prisma.experiment.findUnique({
    where: { id },
  });

  if (!oldExperiment) {
    throw new Error('实验不存在');
  }

  const experiment = await prisma.experiment.update({
    where: { id },
    data: {
      status,
      ...(status === ExperimentStatus.COMPLETED && { actualEndDate: new Date() }),
    },
  });

  await createAuditLog({
    action: 'UPDATE_EXPERIMENT_STATUS',
    entityType: 'EXPERIMENT',
    entityId: id,
    userId,
    oldValues: oldExperiment,
    newValues: experiment,
  });

  return experiment;
};

export const getExperiments = async (params: {
  page?: number;
  limit?: number;
  batchId?: string;
  status?: ExperimentStatus;
  startDate?: string;
  endDate?: string;
}) => {
  const { page = 1, limit = 50, batchId, status, startDate, endDate } = params;

  const where: any = {};
  if (batchId) where.batchId = batchId;
  if (status) where.status = status;

  if (startDate || endDate) {
    where.scheduledDate = {};
    if (startDate) where.scheduledDate.gte = new Date(startDate);
    if (endDate) where.scheduledDate.lte = new Date(endDate);
  }

  const [experiments, total] = await Promise.all([
    prisma.experiment.findMany({
      where,
      include: {
        batch: {
          include: {
            reagent: true,
          },
        },
        openRecord: true,
        createdBy: {
          select: {
            id: true,
            username: true,
            name: true,
          },
        },
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
      orderBy: { scheduledDate: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.experiment.count({ where }),
  ]);

  return {
    experiments,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
};

export const getExperimentById = async (id: string) => {
  return prisma.experiment.findUnique({
    where: { id },
    include: {
      batch: {
        include: {
          reagent: true,
        },
      },
      openRecord: true,
      createdBy: {
        select: {
          id: true,
          username: true,
          name: true,
        },
      },
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

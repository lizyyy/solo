import { prisma } from '../config/database';
import { createAuditLog } from './auditService';
import { ReviewRecord, ReviewDecision, ExperimentStatus, ReagentStatus, BlockRecord } from '@prisma/client';

interface CreateReviewParams {
  batchId: string;
  experimentId?: string;
  openRecordId?: string;
  blockRecordId?: string;
  reviewerId: string;
  decision: ReviewDecision;
  reason: string;
  notes?: string;
}

export const createReview = async (params: CreateReviewParams): Promise<ReviewRecord> => {
  const affectedRecords: any[] = [];

  if (params.decision === ReviewDecision.APPROVE) {
    if (params.experimentId) {
      const oldExperiment = await prisma.experiment.findUnique({
        where: { id: params.experimentId },
      });

      const experiment = await prisma.experiment.update({
        where: { id: params.experimentId },
        data: { status: ExperimentStatus.APPROVED },
      });

      affectedRecords.push({
        type: 'EXPERIMENT',
        id: params.experimentId,
        oldStatus: oldExperiment?.status,
        newStatus: ExperimentStatus.APPROVED,
      });

      await createAuditLog({
        action: 'REVIEW_APPROVE_EXPERIMENT',
        entityType: 'EXPERIMENT',
        entityId: params.experimentId,
        userId: params.reviewerId,
        oldValues: oldExperiment,
        newValues: experiment,
      });
    }

    if (params.blockRecordId) {
      const oldBlockRecord = await prisma.blockRecord.findUnique({
        where: { id: params.blockRecordId },
      });

      const blockRecord = await prisma.blockRecord.update({
        where: { id: params.blockRecordId },
        data: {
          isResolved: true,
          resolvedAt: new Date(),
          resolvedBy: params.reviewerId,
          resolutionNotes: params.reason,
        },
      });

      affectedRecords.push({
        type: 'BLOCK_RECORD',
        id: params.blockRecordId,
        action: 'RESOLVED',
      });

      if (oldBlockRecord?.experimentId) {
        const oldExperiment = await prisma.experiment.findUnique({
          where: { id: oldBlockRecord.experimentId },
        });

        const experiment = await prisma.experiment.update({
          where: { id: oldBlockRecord.experimentId },
          data: { status: ExperimentStatus.APPROVED },
        });

        affectedRecords.push({
          type: 'EXPERIMENT',
          id: oldBlockRecord.experimentId,
          oldStatus: oldExperiment?.status,
          newStatus: ExperimentStatus.APPROVED,
        });

        await createAuditLog({
          action: 'REVIEW_APPROVE_EXPERIMENT',
          entityType: 'EXPERIMENT',
          entityId: oldBlockRecord.experimentId,
          userId: params.reviewerId,
          oldValues: oldExperiment,
          newValues: experiment,
        });
      }
    }

    if (params.batchId) {
      const oldBatch = await prisma.reagentBatch.findUnique({
        where: { id: params.batchId },
      });

      if (oldBatch?.status === ReagentStatus.BLOCKED) {
        const batch = await prisma.reagentBatch.update({
          where: { id: params.batchId },
          data: { status: ReagentStatus.ACTIVE },
        });

        affectedRecords.push({
          type: 'BATCH',
          id: params.batchId,
          oldStatus: oldBatch.status,
          newStatus: ReagentStatus.ACTIVE,
        });

        await createAuditLog({
          action: 'REVIEW_UNBLOCK_BATCH',
          entityType: 'BATCH',
          entityId: params.batchId,
          userId: params.reviewerId,
          oldValues: oldBatch,
          newValues: batch,
        });
      }
    }
  }

  if (params.decision === ReviewDecision.REJECT) {
    if (params.experimentId) {
      const oldExperiment = await prisma.experiment.findUnique({
        where: { id: params.experimentId },
      });

      const experiment = await prisma.experiment.update({
        where: { id: params.experimentId },
        data: { status: ExperimentStatus.CANCELLED },
      });

      affectedRecords.push({
        type: 'EXPERIMENT',
        id: params.experimentId,
        oldStatus: oldExperiment?.status,
        newStatus: ExperimentStatus.CANCELLED,
      });

      await createAuditLog({
        action: 'REVIEW_REJECT_EXPERIMENT',
        entityType: 'EXPERIMENT',
        entityId: params.experimentId,
        userId: params.reviewerId,
        oldValues: oldExperiment,
        newValues: experiment,
      });
    }

    if (params.blockRecordId) {
      const oldBlockRecord = await prisma.blockRecord.findUnique({
        where: { id: params.blockRecordId },
      });

      if (oldBlockRecord?.experimentId) {
        const oldExperiment = await prisma.experiment.findUnique({
          where: { id: oldBlockRecord.experimentId },
        });

        const experiment = await prisma.experiment.update({
          where: { id: oldBlockRecord.experimentId },
          data: { status: ExperimentStatus.CANCELLED },
        });

        affectedRecords.push({
          type: 'EXPERIMENT',
          id: oldBlockRecord.experimentId,
          oldStatus: oldExperiment?.status,
          newStatus: ExperimentStatus.CANCELLED,
        });

        await createAuditLog({
          action: 'REVIEW_REJECT_EXPERIMENT',
          entityType: 'EXPERIMENT',
          entityId: oldBlockRecord.experimentId,
          userId: params.reviewerId,
          oldValues: oldExperiment,
          newValues: experiment,
        });
      }
    }
  }

  const reviewRecord = await prisma.reviewRecord.create({
    data: {
      batchId: params.batchId,
      experimentId: params.experimentId,
      openRecordId: params.openRecordId,
      blockRecordId: params.blockRecordId,
      reviewerId: params.reviewerId,
      decision: params.decision,
      reason: params.reason,
      notes: params.notes,
      affectedRecords,
    },
  });

  await createAuditLog({
    action: 'CREATE_REVIEW',
    entityType: 'REVIEW',
    entityId: reviewRecord.id,
    userId: params.reviewerId,
    newValues: {
      ...reviewRecord,
      affectedRecords,
    },
  });

  return reviewRecord;
};

export const getReviewRecords = async (params: {
  page?: number;
  limit?: number;
  batchId?: string;
  experimentId?: string;
  reviewerId?: string;
  decision?: ReviewDecision;
  startDate?: string;
  endDate?: string;
}) => {
  const {
    page = 1,
    limit = 50,
    batchId,
    experimentId,
    reviewerId,
    decision,
    startDate,
    endDate,
  } = params;

  const where: any = {};
  if (batchId) where.batchId = batchId;
  if (experimentId) where.experimentId = experimentId;
  if (reviewerId) where.reviewerId = reviewerId;
  if (decision) where.decision = decision;

  if (startDate || endDate) {
    where.reviewedAt = {};
    if (startDate) where.reviewedAt.gte = new Date(startDate);
    if (endDate) where.reviewedAt.lte = new Date(endDate);
  }

  const [records, total] = await Promise.all([
    prisma.reviewRecord.findMany({
      where,
      include: {
        reviewer: {
          select: {
            id: true,
            username: true,
            name: true,
            role: true,
          },
        },
        batch: {
          include: {
            reagent: true,
          },
        },
        experiment: true,
        blockRecord: true,
      },
      orderBy: { reviewedAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.reviewRecord.count({ where }),
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

export const getReviewById = async (id: string) => {
  return prisma.reviewRecord.findUnique({
    where: { id },
    include: {
      reviewer: {
        select: {
          id: true,
          username: true,
          name: true,
          role: true,
        },
      },
      batch: {
        include: {
          reagent: true,
        },
      },
      experiment: {
        include: {
          createdBy: {
            select: {
              id: true,
              username: true,
              name: true,
            },
          },
        },
      },
      blockRecord: true,
    },
  });
};

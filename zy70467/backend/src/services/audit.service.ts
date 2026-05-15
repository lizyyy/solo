import prisma from '../utils/db';
import logger from '../utils/logger';

export class AuditService {
  async getAuditLogs(params: {
    batchId?: string;
    batchItemId?: string;
    page?: number;
    pageSize?: number;
  }) {
    const { batchId, batchItemId, page = 1, pageSize = 50 } = params;
    const skip = (page - 1) * pageSize;

    const where: any = {};
    if (batchId) where.batchId = batchId;
    if (batchItemId) where.batchItemId = batchItemId;

    const [data, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
      }),
      prisma.auditLog.count({ where }),
    ]);

    return { data, total, page, pageSize };
  }

  async submitReview(data: {
    batchId: string;
    itemId: string;
    reviewComment: string;
    reviewedBy: string;
    decision: 'APPROVED' | 'REJECTED' | 'NEED_MORE_INFO';
  }) {
    logger.info(`提交复核意见: ${data.itemId}, 决策: ${data.decision}`);

    const result = await prisma.$transaction(async (tx) => {
      const failedItem = await tx.failedItem.findUnique({
        where: { id: data.itemId },
        include: { batchItem: true },
      });

      if (!failedItem) {
        throw new Error('失败记录不存在');
      }

      const updatedFailedItem = await tx.failedItem.update({
        where: { id: data.itemId },
        data: {
          reviewStatus: data.decision === 'APPROVED' ? 'APPROVED' : 
                       data.decision === 'REJECTED' ? 'REJECTED' : 'PENDING',
          reviewComment: data.reviewComment,
          reviewedBy: data.reviewedBy,
          reviewedAt: new Date(),
        },
      });

      await tx.auditLog.create({
        data: {
          batchId: data.batchId,
          batchItemId: failedItem.batchItemId,
          action: 'REVIEW_SUBMITTED',
          operator: data.reviewedBy,
          beforeData: {
            reviewStatus: failedItem.reviewStatus,
            reviewComment: failedItem.reviewComment,
          } as any,
          afterData: {
            reviewStatus: updatedFailedItem.reviewStatus,
            reviewComment: updatedFailedItem.reviewComment,
            decision: data.decision,
          } as any,
          comment: `复核决策: ${data.decision}, 意见: ${data.reviewComment}`,
        },
      });

      const batch = await tx.batch.findUnique({
        where: { id: data.batchId },
        include: { failedItems: true },
      });

      if (batch) {
        const allReviewed = batch.failedItems.every(
          item => item.reviewStatus !== 'PENDING'
        );
        if (allReviewed && batch.failedItems.length > 0) {
          await tx.batch.update({
            where: { id: data.batchId },
            data: { status: 'REVIEWED' },
          });
          await tx.auditLog.create({
            data: {
              batchId: data.batchId,
              action: 'BATCH_REVIEW_COMPLETED',
              operator: data.reviewedBy,
              comment: '批次所有失败项复核完成',
            },
          });
        }
      }

      return updatedFailedItem;
    });

    return result;
  }
}

export const auditService = new AuditService();

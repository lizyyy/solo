import { Prisma } from '@prisma/client';
import prisma from '../utils/db';
import logger from '../utils/logger';

export class SecurityService {
  async createCandidateList(data: {
    type: 'CLEANUP' | 'ROLLBACK';
    batchIds: string[];
    reason: string;
    requestedBy: string;
  }) {
    logger.info(`创建候选清单: 类型=${data.type}, 请求人=${data.requestedBy}`);

    const batches = await prisma.batch.findMany({
      where: { id: { in: data.batchIds } },
      select: { id: true, name: true, status: true },
    });

    if (batches.length !== data.batchIds.length) {
      throw new Error('部分批次不存在');
    }

    const candidateList = await prisma.candidateList.create({
      data: {
        type: data.type,
        itemIds: data.batchIds as any,
        reason: data.reason,
        requestedBy: data.requestedBy,
        status: 'PENDING',
      },
    });

    await prisma.auditLog.create({
      data: {
        action: 'CANDIDATE_LIST_CREATED',
        operator: data.requestedBy,
        afterData: {
          candidateListId: candidateList.id,
          type: data.type,
          batchIds: data.batchIds,
        } as any,
        comment: `创建${data.type === 'CLEANUP' ? '清理' : '回滚'}候选清单，原因: ${data.reason}`,
      },
    });

    return candidateList;
  }

  async approveCandidateList(id: string, approved: boolean, approvedBy: string, comment?: string) {
    logger.info(`审核候选清单: ${id}, 结果: ${approved ? '通过' : '拒绝'}`);

    const candidateList = await prisma.candidateList.findUnique({
      where: { id },
    });

    if (!candidateList) {
      throw new Error('候选清单不存在');
    }

    if (candidateList.status !== 'PENDING') {
      throw new Error('候选清单已处理');
    }

    const updatedList = await prisma.candidateList.update({
      where: { id },
      data: {
        status: approved ? 'APPROVED' : 'REJECTED',
        approvedBy,
        comment,
        approvedAt: new Date(),
      },
    });

    await prisma.auditLog.create({
      data: {
        action: 'CANDIDATE_LIST_REVIEWED',
        operator: approvedBy,
        beforeData: { status: 'PENDING' } as any,
        afterData: { status: updatedList.status, comment } as any,
        comment: `候选清单审核${approved ? '通过' : '拒绝'}，${comment || '无备注'}`,
      },
    });

    return updatedList;
  }

  async executeCandidateList(id: string, executedBy: string) {
    logger.info(`执行候选清单: ${id}, 执行人: ${executedBy}`);

    const candidateList = await prisma.candidateList.findUnique({
      where: { id },
    });

    if (!candidateList) {
      throw new Error('候选清单不存在');
    }

    if (candidateList.status !== 'APPROVED') {
      throw new Error('候选清单未审核通过');
    }

    const batchIds = candidateList.itemIds as unknown as string[];

    const result = await prisma.$transaction(async (tx) => {
      if (candidateList.type === 'CLEANUP') {
        for (const batchId of batchIds) {
          await tx.failedItem.deleteMany({ where: { batchId } });
          await tx.auditLog.deleteMany({ where: { batchId } });
          await tx.batchItem.deleteMany({ where: { batchId } });
          await tx.batch.delete({ where: { id: batchId } });
        }

        await tx.auditLog.create({
          data: {
            action: 'BATCHES_CLEANED_UP',
            operator: executedBy,
            afterData: { batchIds } as any,
            comment: `清理 ${batchIds.length} 个批次完成`,
          },
        });
      } else {
        for (const batchId of batchIds) {
          await tx.batch.update({
            where: { id: batchId },
            data: {
              status: 'PENDING',
              successCount: 0,
              failedCount: 0,
              partialSuccess: false,
              executedAt: null,
            },
          });

          await tx.batchItem.updateMany({
            where: { batchId },
            data: {
              status: 'PENDING',
              isFailed: false,
              validationErrors: Prisma.JsonNull,
              processedData: Prisma.JsonNull,
              processedAt: null,
            },
          });

          await tx.failedItem.deleteMany({ where: { batchId } });

          await tx.auditLog.create({
            data: {
              batchId,
              action: 'BATCH_ROLLED_BACK',
              operator: executedBy,
              comment: '批次已回滚至待处理状态',
            },
          });
        }
      }

      return tx.candidateList.update({
        where: { id },
        data: {
          status: 'EXECUTED',
          executedAt: new Date(),
        },
      });
    });

    logger.info(`候选清单执行完成: ${id}`);
    return result;
  }

  async getCandidateLists(params: {
    type?: string;
    status?: string;
    page?: number;
    pageSize?: number;
  }) {
    const { type, status, page = 1, pageSize = 20 } = params;
    const skip = (page - 1) * pageSize;

    const where: any = {};
    if (type) where.type = type;
    if (status) where.status = status;

    const [data, total] = await Promise.all([
      prisma.candidateList.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
      }),
      prisma.candidateList.count({ where }),
    ]);

    return { data, total, page, pageSize };
  }
}

export const securityService = new SecurityService();

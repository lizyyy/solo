import prisma from '../utils/db';
import logger from '../utils/logger';
import { ruleEngineService } from './ruleEngine.service';
import { TrainingEnvironmentItem, BatchExecutionResult, RuleLogic, BatchStatus } from '../models';

export class BatchService {
  async createBatch(data: {
    name: string;
    description?: string;
    inputData: TrainingEnvironmentItem[];
    createdBy: string;
  }) {
    logger.info(`创建批次: ${data.name}, 数据量: ${data.inputData.length}`);

    let activeRule = await ruleEngineService.getActiveRuleVersion();
    if (!activeRule) {
      logger.info('未找到激活的规则版本，自动创建默认规则');
      activeRule = await ruleEngineService.createRuleVersion({
        name: '默认审批校验规则',
        description: '系统自动创建的默认审批校验规则',
        logic: ruleEngineService.getDefaultRuleLogic(1),
        createdBy: 'system',
      });
    }

    const batch = await prisma.$transaction(async (tx) => {
      const newBatch = await tx.batch.create({
        data: {
          name: data.name,
          description: data.description,
          ruleVersionId: activeRule.id,
          totalCount: data.inputData.length,
          createdBy: data.createdBy,
        },
      });

      const batchItems = data.inputData.map((item) => ({
        batchId: newBatch.id,
        originalData: item as any,
      }));

      await tx.batchItem.createMany({ data: batchItems });

      await tx.auditLog.create({
        data: {
          batchId: newBatch.id,
          action: 'BATCH_CREATED',
          operator: data.createdBy,
          comment: `创建批次，共 ${data.inputData.length} 条数据`,
        },
      });

      return newBatch;
    });

    logger.info(`批次创建成功: ${batch.id}`);
    return batch;
  }

  async executeBatch(batchId: string) {
    logger.info(`开始执行批次: ${batchId}`);
    const startTime = Date.now();

    const result = await prisma.$transaction(async (tx) => {
      const batch = await tx.batch.findUnique({
        where: { id: batchId },
        include: { items: true, ruleVersion: true },
      });

      if (!batch) {
        throw new Error('批次不存在');
      }

      if (batch.status !== 'PENDING') {
        throw new Error('批次已执行或正在处理中');
      }

      await tx.batch.update({
        where: { id: batchId },
        data: { status: 'PROCESSING' },
      });

      const ruleLogic = batch.ruleVersion.logic as unknown as RuleLogic;

      let successCount = 0;
      let failedCount = 0;
      const failedItems: BatchExecutionResult['failedItems'] = [];

      for (const item of batch.items) {
        const originalData = item.originalData as unknown as TrainingEnvironmentItem;
        const errors = ruleEngineService.validateItem(originalData, ruleLogic);
        const hasBlocker = ruleEngineService.hasBlockerErrors(errors);

        if (hasBlocker || errors.length > 0) {
          failedCount++;
          await tx.batchItem.update({
            where: { id: item.id },
            data: {
              status: 'FAILED',
              isFailed: true,
              validationErrors: errors as any,
              processedAt: new Date(),
            },
          });

          const failureReason = errors.find(e => e.severity === 'BLOCKER')?.message || '存在验证错误';
          failedItems.push({
            itemId: item.id,
            originalData,
            failureReason,
            errors,
          });

          await tx.failedItem.create({
            data: {
              batchId: batch.id,
              batchItemId: item.id,
              originalData: originalData as any,
              failureReason,
              errorDetails: errors as any,
            },
          });
        } else {
          successCount++;
          await tx.batchItem.update({
            where: { id: item.id },
            data: {
              status: 'SUCCESS',
              isFailed: false,
              processedData: originalData as any,
              processedAt: new Date(),
            },
          });
        }
      }

      const partialSuccess = successCount > 0 && failedCount > 0;
      let finalStatus: BatchStatus;

      if (failedCount === 0) {
        finalStatus = 'SUCCESS';
      } else if (successCount === 0) {
        finalStatus = 'FAILED';
      } else {
        finalStatus = 'PARTIAL_SUCCESS';
      }

      const executionTimeMs = Date.now() - startTime;

      const updatedBatch = await tx.batch.update({
        where: { id: batchId },
        data: {
          status: finalStatus,
          successCount,
          failedCount,
          partialSuccess,
          executionTimeMs,
          executedAt: new Date(),
        },
      });

      await tx.auditLog.create({
        data: {
          batchId: batch.id,
          action: 'BATCH_EXECUTED',
          operator: 'SYSTEM',
          afterData: {
            status: finalStatus,
            successCount,
            failedCount,
            executionTimeMs,
          } as any,
          comment: `批次执行完成，成功: ${successCount}, 失败: ${failedCount}`,
        },
      });

      return {
        batchId: updatedBatch.id,
        status: finalStatus,
        totalCount: updatedBatch.totalCount,
        successCount,
        failedCount,
        partialSuccess,
        executionTimeMs,
        failedItems,
      };
    });

    logger.info(`批次执行完成: ${batchId}, 状态: ${result.status}, 耗时: ${result.executionTimeMs}ms`);
    return result;
  }

  async getBatchList(params: {
    page?: number;
    pageSize?: number;
    status?: string;
  }) {
    const { page = 1, pageSize = 20, status } = params;
    const skip = (page - 1) * pageSize;

    const where = status ? { status: status as any } : {};

    const [data, total] = await Promise.all([
      prisma.batch.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
        include: { ruleVersion: { select: { version: true, name: true } } },
      }),
      prisma.batch.count({ where }),
    ]);

    return { data, total, page, pageSize };
  }

  async getBatchDetail(batchId: string) {
    return prisma.batch.findUnique({
      where: { id: batchId },
      include: {
        items: true,
        failedItems: true,
        ruleVersion: true,
        auditLogs: { orderBy: { createdAt: 'desc' } },
      },
    });
  }

  async getBatchItems(batchId: string) {
    return prisma.batchItem.findMany({
      where: { batchId },
      orderBy: { createdAt: 'desc' },
    });
  }
}

export const batchService = new BatchService();

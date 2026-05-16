import { inMemoryDb, InMemoryBatch } from '../utils/inMemoryDb';
import logger from '../utils/logger';

export class DemoBatchService {
  async createBatch(data: {
    name: string;
    description?: string;
    inputData: any[];
    createdBy: string;
  }) {
    logger.info(`[演示模式] 创建批次: ${data.name}, 数据量: ${data.inputData.length}`);

    const activeRule = inMemoryDb.getActiveRule();
    if (!activeRule) {
      throw new Error('没有激活的规则版本');
    }

    const batch = inMemoryDb.createBatch({
      ...data,
      ruleVersionId: activeRule.id,
    });

    return batch;
  }

  async executeBatch(batchId: string) {
    logger.info(`[演示模式] 执行批次: ${batchId}`);
    const startTime = Date.now();

    const batch = inMemoryDb.getBatchById(batchId);
    if (!batch) {
      throw new Error('批次不存在');
    }

    if (batch.status !== 'PENDING') {
      throw new Error('批次已执行或正在处理中');
    }

    inMemoryDb.updateBatch(batchId, { status: 'PROCESSING' });

    let successCount = 0;
    let failedCount = 0;
    const failedItems: any[] = [];

    for (const item of batch.items) {
      const originalData = item.originalData;
      const errors = this.validateItem(originalData);
      const hasBlocker = errors.some((e: any) => e.severity === 'BLOCKER');

      if (hasBlocker || errors.length > 0) {
        failedCount++;
        inMemoryDb.updateBatchItem(batchId, item.id, {
          status: 'FAILED',
          isFailed: true,
          validationErrors: errors,
          processedAt: new Date(),
        });

        const failureReason = errors.find((e: any) => e.severity === 'BLOCKER')?.message || '存在验证错误';
        failedItems.push({
          itemId: item.id,
          originalData,
          failureReason,
          errors,
        });

        inMemoryDb.createFailedItem({
          batchId,
          batchItemId: item.id,
          originalData,
          failureReason,
          errorDetails: errors,
          reviewStatus: 'PENDING',
        });
      } else {
        successCount++;
        inMemoryDb.updateBatchItem(batchId, item.id, {
          status: 'SUCCESS',
          isFailed: false,
          processedData: originalData,
          processedAt: new Date(),
        });
      }
    }

    const partialSuccess = successCount > 0 && failedCount > 0;
    let finalStatus: InMemoryBatch['status'];

    if (failedCount === 0) {
      finalStatus = 'SUCCESS';
    } else if (successCount === 0) {
      finalStatus = 'FAILED';
    } else {
      finalStatus = 'PARTIAL_SUCCESS';
    }

    const executionTimeMs = Date.now() - startTime;

    const updatedBatch = inMemoryDb.updateBatch(batchId, {
      status: finalStatus,
      successCount,
      failedCount,
      partialSuccess,
      executionTimeMs,
      executedAt: new Date(),
    });

    inMemoryDb.addAuditLog({
      batchId,
      action: 'BATCH_EXECUTED',
      operator: 'SYSTEM',
      afterData: {
        status: finalStatus,
        successCount,
        failedCount,
        executionTimeMs,
      },
      comment: `批次执行完成，成功: ${successCount}, 失败: ${failedCount}`,
    });

    logger.info(`[演示模式] 批次执行完成: ${batchId}, 状态: ${finalStatus}, 耗时: ${executionTimeMs}ms`);

    return {
      batchId: updatedBatch?.id,
      status: finalStatus,
      totalCount: updatedBatch?.totalCount,
      successCount,
      failedCount,
      partialSuccess,
      executionTimeMs,
      failedItems,
    };
  }

  private validateItem(item: any): any[] {
    const errors: any[] = [];

    if (['APPROVED', 'REJECTED'].includes(item.approvalStatus)) {
      if (!item.approvalComment || item.approvalComment.trim() === '') {
        errors.push({
          field: 'approvalComment',
          code: 'APPROVAL_COMMENT_MISSING',
          message: '审批意见为空，流程被拦截',
          severity: 'BLOCKER',
        });
      }
    }

    if (!item.submissionId || item.submissionId.trim() === '') {
      errors.push({
        field: 'submissionId',
        code: 'SUBMISSION_ID_MISSING',
        message: '提交记录ID缺失',
        severity: 'ERROR',
      });
    }

    return errors;
  }

  async getBatchList(params: { page?: number; pageSize?: number; status?: string }) {
    return inMemoryDb.getBatches(params);
  }

  async getBatchDetail(batchId: string) {
    const batch = inMemoryDb.getBatchById(batchId);
    if (!batch) return null;
    
    const failedItems = inMemoryDb.getFailedItemsByBatch(batchId);
    const auditLogs = inMemoryDb.getAuditLogs({ batchId }).data;
    const ruleVersion = inMemoryDb.getRuleById(batch.ruleVersionId);

    return {
      ...batch,
      failedItems,
      auditLogs,
      ruleVersion,
    };
  }

  async generateReport(batchId: string) {
    const batch = await this.getBatchDetail(batchId);
    if (!batch) throw new Error('批次不存在');

    const nextSteps: string[] = [];
    if (batch.status === 'PENDING') {
      nextSteps.push('请执行批次处理以验证数据');
    }
    if (batch.failedCount > 0) {
      nextSteps.push(`有 ${batch.failedCount} 条数据验证失败，请查看失败项`);
      nextSteps.push('建议先处理 BLOCKER 级别的错误（如：审批意见缺失）');
      nextSteps.push('对失败项进行人工复核后，可重新提交处理');
    }
    if (batch.partialSuccess) {
      nextSteps.push('部分数据验证通过，建议完成失败项处理后统一推进');
    }
    if (batch.status === 'SUCCESS') {
      nextSteps.push('所有数据验证通过，可以进入下一流程');
    }
    nextSteps.push(`[演示模式] 当前使用规则版本: v${batch.ruleVersion?.version} - ${batch.ruleVersion?.name}`);

    return {
      batchId,
      beforeProcessing: batch.items.map((i: any) => i.originalData),
      afterProcessing: batch.items.filter((i: any) => i.status === 'SUCCESS').map((i: any) => i.processedData),
      executionTime: batch.executionTimeMs || 0,
      successCount: batch.successCount,
      failedCount: batch.failedCount,
      partialSuccess: batch.partialSuccess,
      nextSteps,
      failedItems: batch.failedItems,
    };
  }

  async submitReview(data: {
    batchId: string;
    itemId: string;
    reviewComment: string;
    reviewedBy: string;
    decision: 'APPROVED' | 'REJECTED' | 'NEED_MORE_INFO';
  }) {
    const failedItem = inMemoryDb.getFailedItemsByBatch(data.batchId).find(f => f.id === data.itemId);
    if (!failedItem) {
      throw new Error('失败记录不存在');
    }

    const updated = inMemoryDb.updateFailedItem(data.itemId, {
      reviewStatus: data.decision === 'APPROVED' ? 'APPROVED' : data.decision === 'REJECTED' ? 'REJECTED' : 'PENDING',
      reviewComment: data.reviewComment,
      reviewedBy: data.reviewedBy,
      reviewedAt: new Date(),
    });

    inMemoryDb.addAuditLog({
      batchId: data.batchId,
      batchItemId: failedItem.batchItemId,
      action: 'REVIEW_SUBMITTED',
      operator: data.reviewedBy,
      beforeData: {
        reviewStatus: failedItem.reviewStatus,
        reviewComment: failedItem.reviewComment,
      },
      afterData: {
        reviewStatus: updated?.reviewStatus,
        reviewComment: updated?.reviewComment,
        decision: data.decision,
      },
      comment: `复核决策: ${data.decision}, 意见: ${data.reviewComment}`,
    });

    return updated;
  }

  getActiveRule() {
    return inMemoryDb.getActiveRule();
  }

  getAllRules() {
    return inMemoryDb.getAllRules();
  }

  getAuditLogs(params: { batchId?: string; page?: number; pageSize?: number }) {
    return inMemoryDb.getAuditLogs(params);
  }
}

export const demoBatchService = new DemoBatchService();

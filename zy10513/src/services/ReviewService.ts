import { Transaction } from 'sequelize';
import {
  SamplingBatch,
  OriginalRecord,
  Reviewer,
  ReviewConclusion,
  ExceptionLog,
  sequelize,
} from '../models';
import { BatchStatus } from '../models/SamplingBatch';
import { ReviewResult } from '../models/ReviewConclusion';
import { ExceptionType } from '../models/ExceptionLog';

export class ReviewService {
  async startReview(batchId: string): Promise<SamplingBatch> {
    const batch = await SamplingBatch.findByPk(batchId);
    if (!batch) {
      throw new Error('抽样批次不存在');
    }

    if (batch.status !== BatchStatus.SAMPLING_COMPLETED) {
      throw new Error('批次状态不正确，无法开始复核');
    }

    return batch.update({ status: BatchStatus.REVIEWING });
  }

  async submitConclusion(data: {
    batchId: string;
    originalRecordId: string;
    reviewerId: string;
    result: ReviewResult;
    comments?: string;
    evidence?: string[];
    processingBasis?: string;
  }): Promise<ReviewConclusion> {
    const t = await sequelize.transaction();

    try {
      const batch = await SamplingBatch.findByPk(data.batchId, { transaction: t });
      if (!batch) {
        throw new Error('抽样批次不存在');
      }

      if (batch.status !== BatchStatus.REVIEWING) {
        throw new Error('批次状态不正确，无法提交复核结论');
      }

      const record = await OriginalRecord.findByPk(data.originalRecordId, {
        transaction: t,
      });
      if (!record) {
        throw new Error('原始记录不存在');
      }

      const reviewer = await Reviewer.findByPk(data.reviewerId, { transaction: t });
      if (!reviewer) {
        throw new Error('复核人不存在');
      }

      const conclusion = await ReviewConclusion.create(
        {
          ...data,
          isManualCorrection: false,
        },
        { transaction: t }
      );

      await this.updateBatchReviewStatus(data.batchId, t);

      await t.commit();
      return conclusion;
    } catch (error) {
      await t.rollback();
      await ExceptionLog.create({
        batchId: data.batchId,
        originalRecordId: data.originalRecordId,
        type: ExceptionType.REVIEW_ERROR,
        errorMessage: error instanceof Error ? error.message : '未知错误',
        errorStack: error instanceof Error ? error.stack : undefined,
      });
      throw error;
    }
  }

  async manualCorrect(data: {
    conclusionId: string;
    correctedBy: string;
    result?: ReviewResult;
    comments?: string;
    correctionData?: Record<string, any>;
    processingBasis?: string;
  }): Promise<ReviewConclusion> {
    const conclusion = await ReviewConclusion.findByPk(data.conclusionId);
    if (!conclusion) {
      throw new Error('复核结论不存在');
    }

    const updateData: any = {
      isManualCorrection: true,
      correctedAt: new Date(),
      correctedBy: data.correctedBy,
    };

    if (data.result) {
      updateData.result = data.result;
    }
    if (data.comments) {
      updateData.comments = data.comments;
    }
    if (data.correctionData) {
      updateData.correctionData = data.correctionData;
    }
    if (data.processingBasis) {
      updateData.processingBasis = data.processingBasis;
    }

    await conclusion.update(updateData);
    await this.updateBatchReviewStatus(conclusion.batchId);

    return conclusion;
  }

  private async updateBatchReviewStatus(
    batchId: string,
    transaction?: Transaction
  ): Promise<void> {
    const conclusions = await ReviewConclusion.findAll({
      where: { batchId },
      transaction,
    });

    const sampledRecords = await OriginalRecord.count({
      where: { batchId, isSampled: true },
      transaction,
    });

    if (conclusions.length >= sampledRecords) {
      await SamplingBatch.update(
        { status: BatchStatus.REVIEW_COMPLETED },
        { where: { id: batchId }, transaction }
      );
    }
  }

  async getBatchReviewStats(batchId: string): Promise<{
    totalSampled: number;
    reviewedCount: number;
    passCount: number;
    failCount: number;
    pendingCount: number;
    passRate: number;
  }> {
    const totalSampled = await OriginalRecord.count({
      where: { batchId, isSampled: true },
    });

    const conclusions = await ReviewConclusion.findAll({
      where: { batchId },
    });

    const passCount = conclusions.filter((c) => c.result === ReviewResult.PASS).length;
    const failCount = conclusions.filter((c) => c.result === ReviewResult.FAIL).length;
    const pendingCount = conclusions.filter(
      (c) => c.result === ReviewResult.PENDING || c.result === ReviewResult.NEEDS_REVIEW
    ).length;
    const reviewedCount = conclusions.length;

    return {
      totalSampled,
      reviewedCount,
      passCount,
      failCount,
      pendingCount,
      passRate: reviewedCount > 0 ? passCount / reviewedCount : 0,
    };
  }

  async getFailRecordsWithTrace(
    batchId: string,
    page = 1,
    pageSize = 20
  ): Promise<{
    rows: Array<{
      conclusion: ReviewConclusion;
      originalRecord: OriginalRecord;
      exceptions: ExceptionLog[];
    }>;
    count: number;
  }> {
    const { count, rows } = await ReviewConclusion.findAndCountAll({
      where: {
        batchId,
        result: [ReviewResult.FAIL, ReviewResult.NEEDS_REVIEW],
      },
      include: [
        { model: OriginalRecord, as: 'originalRecord' },
        { model: ExceptionLog, as: 'exceptionLogs' },
      ],
      offset: (page - 1) * pageSize,
      limit: pageSize,
      order: [['createdAt', 'DESC']],
    });

    return {
      count,
      rows: rows.map((conclusion) => ({
        conclusion,
        originalRecord: conclusion.originalRecord as OriginalRecord,
        exceptions: [],
      })),
    };
  }
}

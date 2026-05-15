import prisma from '../utils/db';
import logger from '../utils/logger';
import { createObjectCsvStringifier } from 'csv-writer';
import { ProcessingReport, TrainingEnvironmentItem, ValidationError } from '../models';

export class ReportService {
  async generateReport(batchId: string): Promise<ProcessingReport> {
    logger.info(`生成批次报告: ${batchId}`);

    const batch = await prisma.batch.findUnique({
      where: { id: batchId },
      include: {
        items: true,
        failedItems: true,
        ruleVersion: true,
      },
    });

    if (!batch) {
      throw new Error('批次不存在');
    }

    const beforeProcessing = batch.items.map(
      item => item.originalData as unknown as TrainingEnvironmentItem
    );

    const afterProcessing = batch.items
      .filter(item => item.processedData)
      .map(item => item.processedData as unknown as TrainingEnvironmentItem);

    const nextSteps = this.generateNextSteps(batch);

    const failedItems = batch.failedItems.map(item => ({
      id: item.id,
      originalData: item.originalData as unknown as TrainingEnvironmentItem,
      failureReason: item.failureReason,
      errorDetails: item.errorDetails as unknown as ValidationError[],
      reviewStatus: item.reviewStatus as any,
    }));

    return {
      batchId: batch.id,
      beforeProcessing,
      afterProcessing,
      executionTime: batch.executionTimeMs || 0,
      successCount: batch.successCount,
      failedCount: batch.failedCount,
      partialSuccess: batch.partialSuccess,
      nextSteps,
      failedItems,
    };
  }

  private generateNextSteps(batch: any): string[] {
    const steps: string[] = [];

    if (batch.status === 'PENDING') {
      steps.push('请执行批次处理以验证数据');
      return steps;
    }

    if (batch.failedCount > 0) {
      steps.push(`有 ${batch.failedCount} 条数据验证失败，请查看失败项`);
      steps.push('建议先处理 BLOCKER 级别的错误（如：审批意见缺失）');
      steps.push('对失败项进行人工复核后，可重新提交处理');
    }

    if (batch.partialSuccess) {
      steps.push('部分数据验证通过，建议完成失败项处理后统一推进');
    }

    if (batch.status === 'SUCCESS') {
      steps.push('所有数据验证通过，可以进入下一流程');
      steps.push('建议导出报告存档');
    }

    steps.push(`本次处理使用规则版本: v${batch.ruleVersion?.version} - ${batch.ruleVersion?.name}`);

    return steps;
  }

  async exportFailedItemsCsv(batchId: string): Promise<string> {
    logger.info(`导出失败项 CSV: ${batchId}`);

    const failedItems = await prisma.failedItem.findMany({
      where: { batchId },
    });

    if (failedItems.length === 0) {
      throw new Error('该批次没有失败项');
    }

    const csvStringifier = createObjectCsvStringifier({
      header: [
        { id: 'failedItemId', title: '失败记录ID' },
        { id: 'courseId', title: '课程ID' },
        { id: 'courseName', title: '课程名称' },
        { id: 'traineeId', title: '学员ID' },
        { id: 'traineeName', title: '学员姓名' },
        { id: 'submissionId', title: '提交ID' },
        { id: 'approvalStatus', title: '审批状态' },
        { id: 'approvalComment', title: '审批意见' },
        { id: 'failureReason', title: '失败原因' },
        { id: 'reviewStatus', title: '复核状态' },
        { id: 'reviewComment', title: '复核意见' },
        { id: 'reviewedBy', title: '复核人' },
      ],
    });

    const records = failedItems.map(item => {
      const originalData = item.originalData as any;
      return {
        failedItemId: item.id,
        courseId: originalData.courseId || '',
        courseName: originalData.courseName || '',
        traineeId: originalData.traineeId || '',
        traineeName: originalData.traineeName || '',
        submissionId: originalData.submissionId || '',
        approvalStatus: originalData.approvalStatus || '',
        approvalComment: originalData.approvalComment || '',
        failureReason: item.failureReason,
        reviewStatus: item.reviewStatus,
        reviewComment: item.reviewComment || '',
        reviewedBy: item.reviewedBy || '',
      };
    });

    const header = csvStringifier.getHeaderString();
    const body = csvStringifier.stringifyRecords(records);

    return header + '\n' + body;
  }
}

export const reportService = new ReportService();

import { RoastingBatch, BatchReport, BatchStatus } from '../types';
import { store } from '../data/store';

export class ReportService {
  public calculateRoastDuration(batch: RoastingBatch): number | null {
    if (!batch.startTime || !batch.endTime) {
      return null;
    }
    return (batch.endTime.getTime() - batch.startTime.getTime()) / 1000;
  }

  public calculateWeightLossPercentage(batch: RoastingBatch): number | null {
    return batch.weightLossPercentage;
  }

  public getCuppingScore(batch: RoastingBatch): number | null {
    return batch.cuppingResult?.overall || null;
  }

  public getBatchIssues(batch: RoastingBatch): string[] {
    const issues: string[] = [];

    if (batch.status === BatchStatus.NEEDS_ATTENTION) {
      issues.push(...batch.attentionReasons);
    }

    if (batch.status === BatchStatus.REJECTED && batch.rejectionReason) {
      issues.push(batch.rejectionReason);
    }

    if (batch.weightLossPercentage !== null && batch.weightLossPercentage > 14) {
      issues.push(`重量损耗较高 (${batch.weightLossPercentage}%)`);
    }

    if (batch.cuppingResult && batch.cuppingResult.overall < 70) {
      issues.push(`杯测分数偏低 (${batch.cuppingResult.overall}分)`);
    }

    return [...new Set(issues)];
  }

  public generateBatchReport(batch: RoastingBatch): BatchReport {
    return {
      batchId: batch.id,
      batchNumber: batch.batchNumber,
      origin: batch.greenCoffee.origin,
      roastLevel: batch.roastLevel,
      status: batch.status,
      plannedWeightKg: batch.plannedWeightKg,
      actualWeightKg: batch.actualWeightKg,
      weightLossPercentage: this.calculateWeightLossPercentage(batch),
      roastDuration: this.calculateRoastDuration(batch),
      cuppingScore: this.getCuppingScore(batch),
      issues: this.getBatchIssues(batch),
      roastedAt: batch.startTime
    };
  }

  public generateBatchReportList(batches: RoastingBatch[]): BatchReport[] {
    return batches.map(batch => this.generateBatchReport(batch));
  }

  public getBatchDetail(batch: RoastingBatch) {
    return {
      ...batch,
      report: this.generateBatchReport(batch),
      roastDuration: this.calculateRoastDuration(batch),
      issues: this.getBatchIssues(batch)
    };
  }

  public getBatchHistoryWithDetails(batchId: string) {
    const histories = store.getBatchHistories(batchId);
    return histories.map(history => ({
      ...history,
      formattedChangedAt: history.changedAt.toLocaleString('zh-CN')
    }));
  }

  public generateSummaryStatistics(batches: RoastingBatch[]) {
    const completed = batches.filter(b => b.status === BatchStatus.COMPLETED);
    const processing = batches.filter(b => b.status === BatchStatus.PROCESSING);
    const needsAttention = batches.filter(b => b.status === BatchStatus.NEEDS_ATTENTION);
    const rejected = batches.filter(b => b.status === BatchStatus.REJECTED);

    const completedWithCupping = completed.filter(b => b.cuppingResult);
    const avgCuppingScore = completedWithCupping.length > 0
      ? completedWithCupping.reduce((sum, b) => sum + (b.cuppingResult?.overall || 0), 0) / completedWithCupping.length
      : 0;

    const completedWithWeightLoss = completed.filter(b => b.weightLossPercentage !== null);
    const avgWeightLoss = completedWithWeightLoss.length > 0
      ? completedWithWeightLoss.reduce((sum, b) => sum + (b.weightLossPercentage || 0), 0) / completedWithWeightLoss.length
      : 0;

    return {
      totalBatches: batches.length,
      byStatus: {
        completed: completed.length,
        processing: processing.length,
        needsAttention: needsAttention.length,
        rejected: rejected.length
      },
      qualityMetrics: {
        averageCuppingScore: Math.round(avgCuppingScore * 100) / 100,
        averageWeightLossPercentage: Math.round(avgWeightLoss * 100) / 100,
        belowThresholdCupping: completedWithCupping.filter(b => (b.cuppingResult?.overall || 0) < 70).length
      },
      totalWeight: {
        planned: batches.reduce((sum, b) => sum + b.plannedWeightKg, 0),
        actual: batches.reduce((sum, b) => sum + b.actualWeightKg, 0)
      },
      lastUpdated: new Date()
    };
  }
}

export const reportService = new ReportService();

import * as fs from 'fs';
import * as path from 'path';
import { Parser } from 'json2csv';
import { DataStore } from './dataStore';
import {
  ReportData,
  Worker,
  Discrepancy,
  ReviewRecord,
  AppealHistory,
  BatchStatistics,
  DiscrepancyType,
} from './types';

export class ReportService {
  private store: DataStore;
  private outputDir: string;

  constructor(store: DataStore, outputDir?: string) {
    this.store = store;
    this.outputDir = outputDir || path.join(process.cwd(), 'reports');
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }
  }

  recalculateBatch(batchId: string): ReportData {
    const batch = this.store.getBatchById(batchId);
    if (!batch) {
      throw new Error('对账批次 ' + batchId + ' 不存在');
    }

    const repairs = this.store.getRepairs(batchId);
    const workers = this.store.getWorkers(batchId);
    const ratings = this.store.getRatings(batchId);
    const discrepancies = this.store.getDiscrepancies();
    const reviews = this.store.getReviews();
    const appeals = this.store.getAppeals();

    const workerScores = this.calculateWorkerScores(workers, discrepancies, reviews, appeals, batchId);

    const matchedRepairs = repairs.filter(r => r.workerId).length;
    const unmatchedRepairs = repairs.length - matchedRepairs;

    const pendingReviews = discrepancies.filter(d => {
      const dReviews = this.store.getReviewsForDiscrepancy(d.id);
      return dReviews.length === 0 || dReviews.some(r => r.decision === 'pending');
    }).length;

    const completedReviews = discrepancies.filter(d => {
      const dReviews = this.store.getReviewsForDiscrepancy(d.id);
      return dReviews.length > 0 && dReviews.every(r => r.decision !== 'pending');
    }).length;

    const discrepanciesByType: Record<DiscrepancyType, number> = {
      duplicate_repair: 0,
      timeout_penalty: 0,
      malicious_rating: 0,
      mismatch: 0,
      missing_data: 0,
    };

    discrepancies.forEach(d => {
      if (d.autoDetected || true) {
        discrepanciesByType[d.type]++;
      }
    });

    const totalScoreDeductions = workerScores.reduce((sum, ws) => sum + ws.totalDeductions, 0);

    const finalRatings = ratings.map(r => {
      const workerAppeals = appeals.filter(a => a.ratingId === r.id && a.status !== 'pending');
      if (workerAppeals.length > 0) {
        const latestAppeal = workerAppeals[workerAppeals.length - 1];
        return { ...r, score: latestAppeal.finalScore };
      }
      return r;
    });

    const averageScore = finalRatings.length > 0
      ? finalRatings.reduce((sum, r) => sum + r.score, 0) / finalRatings.length
      : 0;

    const statistics: BatchStatistics = {
      totalRepairs: repairs.length,
      totalWorkers: workers.length,
      totalRatings: ratings.length,
      matchedRepairs,
      unmatchedRepairs,
      discrepancies: discrepancies.length,
      discrepanciesByType,
      pendingReviews,
      completedReviews,
      averageScore,
      totalScoreDeductions,
    };

    this.store.updateBatchStatistics(batchId, statistics);

    return {
      batchId,
      generatedAt: new Date().toISOString(),
      summary: statistics,
      discrepancies,
      reviews,
      appeals,
      workerScores,
    };
  }

  private calculateWorkerScores(
    workers: Worker[],
    discrepancies: Discrepancy[],
    reviews: ReviewRecord[],
    appeals: AppealHistory[],
    batchId: string
  ): ReportData['workerScores'] {
    return workers.map(worker => {
      const workerDiscrepancies = discrepancies.filter(
        d => d.workerId === worker.id
      );

      const workerReviews = workerDiscrepancies.flatMap(d =>
        this.store.getReviewsForDiscrepancy(d.id)
      );

      const approvedReviews = workerReviews.filter(r => r.decision === 'approved');

      const deductionDetails: Array<{ reason: string; amount: number }> = [];
      let totalDeductions = 0;

      approvedReviews.forEach(review => {
        if (review.scoreAdjustment !== undefined && review.scoreAdjustment < 0) {
          const discrepancy = discrepancies.find(d => d.id === review.discrepancyId);
          if (discrepancy) {
            deductionDetails.push({
              reason: this.getDiscrepancyTypeText(discrepancy.type) + ' (' + (discrepancy.repairNo || 'N/A') + ')',
              amount: Math.abs(review.scoreAdjustment),
            });
            totalDeductions += Math.abs(review.scoreAdjustment);
          }
        }
      });

      const workerAppeals = appeals.filter(
        a => a.workerId === worker.id && a.status === 'upheld'
      );

      workerAppeals.forEach(appeal => {
        const adjustment = appeal.originalScore - appeal.finalScore;
        if (adjustment > 0) {
          deductionDetails.push({
            reason: '申诉修正 (' + appeal.repairNo + ')',
            amount: adjustment,
          });
          totalDeductions += adjustment;
        }
      });

      return {
        workerId: worker.id,
        workerName: worker.name,
        originalScore: worker.baseScore,
        adjustedScore: Math.max(0, worker.baseScore - totalDeductions),
        totalDeductions,
        deductionDetails,
      };
    });
  }

  private getDiscrepancyTypeText(type: DiscrepancyType): string {
    const texts: Record<DiscrepancyType, string> = {
      duplicate_repair: '重复报修',
      timeout_penalty: '超时罚分',
      malicious_rating: '恶意评分',
      mismatch: '数据不匹配',
      missing_data: '数据缺失',
    };
    return texts[type] || type;
  }

  generateSummaryReport(batchId: string): string {
    const reportData = this.recalculateBatch(batchId);
    const filename = 'summary-' + batchId + '.json';
    const filePath = path.join(this.outputDir, filename);
    fs.writeFileSync(filePath, JSON.stringify(reportData, null, 2));
    return filePath;
  }

  generateDetailReport(batchId: string): string {
    const reportData = this.recalculateBatch(batchId);

    const rows = reportData.workerScores.map(ws => ({
      维修工ID: ws.workerId,
      维修工姓名: ws.workerName,
      原始分数: ws.originalScore,
      调整后分数: ws.adjustedScore,
      总扣分: ws.totalDeductions,
      扣分详情: ws.deductionDetails.map(d => d.reason + ': -' + d.amount + '分').join('; '),
    }));

    const parser = new Parser();
    const csv = parser.parse(rows);

    const filename = 'worker-scores-' + batchId + '.csv';
    const filePath = path.join(this.outputDir, filename);
    fs.writeFileSync(filePath, '\uFEFF' + csv);
    return filePath;
  }

  generateDiscrepancyReport(batchId: string): string {
    const reportData = this.recalculateBatch(batchId);

    const rows = reportData.discrepancies.map(d => {
      const reviews = this.store.getReviewsForDiscrepancy(d.id);
      const latestReview = reviews[reviews.length - 1];

      return {
        差异ID: d.id,
        类型: this.getDiscrepancyTypeText(d.type),
        严重程度: d.severity,
        报修单号: d.repairNo || '',
        维修工ID: d.workerId || '',
        描述: d.description,
        证据: d.evidence.join('; '),
        审核状态: latestReview ? this.getDecisionText(latestReview.decision) : '待审核',
        审核人: latestReview ? latestReview.reviewer : '',
        审核时间: latestReview ? latestReview.reviewedAt : '',
        审核意见: latestReview ? latestReview.comment : '',
        分数调整: latestReview?.scoreAdjustment || 0,
      };
    });

    const parser = new Parser();
    const csv = parser.parse(rows);

    const filename = 'discrepancies-' + batchId + '.csv';
    const filePath = path.join(this.outputDir, filename);
    fs.writeFileSync(filePath, '\uFEFF' + csv);
    return filePath;
  }

  generateAppealReport(batchId: string): string {
    const reportData = this.recalculateBatch(batchId);

    const rows = reportData.appeals.map(a => ({
      申诉ID: a.id,
      报修单号: a.repairNo,
      维修工ID: a.workerId,
      原始评分: a.originalScore,
      申诉后评分: a.finalScore,
      申诉人: a.appellant,
      申诉人角色: a.appellantRole,
      申诉原因: a.appealReason,
      申诉状态: this.getAppealStatusText(a.status),
      审核人: a.reviewer || '',
      审核意见: a.reviewComment || '',
      审核时间: a.reviewedAt || '',
    }));

    const parser = new Parser();
    const csv = parser.parse(rows);

    const filename = 'appeals-' + batchId + '.csv';
    const filePath = path.join(this.outputDir, filename);
    fs.writeFileSync(filePath, '\uFEFF' + csv);
    return filePath;
  }

  generateFullReport(batchId: string): {
    summary: string;
    details: string[];
  } {
    const summaryPath = this.generateSummaryReport(batchId);
    const detailPath = this.generateDetailReport(batchId);
    const discrepancyPath = this.generateDiscrepancyReport(batchId);
    const appealPath = this.generateAppealReport(batchId);

    return {
      summary: summaryPath,
      details: [detailPath, discrepancyPath, appealPath],
    };
  }

  private getDecisionText(decision: string): string {
    const texts: Record<string, string> = {
      approved: '通过',
      rejected: '驳回',
      supplement_required: '需补充材料',
      pending: '待处理',
    };
    return texts[decision] || decision;
  }

  private getAppealStatusText(status: string): string {
    const texts: Record<string, string> = {
      pending: '待处理',
      upheld: '申诉成立',
      overruled: '申诉驳回',
    };
    return texts[status] || status;
  }

  getReportFiles(): string[] {
    return fs.readdirSync(this.outputDir).filter(f => f.endsWith('.json') || f.endsWith('.csv'));
  }

  getReportFilePath(filename: string): string {
    return path.join(this.outputDir, filename);
  }
}

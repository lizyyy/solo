import dayjs from 'dayjs';
import { DataStore } from './dataStore';
import {
  RepairRecord,
  Worker,
  RatingRecord,
  Discrepancy,
  DiscrepancyType,
  BatchStatistics,
  createId,
} from './types';

export interface MatchingConfig {
  duplicateTimeWindowHours: number;
  timeoutThresholdHours: number;
  lowScoreThreshold: number;
  highFrequencyRatingCount: number;
  highFrequencyTimeWindowHours: number;
}

const DEFAULT_CONFIG: MatchingConfig = {
  duplicateTimeWindowHours: 24,
  timeoutThresholdHours: 48,
  lowScoreThreshold: 30,
  highFrequencyRatingCount: 5,
  highFrequencyTimeWindowHours: 1,
};

export class MatchingService {
  private store: DataStore;
  private config: MatchingConfig;

  constructor(store: DataStore, config?: Partial<MatchingConfig>) {
    this.store = store;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  runFullMatching(batchId: string): Discrepancy[] {
    const repairs = this.store.getRepairs(batchId);
    const workers = this.store.getWorkers(batchId);
    const ratings = this.store.getRatings(batchId);

    const rawDiscrepancies: Array<Omit<Discrepancy, 'id' | 'detectedAt'>> = [];

    rawDiscrepancies.push(...this.detectDuplicateRepairs(repairs));
    rawDiscrepancies.push(...this.detectTimeouts(repairs));
    rawDiscrepancies.push(...this.detectMaliciousRatings(ratings, repairs));
    rawDiscrepancies.push(...this.detectMismatches(repairs, workers, ratings));

    const discrepancies = rawDiscrepancies.map(d => this.store.addDiscrepancy(d));

    this.updateBatchStatistics(batchId, repairs, workers, ratings, discrepancies);

    return discrepancies;
  }

  detectDuplicateRepairs(repairs: RepairRecord[]): Array<Omit<Discrepancy, 'id' | 'detectedAt'>> {
    const discrepancies: Array<Omit<Discrepancy, 'id' | 'detectedAt'>> = [];
    const grouped = new Map<string, RepairRecord[]>();

    repairs.forEach(repair => {
      const key = `${repair.studentId}-${repair.location}-${repair.category}`;
      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      grouped.get(key)!.push(repair);
    });

    grouped.forEach(group => {
      if (group.length > 1) {
        const sorted = group.sort((a, b) =>
          dayjs(a.createdAt).valueOf() - dayjs(b.createdAt).valueOf()
        );

        for (let i = 1; i < sorted.length; i++) {
          const current = sorted[i];
          const first = sorted[0];
          const hoursDiff = dayjs(current.createdAt).diff(first.createdAt, 'hour');

          if (hoursDiff <= this.config.duplicateTimeWindowHours) {
            discrepancies.push({
              type: 'duplicate_repair',
              severity: 'medium',
              repairNo: current.repairNo,
              description: `疑似重复报修：与报修单 ${first.repairNo} 在 ${hoursDiff} 小时内提交，内容相似`,
              evidence: [
                `原始报修: ${first.repairNo} (${first.createdAt})`,
                `重复报修: ${current.repairNo} (${current.createdAt})`,
                `时间差: ${hoursDiff} 小时`,
                `地点: ${current.location}`,
                `类别: ${current.category}`,
              ],
              relatedRecordIds: group.map(r => r.id),
              autoDetected: true,
            });
          }
        }
      }
    });

    return discrepancies;
  }

  detectTimeouts(repairs: RepairRecord[]): Array<Omit<Discrepancy, 'id' | 'detectedAt'>> {
    const discrepancies: Array<Omit<Discrepancy, 'id' | 'detectedAt'>> = [];

    repairs.forEach(repair => {
      if (repair.status === 'completed' && repair.acceptedAt && repair.completedAt) {
        const expectedHours = repair.expectedCompletionTime || 24;
        const actualHours = dayjs(repair.completedAt).diff(repair.acceptedAt, 'hour');

        if (actualHours > expectedHours + this.config.timeoutThresholdHours) {
          const overtimeHours = actualHours - expectedHours;
          const penaltyPoints = Math.min(Math.floor(overtimeHours / 24) * 5, 20);

          discrepancies.push({
            type: 'timeout_penalty',
            severity: overtimeHours > 72 ? 'high' : 'medium',
            repairNo: repair.repairNo,
            workerId: repair.workerId,
            description: `维修超时：预计 ${expectedHours} 小时，实际 ${actualHours} 小时，超时 ${overtimeHours} 小时，建议扣 ${penaltyPoints} 分`,
            evidence: [
              `接单时间: ${repair.acceptedAt}`,
              `完成时间: ${repair.completedAt}`,
              `预计时长: ${expectedHours} 小时`,
              `实际时长: ${actualHours} 小时`,
              `超时: ${overtimeHours} 小时`,
              `建议扣分: ${penaltyPoints} 分`,
            ],
            relatedRecordIds: [repair.id],
            autoDetected: true,
          });
        }
      }
    });

    return discrepancies;
  }

  detectMaliciousRatings(ratings: RatingRecord[], repairs: RepairRecord[]): Array<Omit<Discrepancy, 'id' | 'detectedAt'>> {
    const discrepancies: Array<Omit<Discrepancy, 'id' | 'detectedAt'>> = [];

    const ratingsByRepair = new Map<string, RatingRecord[]>();
    ratings.forEach(r => {
      if (!ratingsByRepair.has(r.repairNo)) {
        ratingsByRepair.set(r.repairNo, []);
      }
      ratingsByRepair.get(r.repairNo)!.push(r);
    });

    ratingsByRepair.forEach((repairRatings, repairNo) => {
      const lowScores = repairRatings.filter(r => r.score <= this.config.lowScoreThreshold);
      const repair = repairs.find(r => r.repairNo === repairNo);

      if (lowScores.length > 0) {
        const recentLowScores = lowScores.sort((a, b) =>
          dayjs(b.ratedAt).valueOf() - dayjs(a.ratedAt).valueOf()
        );

        if (recentLowScores.length >= 3) {
          discrepancies.push({
            type: 'malicious_rating',
            severity: 'high',
            repairNo,
            workerId: repair?.workerId,
            ratingId: recentLowScores[0].id,
            description: `疑似恶意评分：该报修单有 ${recentLowScores.length} 条低分评价（≤${this.config.lowScoreThreshold}分）`,
            evidence: recentLowScores.map(r =>
              `评分: ${r.score}/${r.maxScore}, 评分人: ${r.ratedBy || '未知'}, 时间: ${r.ratedAt}, 原因: ${r.reason || '无'}`
            ),
            relatedRecordIds: recentLowScores.map(r => r.id),
            autoDetected: true,
          });
        }
      }
    });

    const ratingsByStudent = new Map<string, RatingRecord[]>();
    ratings.forEach(r => {
      if (r.ratedBy) {
        if (!ratingsByStudent.has(r.ratedBy)) {
          ratingsByStudent.set(r.ratedBy, []);
        }
        ratingsByStudent.get(r.ratedBy)!.push(r);
      }
    });

    ratingsByStudent.forEach((studentRatings, studentId) => {
      const sorted = studentRatings.sort((a, b) =>
        dayjs(a.ratedAt).valueOf() - dayjs(b.ratedAt).valueOf()
      );

      for (let i = 0; i <= sorted.length - this.config.highFrequencyRatingCount; i++) {
        const window = sorted.slice(i, i + this.config.highFrequencyRatingCount);
        const timeSpan = dayjs(window[window.length - 1].ratedAt).diff(
          window[0].ratedAt,
          'hour'
        );

        if (timeSpan <= this.config.highFrequencyTimeWindowHours) {
          const lowCount = window.filter(r => r.score <= this.config.lowScoreThreshold).length;
          if (lowCount >= this.config.highFrequencyRatingCount * 0.6) {
            discrepancies.push({
              type: 'malicious_rating',
              severity: 'high',
              description: `疑似恶意评分：用户 ${studentId} 在 ${timeSpan} 小时内提交 ${this.config.highFrequencyRatingCount} 条评价，其中 ${lowCount} 条为低分`,
              evidence: window.map(r =>
                `报修单: ${r.repairNo}, 评分: ${r.score}/${r.maxScore}, 时间: ${r.ratedAt}`
              ),
              relatedRecordIds: window.map(r => r.id),
              autoDetected: true,
            });
            break;
          }
        }
      }
    });

    return discrepancies;
  }

  detectMismatches(
    repairs: RepairRecord[],
    workers: Worker[],
    ratings: RatingRecord[]
  ): Array<Omit<Discrepancy, 'id' | 'detectedAt'>> {
    const discrepancies: Array<Omit<Discrepancy, 'id' | 'detectedAt'>> = [];
    const workerIds = new Set(workers.map(w => w.id));
    const repairNos = new Set(repairs.map(r => r.repairNo));

    ratings.forEach(rating => {
      if (rating.workerId && !workerIds.has(rating.workerId)) {
        discrepancies.push({
          type: 'mismatch',
          severity: 'low',
          ratingId: rating.id,
          workerId: rating.workerId,
          repairNo: rating.repairNo,
          description: `评分记录中的维修工ID ${rating.workerId} 在维修工数据中不存在`,
          evidence: [`评分记录: ${rating.id}`, `维修工ID: ${rating.workerId}`, `报修单号: ${rating.repairNo}`],
          relatedRecordIds: [rating.id],
          autoDetected: true,
        });
      }

      if (rating.repairNo && !repairNos.has(rating.repairNo)) {
        discrepancies.push({
          type: 'missing_data',
          severity: 'medium',
          ratingId: rating.id,
          repairNo: rating.repairNo,
          description: `评分记录关联的报修单 ${rating.repairNo} 在报修数据中不存在`,
          evidence: [`评分记录: ${rating.id}`, `报修单号: ${rating.repairNo}`],
          relatedRecordIds: [rating.id],
          autoDetected: true,
        });
      }
    });

    repairs.forEach(repair => {
      if (repair.workerId && !workerIds.has(repair.workerId)) {
        discrepancies.push({
          type: 'mismatch',
          severity: 'medium',
          repairNo: repair.repairNo,
          workerId: repair.workerId,
          description: `报修单 ${repair.repairNo} 分配的维修工ID ${repair.workerId} 在维修工数据中不存在`,
          evidence: [`报修单: ${repair.repairNo}`, `维修工ID: ${repair.workerId}`],
          relatedRecordIds: [repair.id],
          autoDetected: true,
        });
      }
    });

    return discrepancies;
  }

  private updateBatchStatistics(
    batchId: string,
    repairs: RepairRecord[],
    workers: Worker[],
    ratings: RatingRecord[],
    discrepancies: Discrepancy[]
  ): void {
    const matchedRepairs = repairs.filter(r => r.workerId).length;
    const unmatchedRepairs = repairs.length - matchedRepairs;

    const pendingReviews = discrepancies.filter(d => {
      const reviews = this.store.getReviewsForDiscrepancy(d.id);
      return reviews.length === 0 || reviews.some(r => r.decision === 'pending');
    }).length;

    const completedReviews = discrepancies.filter(d => {
      const reviews = this.store.getReviewsForDiscrepancy(d.id);
      return reviews.length > 0 && reviews.every(r => r.decision !== 'pending');
    }).length;

    const discrepanciesByType: Record<DiscrepancyType, number> = {
      duplicate_repair: 0,
      timeout_penalty: 0,
      malicious_rating: 0,
      mismatch: 0,
      missing_data: 0,
    };

    discrepancies.forEach(d => {
      discrepanciesByType[d.type]++;
    });

    const totalScoreDeductions = discrepancies
      .filter(d => d.type === 'timeout_penalty')
      .reduce((sum, d) => {
        const match = d.description.match(/建议扣 (\d+) 分/);
        return sum + (match ? parseInt(match[1]) : 0);
      }, 0);

    const stats: BatchStatistics = {
      totalRepairs: repairs.length,
      totalWorkers: workers.length,
      totalRatings: ratings.length,
      matchedRepairs,
      unmatchedRepairs,
      discrepancies: discrepancies.length,
      discrepanciesByType,
      pendingReviews,
      completedReviews,
      averageScore: ratings.length > 0
        ? ratings.reduce((sum, r) => sum + r.score, 0) / ratings.length
        : 0,
      totalScoreDeductions,
    };

    this.store.updateBatchStatistics(batchId, stats);
  }
}

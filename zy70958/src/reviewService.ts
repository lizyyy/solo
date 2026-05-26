import { DataStore } from './dataStore';
import {
  ReviewRecord,
  ReviewDecision,
  Discrepancy,
  AppealHistory,
  AppealStatus,
  RatingRecord,
  Worker,
} from './types';

export class ReviewService {
  private store: DataStore;

  constructor(store: DataStore) {
    this.store = store;
  }

  reviewDiscrepancy(
    discrepancyId: string,
    decision: ReviewDecision,
    reviewer: string,
    comment: string,
    scoreAdjustment?: number,
    adjustmentReason?: string
  ): ReviewRecord {
    const review = this.store.addReview({
      discrepancyId,
      decision,
      reviewer,
      comment,
      reviewedAt: new Date().toISOString(),
      scoreAdjustment,
      adjustmentReason,
    });

    this.applyReviewEffect(discrepancyId, decision, scoreAdjustment);

    return review;
  }

  private applyReviewEffect(
    discrepancyId: string,
    decision: ReviewDecision,
    scoreAdjustment?: number
  ): void {
    const discrepancy = this.store.getDiscrepancies().find(d => d.id === discrepancyId);
    if (!discrepancy) return;

    if (decision === 'approved' && scoreAdjustment !== undefined && discrepancy.workerId) {
      this.adjustWorkerScore(discrepancy.workerId, scoreAdjustment, discrepancy.id);
    }

    if (decision === 'rejected' && discrepancy.ratingId) {
      this.store.updateRating(discrepancy.ratingId, { isAppealed: true, appealStatus: 'upheld' });
    }
  }

  private adjustWorkerScore(workerId: string, adjustment: number, discrepancyId: string): void {
    const worker = this.store.getWorkers().find(w => w.id === workerId);
    if (worker) {
      const newScore = Math.max(0, Math.min(100, worker.currentScore + adjustment));
      this.store.updateWorker(workerId, { currentScore: newScore });
    }
  }

  submitAppeal(
    ratingId: string,
    appellant: string,
    appellantRole: 'worker' | 'student' | 'admin',
    appealReason: string,
    evidence: string[] = []
  ): AppealHistory {
    const rating = this.store.getRatings().find(r => r.id === ratingId);
    if (!rating) {
      throw new Error(`评分记录 ${ratingId} 不存在`);
    }

    const appeal = this.store.addAppeal({
      ratingId,
      repairNo: rating.repairNo,
      workerId: rating.workerId,
      originalScore: rating.score,
      finalScore: rating.score,
      appellant,
      appellantRole,
      appealReason,
      evidence,
      status: 'pending',
      createdAt: new Date().toISOString(),
      relatedDiscrepancyIds: this.store
        .getDiscrepancies()
        .filter(d => d.ratingId === ratingId)
        .map(d => d.id),
    });

    this.store.updateRating(ratingId, { isAppealed: true, appealStatus: 'pending' });

    return appeal;
  }

  reviewAppeal(
    appealId: string,
    reviewer: string,
    status: AppealStatus,
    reviewComment: string,
    newScore?: number
  ): AppealHistory {
    const appeals = this.store.getAppeals();
    const appeal = appeals.find(a => a.id === appealId);
    if (!appeal) {
      throw new Error(`申诉记录 ${appealId} 不存在`);
    }

    appeal.status = status;
    appeal.reviewer = reviewer;
    appeal.reviewComment = reviewComment;
    appeal.reviewedAt = new Date().toISOString();

    if (newScore !== undefined) {
      appeal.appealedScore = appeal.finalScore;
      appeal.finalScore = newScore;
      this.store.updateRating(appeal.ratingId, { score: newScore, appealStatus: status });
    } else {
      this.store.updateRating(appeal.ratingId, { appealStatus: status });
    }

    return appeal;
  }

  getAppealTrail(ratingId: string): Array<{
    type: 'rating' | 'appeal' | 'review';
    timestamp: string;
    actor: string;
    action: string;
    score?: number;
    comment?: string;
  }> {
    const trail: Array<{
      type: 'rating' | 'appeal' | 'review';
      timestamp: string;
      actor: string;
      action: string;
      score?: number;
      comment?: string;
    }> = [];

    const rating = this.store.getRatings().find(r => r.id === ratingId);
    if (rating) {
      trail.push({
        type: 'rating',
        timestamp: rating.ratedAt,
        actor: rating.ratedBy || '未知用户',
        action: '提交评分',
        score: rating.score,
        comment: rating.reason,
      });
    }

    const appeals = this.store
      .getAppeals()
      .filter(a => a.ratingId === ratingId)
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

    appeals.forEach(appeal => {
      trail.push({
        type: 'appeal',
        timestamp: appeal.createdAt,
        actor: appeal.appellant,
        action: `提交申诉 (${appeal.appellantRole})`,
        comment: appeal.appealReason,
      });

      if (appeal.reviewedAt) {
        trail.push({
          type: 'review',
          timestamp: appeal.reviewedAt,
          actor: appeal.reviewer || '审核员',
          action: this.getAppealActionText(appeal.status),
          score: appeal.finalScore,
          comment: appeal.reviewComment,
        });
      }
    });

    return trail.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  }

  private getAppealActionText(status: AppealStatus): string {
    switch (status) {
      case 'upheld':
        return '申诉成立，修正评分';
      case 'overruled':
        return '申诉驳回，维持原评分';
      case 'pending':
        return '待审核';
      default:
        return '处理中';
    }
  }

  getDiscrepancyExplanation(discrepancyId: string): {
    discrepancy: Discrepancy;
    reviews: ReviewRecord[];
    relatedRecords: any[];
    impact: string;
  } {
    const discrepancy = this.store.getDiscrepancies().find(d => d.id === discrepancyId);
    if (!discrepancy) {
      throw new Error(`差异记录 ${discrepancyId} 不存在`);
    }

    const reviews = this.store.getReviewsForDiscrepancy(discrepancyId);
    const relatedRecords: any[] = [];

    if (discrepancy.repairNo) {
      const repair = this.store.getRepairs().find(r => r.repairNo === discrepancy.repairNo);
      if (repair) relatedRecords.push({ type: 'repair', data: repair });
    }

    if (discrepancy.workerId) {
      const worker = this.store.getWorkers().find(w => w.id === discrepancy.workerId);
      if (worker) relatedRecords.push({ type: 'worker', data: worker });
    }

    if (discrepancy.ratingId) {
      const rating = this.store.getRatings().find(r => r.id === discrepancy.ratingId);
      if (rating) relatedRecords.push({ type: 'rating', data: rating });
    }

    let impact = '';
    const lastReview = reviews[reviews.length - 1];
    if (lastReview) {
      switch (lastReview.decision) {
        case 'approved':
          impact = `已${lastReview.scoreAdjustment && lastReview.scoreAdjustment < 0 ? '扣' : lastReview.scoreAdjustment && lastReview.scoreAdjustment > 0 ? '加' : ''}${Math.abs(lastReview.scoreAdjustment || 0)}分，${lastReview.adjustmentReason || '按规则处理'}`;
          break;
        case 'rejected':
          impact = '不予处理，维持原状';
          break;
        case 'supplement_required':
          impact = '需要补充材料后再审';
          break;
        case 'pending':
          impact = '待复核';
          break;
      }
    } else {
      impact = '待复核';
    }

    return { discrepancy, reviews, relatedRecords, impact };
  }

  getPendingDiscrepancies(batchId?: string): Discrepancy[] {
    return this.store.getDiscrepancies(batchId).filter(d => {
      const reviews = this.store.getReviewsForDiscrepancy(d.id);
      return reviews.length === 0 || reviews.every(r => r.decision === 'pending');
    });
  }

  getDecisionHistory(discrepancyId: string): ReviewRecord[] {
    return this.store.getReviewsForDiscrepancy(discrepancyId).sort(
      (a, b) => new Date(a.reviewedAt).getTime() - new Date(b.reviewedAt).getTime()
    );
  }
}

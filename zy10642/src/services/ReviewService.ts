import { QualityReview, ReviewStatus, CreateAppealRequest, ReviewAppealRequest, HistoryRecord, DeductionItem, AppealMaterial } from '../models/types';
import { reviewStore } from '../models/store';

export class StateValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StateValidationError';
  }
}

export class ReviewService {
  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  private createHistoryRecord(action: string, operatorId: string, operatorName: string, options: {
    comment?: string;
    previousStatus?: ReviewStatus;
    newStatus?: ReviewStatus;
    previousScore?: number;
    newScore?: number;
    previousDeductions?: DeductionItem[];
  }): HistoryRecord {
    return {
      id: this.generateId(),
      action,
      operatorId,
      operatorName,
      ...options,
      createdAt: new Date()
    };
  }

  canSubmitAppeal(review: QualityReview): boolean {
    return review.status === ReviewStatus.SCORED;
  }

  canReviewAppeal(review: QualityReview): boolean {
    return review.status === ReviewStatus.APPEALING;
  }

  createReview(data: Omit<QualityReview, 'id' | 'status' | 'appealMaterials' | 'history' | 'createdAt' | 'updatedAt'>): QualityReview {
    const now = new Date();
    const historyRecord = this.createHistoryRecord('质检评分', data.inspectorId, data.inspectorName, {
      newStatus: ReviewStatus.SCORED,
      newScore: data.currentScore
    });

    const review: QualityReview = {
      id: this.generateId(),
      ...data,
      status: ReviewStatus.SCORED,
      appealMaterials: [],
      history: [historyRecord],
      createdAt: now,
      updatedAt: now
    };

    reviewStore.add(review);
    return review;
  }

  submitAppeal(reviewId: string, request: CreateAppealRequest, operatorId: string, operatorName: string): QualityReview {
    const review = reviewStore.get(reviewId);
    if (!review) {
      throw new StateValidationError('质检记录不存在');
    }

    if (!this.canSubmitAppeal(review)) {
      throw new StateValidationError(`当前状态"${review.status}"不允许提交复议`);
    }

    const materials: AppealMaterial[] = request.materials.map(m => ({
      ...m,
      id: this.generateId(),
      uploadedAt: new Date()
    }));

    const historyRecord = this.createHistoryRecord('提交复议', operatorId, operatorName, {
      comment: request.reason,
      previousStatus: review.status,
      newStatus: ReviewStatus.APPEALING
    });

    review.status = ReviewStatus.APPEALING;
    review.appealReason = request.reason;
    review.appealMaterials = materials;
    review.history.push(historyRecord);
    review.updatedAt = new Date();

    reviewStore.update(reviewId, review);
    return review;
  }

  reviewAppeal(reviewId: string, request: ReviewAppealRequest): QualityReview {
    const review = reviewStore.get(reviewId);
    if (!review) {
      throw new StateValidationError('质检记录不存在');
    }

    if (!this.canReviewAppeal(review)) {
      throw new StateValidationError(`当前状态"${review.status}"不允许复核`);
    }

    const previousStatus = review.status;
    const previousScore = review.currentScore;
    const previousDeductions = [...review.deductions];

    if (request.action === 'approve') {
      if (request.newScore === undefined) {
        throw new StateValidationError('通过复议时必须提供新分数');
      }

      review.status = ReviewStatus.SCORE_CHANGED;
      review.currentScore = request.newScore;
      if (request.newDeductions) {
        review.deductions = request.newDeductions.map(d => ({
          ...d,
          id: this.generateId(),
          createdAt: new Date()
        }));
      }
      review.reviewerId = request.reviewerId;
      review.reviewerName = request.reviewerName;
      review.reviewComment = request.comment;

      const historyRecord = this.createHistoryRecord('复议通过-改分', request.reviewerId, request.reviewerName, {
        comment: request.comment,
        previousStatus,
        newStatus: ReviewStatus.SCORE_CHANGED,
        previousScore,
        newScore: request.newScore,
        previousDeductions
      });
      review.history.push(historyRecord);

    } else {
      review.status = ReviewStatus.MAINTAINED;
      review.reviewerId = request.reviewerId;
      review.reviewerName = request.reviewerName;
      review.reviewComment = request.comment;

      const historyRecord = this.createHistoryRecord('复议驳回-维持原分', request.reviewerId, request.reviewerName, {
        comment: request.comment,
        previousStatus,
        newStatus: ReviewStatus.MAINTAINED
      });
      review.history.push(historyRecord);
    }

    review.updatedAt = new Date();
    reviewStore.update(reviewId, review);
    return review;
  }

  getReview(reviewId: string): QualityReview | undefined {
    return reviewStore.get(reviewId);
  }

  listReviews(filters?: { status?: ReviewStatus; customerServiceId?: string }): QualityReview[] {
    let reviews = reviewStore.getAll();
    
    if (filters?.status) {
      reviews = reviews.filter(r => r.status === filters.status);
    }
    if (filters?.customerServiceId) {
      reviews = reviews.filter(r => r.customerServiceId === filters.customerServiceId);
    }

    return reviews.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
  }

  exportToCSV(reviews: QualityReview[]): any[] {
    return reviews.map(review => {
      const originalDeductions = review.history.find(h => h.previousDeductions)?.previousDeductions || review.deductions;
      const deductionDescriptions = review.deductions.map(d => `${d.category}: ${d.description}(-${d.points}分)`).join('; ');
      const originalDeductionDescriptions = originalDeductions.map(d => `${d.category}: ${d.description}(-${d.points}分)`).join('; ');
      
      return {
        质检ID: review.id,
        会话ID: review.sessionId,
        客服姓名: review.customerServiceName,
        质检员姓名: review.inspectorName,
        原始分数: review.originalScore,
        当前分数: review.currentScore,
        状态: review.status,
        原始扣分原因: originalDeductionDescriptions,
        当前扣分原因: deductionDescriptions,
        复议原因: review.appealReason || '',
        复核人: review.reviewerName || '',
        复核意见: review.reviewComment || '',
        创建时间: review.createdAt.toISOString(),
        更新时间: review.updatedAt.toISOString()
      };
    });
  }
}

export const reviewService = new ReviewService();

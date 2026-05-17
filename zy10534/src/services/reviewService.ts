import { store } from '../store/memoryStore';
import { ReviewStatus, ScoreChangeType, ReviewRecord, EvaluationSample, EvaluationBatch, ReviewReport } from '../types';

export class ReviewService {
  static calculateScoreChange(originalScore: number, revisedScore: number): {
    type: ScoreChangeType;
    difference: number;
  } {
    const difference = revisedScore - originalScore;
    let type: ScoreChangeType;
    if (difference > 0) {
      type = ScoreChangeType.INCREASE;
    } else if (difference < 0) {
      type = ScoreChangeType.DECREASE;
    } else {
      type = ScoreChangeType.NO_CHANGE;
    }
    return { type, difference };
  }

  static async createReview(data: {
    sampleId: string;
    batchId: string;
    reviewerId: string;
    reviewerName: string;
    reviewOpinion: string;
    revisedScore?: number;
    processingBasis?: string;
    rawInput?: any;
  }): Promise<ReviewRecord> {
    const sample = store.getSample(data.sampleId);
    if (!sample) {
      throw new Error('样本不存在');
    }

    const batch = store.getBatch(data.batchId);
    if (!batch) {
      throw new Error('评测批次不存在');
    }

    let reviewData: any = {
      sampleId: data.sampleId,
      batchId: data.batchId,
      reviewerId: data.reviewerId,
      reviewerName: data.reviewerName,
      reviewOpinion: data.reviewOpinion,
      status: ReviewStatus.UNDER_REVIEW,
      processingBasis: data.processingBasis,
      rawInput: data.rawInput
    };

    if (data.revisedScore !== undefined) {
      const scoreChange = this.calculateScoreChange(sample.originalScore, data.revisedScore);
      reviewData.revisedScore = data.revisedScore;
      reviewData.scoreChangeType = scoreChange.type;
      reviewData.scoreDifference = scoreChange.difference;
      reviewData.status = ReviewStatus.REVISED;

      store.updateSample(data.sampleId, { currentScore: data.revisedScore });
      this.updateBatchStats(data.batchId);
    } else {
      reviewData.status = ReviewStatus.REVIEWED;
      this.updateBatchStats(data.batchId);
    }

    return store.createReview(reviewData);
  }

  static async updateReviewStatus(reviewId: string, status: ReviewStatus, updatedBy: string): Promise<ReviewRecord> {
    const review = store.getReview(reviewId);
    if (!review) {
      throw new Error('复核记录不存在');
    }

    const updated = store.updateReview(reviewId, { status });
    if (!updated) {
      throw new Error('更新失败');
    }

    this.updateBatchStats(review.batchId);
    return updated;
  }

  static async manualCorrection(
    reviewId: string,
    data: {
      revisedScore: number;
      reviewOpinion: string;
      reviewerId: string;
      reviewerName: string;
      processingBasis?: string;
    }
  ): Promise<ReviewRecord> {
    const review = store.getReview(reviewId);
    if (!review) {
      throw new Error('复核记录不存在');
    }

    const sample = store.getSample(review.sampleId);
    if (!sample) {
      throw new Error('样本不存在');
    }

    const scoreChange = this.calculateScoreChange(sample.originalScore, data.revisedScore);

    const updated = store.updateReview(reviewId, {
      revisedScore: data.revisedScore,
      reviewOpinion: data.reviewOpinion,
      reviewerId: data.reviewerId,
      reviewerName: data.reviewerName,
      scoreChangeType: scoreChange.type,
      scoreDifference: scoreChange.difference,
      status: ReviewStatus.REVISED,
      processingBasis: data.processingBasis
    });

    if (!updated) {
      throw new Error('更新失败');
    }

    store.updateSample(review.sampleId, { currentScore: data.revisedScore });
    this.updateBatchStats(review.batchId);

    return updated;
  }

  static async handleException(
    reviewId: string,
    exceptionMessage: string,
    rawInput: any,
    processingBasis: string
  ): Promise<ReviewRecord> {
    const review = store.getReview(reviewId);
    if (!review) {
      throw new Error('复核记录不存在');
    }

    const updated = store.updateReview(reviewId, {
      exceptionMessage,
      rawInput,
      processingBasis,
      status: ReviewStatus.CANCELLED
    });

    if (!updated) {
      throw new Error('更新失败');
    }

    return updated;
  }

  private static updateBatchStats(batchId: string): void {
    const samples = store.getSamplesByBatch(batchId);
    const reviews = store.getReviewsByBatch(batchId);

    const reviewedCount = reviews.filter(r => r.status !== ReviewStatus.PENDING && r.status !== ReviewStatus.UNDER_REVIEW).length;
    const revisedCount = reviews.filter(r => r.status === ReviewStatus.REVISED && r.revisedScore !== undefined).length;

    const originalScores = samples.map(s => s.originalScore);
    const revisedScores = reviews
      .filter(r => r.revisedScore !== undefined)
      .map(r => r.revisedScore!);

    const averageOriginalScore = originalScores.length > 0
      ? originalScores.reduce((a, b) => a + b, 0) / originalScores.length
      : 0;

    const allScores = samples.map(s => {
      const review = reviews.find(r => r.sampleId === s.sampleId && r.revisedScore !== undefined);
      return review ? review.revisedScore! : s.originalScore;
    });

    const averageRevisedScore = allScores.length > 0
      ? allScores.reduce((a, b) => a + b, 0) / allScores.length
      : 0;

    store.updateBatch(batchId, {
      totalSamples: samples.length,
      reviewedCount,
      revisedCount,
      averageOriginalScore,
      averageRevisedScore
    });
  }

  static async generateReport(batchId: string, generatedBy: string): Promise<ReviewReport> {
    const batch = store.getBatch(batchId);
    if (!batch) {
      throw new Error('评测批次不存在');
    }

    const samples = store.getSamplesByBatch(batchId);
    const reviews = store.getReviewsByBatch(batchId);

    const revisedReviews = reviews.filter(r => r.revisedScore !== undefined);
    const pendingCount = samples.length - reviews.filter(r => r.status !== ReviewStatus.PENDING).length;
    const scoreChangeRate = samples.length > 0 ? revisedReviews.length / samples.length : 0;

    const details = revisedReviews.map(r => {
      const sample = samples.find(s => s.sampleId === r.sampleId);
      return {
        sampleId: r.sampleId,
        originalScore: sample?.originalScore || 0,
        revisedScore: r.revisedScore!,
        scoreDifference: r.scoreDifference || 0,
        reviewer: r.reviewerName,
        reviewOpinion: r.reviewOpinion,
        reviewTime: r.createdAt
      };
    });

    const report = store.createReport({
      batchId,
      generatedBy,
      summary: {
        totalSamples: samples.length,
        reviewedCount: reviews.filter(r => r.status !== ReviewStatus.PENDING).length,
        revisedCount: revisedReviews.length,
        pendingCount,
        averageOriginalScore: batch.averageOriginalScore,
        averageRevisedScore: batch.averageRevisedScore,
        scoreChangeRate
      },
      details
    });

    return report;
  }

  static getReview(reviewId: string): ReviewRecord | undefined {
    return store.getReview(reviewId);
  }

  static getReviewsByBatch(batchId: string): ReviewRecord[] {
    return store.getReviewsByBatch(batchId);
  }

  static getReviewsBySample(sampleId: string): ReviewRecord[] {
    return store.getReviewsBySample(sampleId);
  }

  static getSampleWithReviews(sampleId: string): { sample: EvaluationSample; reviews: ReviewRecord[] } | undefined {
    const sample = store.getSample(sampleId);
    if (!sample) return undefined;
    const reviews = store.getReviewsBySample(sampleId);
    return { sample, reviews };
  }

  static getAllBatches(): EvaluationBatch[] {
    return store.getAllBatches();
  }

  static getBatch(batchId: string): EvaluationBatch | undefined {
    return store.getBatch(batchId);
  }

  static getSample(sampleId: string): EvaluationSample | undefined {
    return store.getSample(sampleId);
  }

  static getSamplesByBatch(batchId: string): EvaluationSample[] {
    return store.getSamplesByBatch(batchId);
  }
}

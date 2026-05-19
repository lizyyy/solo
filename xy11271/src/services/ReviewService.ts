import { TranscriptRepository } from "../repositories/TranscriptRepository";
import { ReviewRecordRepository } from "../repositories/ReviewRecordRepository";
import { QualityIssueRepository } from "../repositories/QualityIssueRepository";
import { ReviewResult, ReviewStatus } from "../models/ReviewRecord";
import { IssueStatus } from "../models/QualityIssue";

export interface ReviewRequest {
  transcriptId: string;
  reviewerId?: string;
  reviewerName?: string;
  result: ReviewResult;
  score: number;
  comments?: string;
  correctionNotes?: string;
  issueDecisions?: Array<{
    issueId: string;
    status: IssueStatus;
  }>;
}

export interface ReviewSummary {
  total: number;
  pending: number;
  completed: number;
  passRate: number;
  averageScore: number;
}

export class ReviewService {
  private transcriptRepo = new TranscriptRepository();
  private reviewRepo = new ReviewRecordRepository();
  private issueRepo = new QualityIssueRepository();

  async startReview(transcriptId: string, reviewerId?: string, reviewerName?: string) {
    const transcript = await this.transcriptRepo.findById(transcriptId);
    if (!transcript) {
      throw new Error(`Transcript not found: ${transcriptId}`);
    }

    const review = await this.reviewRepo.create({
      transcriptId,
      reviewerId,
      reviewerName,
      status: "in_progress" as ReviewStatus,
      score: 0,
    });

    return review;
  }

  async submitReview(request: ReviewRequest) {
    const { transcriptId, reviewerId, reviewerName, result, score, comments, correctionNotes, issueDecisions } =
      request;

    if (issueDecisions) {
      for (const decision of issueDecisions) {
        await this.issueRepo.updateStatus(decision.issueId, decision.status);
      }
    }

    const existingReviews = await this.reviewRepo.findByTranscriptId(transcriptId);
    const inProgressReview = existingReviews.find((r) => r.status === "in_progress");

    if (inProgressReview) {
      await this.reviewRepo.update(inProgressReview.id, {
        result,
        score,
        comments,
        correctionNotes,
        status: "completed" as ReviewStatus,
        reviewedAt: new Date(),
      });
      await this.transcriptRepo.update(transcriptId, { status: "reviewed" });
      return this.reviewRepo.findById(inProgressReview.id);
    } else {
      const review = await this.reviewRepo.create({
        transcriptId,
        reviewerId,
        reviewerName,
        result,
        score,
        comments,
        correctionNotes,
        status: "completed" as ReviewStatus,
        reviewedAt: new Date(),
      });
      await this.transcriptRepo.update(transcriptId, { status: "reviewed" });
      return review;
    }
  }

  async getReviewList(status?: ReviewStatus, result?: ReviewResult, limit: number = 100, offset: number = 0) {
    return this.reviewRepo.list(status, result, limit, offset);
  }

  async getReviewById(reviewId: string) {
    return this.reviewRepo.findById(reviewId);
  }

  async getReviewsByTranscript(transcriptId: string) {
    return this.reviewRepo.findByTranscriptId(transcriptId);
  }

  async getSummary(): Promise<ReviewSummary> {
    const total = await this.reviewRepo.count();
    const pending = await this.reviewRepo.count("pending");
    const completed = await this.reviewRepo.count("completed");
    const passCount = await this.reviewRepo.count(undefined, "pass");

    const passRate = completed > 0 ? (passCount / completed) * 100 : 0;

    const allReviews = await this.reviewRepo.list("completed");
    const totalScore = allReviews.reduce((sum, r) => sum + r.score, 0);
    const averageScore = allReviews.length > 0 ? totalScore / allReviews.length : 0;

    return {
      total,
      pending,
      completed,
      passRate: Math.round(passRate * 100) / 100,
      averageScore: Math.round(averageScore * 100) / 100,
    };
  }

  async getPendingReviews(limit: number = 50) {
    const transcripts = await this.transcriptRepo.list({ status: "processed" }, limit);
    return transcripts;
  }
}

import { DataStore } from './dataStore';
import { MatchingService } from './matchingService';
import { ReviewService } from './reviewService';
import { ReportService } from './reportService';
import { createId, ReviewDecision, AppealStatus } from './types';

export class ReconciliationService {
  private store: DataStore;
  private matchingService: MatchingService;
  private reviewService: ReviewService;
  private reportService: ReportService;

  constructor(dataDir?: string, reportDir?: string) {
    this.store = new DataStore(dataDir);
    this.matchingService = new MatchingService(this.store);
    this.reviewService = new ReviewService(this.store);
    this.reportService = new ReportService(this.store, reportDir);
  }

  async createBatch(
    name: string,
    createdBy: string,
    repairsCsvPath?: string,
    workersJsonPath?: string,
    ratingsJsonPath?: string
  ): Promise<{
    batchId: string;
    repairsCount: number;
    workersCount: number;
    ratingsCount: number;
  }> {
    const batch = this.store.addBatch({
      name,
      createdAt: new Date().toISOString(),
      createdBy,
      status: 'importing',
      statistics: {
        totalRepairs: 0,
        totalWorkers: 0,
        totalRatings: 0,
        matchedRepairs: 0,
        unmatchedRepairs: 0,
        discrepancies: 0,
        discrepanciesByType: {
          duplicate_repair: 0,
          timeout_penalty: 0,
          malicious_rating: 0,
          mismatch: 0,
          missing_data: 0,
        },
        pendingReviews: 0,
        completedReviews: 0,
        averageScore: 0,
        totalScoreDeductions: 0,
      },
    });

    let repairsCount = 0;
    let workersCount = 0;
    let ratingsCount = 0;

    if (repairsCsvPath) {
      const repairs = await this.store.importRepairsFromCSV(repairsCsvPath, batch.id);
      repairsCount = repairs.length;
      batch.repairImportId = createId();
    }

    if (workersJsonPath) {
      const workers = await this.store.importWorkersFromJSON(workersJsonPath, batch.id);
      workersCount = workers.length;
      batch.workerImportId = createId();
    }

    if (ratingsJsonPath) {
      const ratings = await this.store.importRatingsFromJSON(ratingsJsonPath, batch.id);
      ratingsCount = ratings.length;
      batch.ratingImportId = createId();
    }

    this.store.updateBatchStatus(batch.id, 'matching');

    return { batchId: batch.id, repairsCount, workersCount, ratingsCount };
  }

  runMatching(batchId: string) {
    this.store.updateBatchStatus(batchId, 'matching');
    const discrepancies = this.matchingService.runFullMatching(batchId);
    this.store.updateBatchStatus(batchId, 'reviewing');
    return discrepancies;
  }

  reviewDiscrepancy(
    discrepancyId: string,
    decision: ReviewDecision,
    reviewer: string,
    comment: string,
    scoreAdjustment?: number,
    adjustmentReason?: string
  ) {
    return this.reviewService.reviewDiscrepancy(
      discrepancyId,
      decision,
      reviewer,
      comment,
      scoreAdjustment,
      adjustmentReason
    );
  }

  submitAppeal(
    ratingId: string,
    appellant: string,
    appellantRole: 'worker' | 'student' | 'admin',
    appealReason: string,
    evidence: string[] = []
  ) {
    return this.reviewService.submitAppeal(ratingId, appellant, appellantRole, appealReason, evidence);
  }

  reviewAppeal(
    appealId: string,
    reviewer: string,
    status: AppealStatus,
    reviewComment: string,
    newScore?: number
  ) {
    return this.reviewService.reviewAppeal(appealId, reviewer, status, reviewComment, newScore);
  }

  getAppealTrail(ratingId: string) {
    return this.reviewService.getAppealTrail(ratingId);
  }

  getDiscrepancyExplanation(discrepancyId: string) {
    return this.reviewService.getDiscrepancyExplanation(discrepancyId);
  }

  recalculateAndReport(batchId: string): {
    summary: string;
    details: string[];
  } {
    this.store.updateBatchStatus(batchId, 'completed');
    return (this.reportService as any).generateFullReport(batchId);
  }

  getSummary(batchId: string) {
    return this.store.getBatchById(batchId);
  }

  getPendingDiscrepancies(batchId?: string) {
    return this.reviewService.getPendingDiscrepancies(batchId);
  }

  getBatches() {
    return this.store.getBatches();
  }

  getDiscrepancies(batchId?: string) {
    return this.store.getDiscrepancies(batchId);
  }

  getAppeals(batchId?: string) {
    return this.store.getAppeals(batchId);
  }

  saveState(filename: string) {
    this.store.saveToFile(filename);
  }

  loadState(filename: string) {
    this.store.loadFromFile(filename);
  }

  getReportFiles(): string[] {
    return (this.reportService as any).getReportFiles();
  }
}

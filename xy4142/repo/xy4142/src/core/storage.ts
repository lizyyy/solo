import * as fs from 'fs-extra';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import {
  TestBatch,
  BatchValidationResult,
  HumanReview,
  ReviewComment,
  ReviewDecision,
  ReviewStatus
} from '../types';
import { createLogger } from '../utils/logger';
import { StorageError, errorToRecord } from '../utils/error';

const logger = createLogger('storage');

export interface StorageOptions {
  baseDirectory?: string;
  batchDirectory?: string;
  resultDirectory?: string;
  reviewDirectory?: string;
  autoCreateDirectories?: boolean;
  prettyPrint?: boolean;
}

const DEFAULT_OPTIONS: Required<StorageOptions> = {
  baseDirectory: './data',
  batchDirectory: 'batches',
  resultDirectory: 'results',
  reviewDirectory: 'reviews',
  autoCreateDirectories: true,
  prettyPrint: true
};

export interface BatchMetadata {
  id: string;
  name: string;
  pluginId: string;
  pluginVersion: string;
  createdAt: number;
  testCaseCount: number;
  filePath: string;
}

export interface ResultMetadata {
  id: string;
  batchId: string;
  pluginId: string;
  pluginVersion: string;
  overallStatus: string;
  startedAt: number;
  completedAt: number;
  total: number;
  passed: number;
  failed: number;
  filePath: string;
  hasReview: boolean;
}

export interface ReviewMetadata {
  id: string;
  validationResultId: string;
  reviewer: string;
  reviewedAt: number;
  status: ReviewStatus;
  approved: boolean;
  filePath: string;
}

export class StorageManager {
  private options: Required<StorageOptions>;

  constructor(options?: StorageOptions) {
    this.options = { ...DEFAULT_OPTIONS, ...options };

    if (this.options.autoCreateDirectories) {
      this.ensureDirectories();
    }
  }

  private ensureDirectories(): void {
    try {
      fs.ensureDirSync(this.getBatchDirectory());
      fs.ensureDirSync(this.getResultDirectory());
      fs.ensureDirSync(this.getReviewDirectory());
    } catch (error) {
      throw new StorageError('Failed to create storage directories', {
        error: errorToRecord(error)
      });
    }
  }

  private getBatchDirectory(): string {
    return path.join(this.options.baseDirectory, this.options.batchDirectory);
  }

  private getResultDirectory(): string {
    return path.join(this.options.baseDirectory, this.options.resultDirectory);
  }

  private getReviewDirectory(): string {
    return path.join(this.options.baseDirectory, this.options.reviewDirectory);
  }

  private getBatchFilePath(batchId: string): string {
    return path.join(this.getBatchDirectory(), `${batchId}.json`);
  }

  private getResultFilePath(resultId: string): string {
    return path.join(this.getResultDirectory(), `${resultId}.json`);
  }

  private getReviewFilePath(reviewId: string): string {
    return path.join(this.getReviewDirectory(), `${reviewId}.json`);
  }

  async saveBatch(batch: TestBatch): Promise<void> {
    const filePath = this.getBatchFilePath(batch.id);

    try {
      const jsonData = this.options.prettyPrint
        ? JSON.stringify(batch, null, 2)
        : JSON.stringify(batch);

      await fs.writeFile(filePath, jsonData, 'utf-8');
      logger.info(`Saved batch: ${batch.id} to ${filePath}`);
    } catch (error) {
      throw new StorageError(`Failed to save batch: ${batch.id}`, {
        batchId: batch.id,
        filePath,
        error: errorToRecord(error)
      });
    }
  }

  async loadBatch(batchId: string): Promise<TestBatch> {
    const filePath = this.getBatchFilePath(batchId);

    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const batch = JSON.parse(content) as TestBatch;
      logger.debug(`Loaded batch: ${batchId} from ${filePath}`);
      return batch;
    } catch (error) {
      throw new StorageError(`Failed to load batch: ${batchId}`, {
        batchId,
        filePath,
        error: errorToRecord(error)
      });
    }
  }

  async batchExists(batchId: string): Promise<boolean> {
    const filePath = this.getBatchFilePath(batchId);
    return fs.pathExists(filePath);
  }

  async deleteBatch(batchId: string): Promise<void> {
    const filePath = this.getBatchFilePath(batchId);

    try {
      await fs.remove(filePath);
      logger.info(`Deleted batch: ${batchId}`);
    } catch (error) {
      throw new StorageError(`Failed to delete batch: ${batchId}`, {
        batchId,
        filePath,
        error: errorToRecord(error)
      });
    }
  }

  async listBatches(): Promise<BatchMetadata[]> {
    const directory = this.getBatchDirectory();
    const files = await fs.readdir(directory);

    const batches: BatchMetadata[] = [];

    for (const file of files) {
      if (!file.endsWith('.json')) continue;

      try {
        const filePath = path.join(directory, file);
        const content = await fs.readFile(filePath, 'utf-8');
        const batch = JSON.parse(content) as TestBatch;

        batches.push({
          id: batch.id,
          name: batch.name,
          pluginId: batch.pluginId,
          pluginVersion: batch.pluginVersion,
          createdAt: batch.createdAt,
          testCaseCount: batch.testCases.length,
          filePath
        });
      } catch (error) {
        logger.warn(`Skipping invalid batch file: ${file}`, { error: (error as Error).message });
      }
    }

    batches.sort((a, b) => b.createdAt - a.createdAt);
    return batches;
  }

  async saveResult(result: BatchValidationResult): Promise<void> {
    const filePath = this.getResultFilePath(result.id);

    try {
      const jsonData = this.options.prettyPrint
        ? JSON.stringify(result, null, 2)
        : JSON.stringify(result);

      await fs.writeFile(filePath, jsonData, 'utf-8');
      logger.info(`Saved validation result: ${result.id} to ${filePath}`);
    } catch (error) {
      throw new StorageError(`Failed to save validation result: ${result.id}`, {
        resultId: result.id,
        filePath,
        error: errorToRecord(error)
      });
    }
  }

  async loadResult(resultId: string): Promise<BatchValidationResult> {
    const filePath = this.getResultFilePath(resultId);

    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const result = JSON.parse(content) as BatchValidationResult;
      logger.debug(`Loaded validation result: ${resultId} from ${filePath}`);
      return result;
    } catch (error) {
      throw new StorageError(`Failed to load validation result: ${resultId}`, {
        resultId,
        filePath,
        error: errorToRecord(error)
      });
    }
  }

  async resultExists(resultId: string): Promise<boolean> {
    const filePath = this.getResultFilePath(resultId);
    return fs.pathExists(filePath);
  }

  async deleteResult(resultId: string): Promise<void> {
    const filePath = this.getResultFilePath(resultId);

    try {
      await fs.remove(filePath);
      logger.info(`Deleted validation result: ${resultId}`);
    } catch (error) {
      throw new StorageError(`Failed to delete validation result: ${resultId}`, {
        resultId,
        filePath,
        error: errorToRecord(error)
      });
    }
  }

  async listResults(): Promise<ResultMetadata[]> {
    const directory = this.getResultDirectory();
    const files = await fs.readdir(directory);

    const results: ResultMetadata[] = [];

    for (const file of files) {
      if (!file.endsWith('.json')) continue;

      try {
        const filePath = path.join(directory, file);
        const content = await fs.readFile(filePath, 'utf-8');
        const result = JSON.parse(content) as BatchValidationResult;

        const reviewPath = path.join(this.getReviewDirectory(), `review-${result.id}.json`);
        const hasReview = await fs.pathExists(reviewPath);

        results.push({
          id: result.id,
          batchId: result.batchId,
          pluginId: result.pluginId,
          pluginVersion: result.pluginVersion,
          overallStatus: result.overallStatus,
          startedAt: result.startedAt,
          completedAt: result.completedAt,
          total: result.summary.total,
          passed: result.summary.passed,
          failed: result.summary.failed,
          filePath,
          hasReview
        });
      } catch (error) {
        logger.warn(`Skipping invalid result file: ${file}`, { error: (error as Error).message });
      }
    }

    results.sort((a, b) => b.completedAt - a.completedAt);
    return results;
  }

  async saveReview(review: HumanReview): Promise<void> {
    const filePath = this.getReviewFilePath(review.id);

    try {
      const jsonData = this.options.prettyPrint
        ? JSON.stringify(review, null, 2)
        : JSON.stringify(review);

      await fs.writeFile(filePath, jsonData, 'utf-8');
      logger.info(`Saved review: ${review.id} to ${filePath}`);
    } catch (error) {
      throw new StorageError(`Failed to save review: ${review.id}`, {
        reviewId: review.id,
        filePath,
        error: errorToRecord(error)
      });
    }
  }

  async loadReview(reviewId: string): Promise<HumanReview> {
    const filePath = this.getReviewFilePath(reviewId);

    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const review = JSON.parse(content) as HumanReview;
      logger.debug(`Loaded review: ${reviewId} from ${filePath}`);
      return review;
    } catch (error) {
      throw new StorageError(`Failed to load review: ${reviewId}`, {
        reviewId,
        filePath,
        error: errorToRecord(error)
      });
    }
  }

  async loadReviewByResultId(resultId: string): Promise<HumanReview | null> {
    const directory = this.getReviewDirectory();
    const files = await fs.readdir(directory);

    for (const file of files) {
      if (!file.endsWith('.json')) continue;

      try {
        const filePath = path.join(directory, file);
        const content = await fs.readFile(filePath, 'utf-8');
        const review = JSON.parse(content) as HumanReview;

        if (review.validationResultId === resultId) {
          return review;
        }
      } catch (error) {
        logger.warn(`Skipping invalid review file: ${file}`, { error: (error as Error).message });
      }
    }

    return null;
  }

  async reviewExists(reviewId: string): Promise<boolean> {
    const filePath = this.getReviewFilePath(reviewId);
    return fs.pathExists(filePath);
  }

  async deleteReview(reviewId: string): Promise<void> {
    const filePath = this.getReviewFilePath(reviewId);

    try {
      await fs.remove(filePath);
      logger.info(`Deleted review: ${reviewId}`);
    } catch (error) {
      throw new StorageError(`Failed to delete review: ${reviewId}`, {
        reviewId,
        filePath,
        error: errorToRecord(error)
      });
    }
  }

  async listReviews(): Promise<ReviewMetadata[]> {
    const directory = this.getReviewDirectory();
    const files = await fs.readdir(directory);

    const reviews: ReviewMetadata[] = [];

    for (const file of files) {
      if (!file.endsWith('.json')) continue;

      try {
        const filePath = path.join(directory, file);
        const content = await fs.readFile(filePath, 'utf-8');
        const review = JSON.parse(content) as HumanReview;

        reviews.push({
          id: review.id,
          validationResultId: review.validationResultId,
          reviewer: review.reviewer,
          reviewedAt: review.reviewedAt,
          status: review.status,
          approved: review.finalDecision.approved,
          filePath
        });
      } catch (error) {
        logger.warn(`Skipping invalid review file: ${file}`, { error: (error as Error).message });
      }
    }

    reviews.sort((a, b) => b.reviewedAt - a.reviewedAt);
    return reviews;
  }

  createReview(
    resultId: string,
    reviewer: string,
    options?: { status?: ReviewStatus }
  ): HumanReview {
    return {
      id: `review-${uuidv4()}`,
      validationResultId: resultId,
      reviewer,
      reviewedAt: Date.now(),
      status: options?.status || 'in_progress',
      comments: [],
      finalDecision: {
        approved: false,
        reason: 'Pending review'
      }
    };
  }

  addComment(
    review: HumanReview,
    comment: Omit<ReviewComment, 'id' | 'createdAt'>
  ): HumanReview {
    const newComment: ReviewComment = {
      ...comment,
      id: `comment-${uuidv4()}`,
      createdAt: Date.now()
    };

    return {
      ...review,
      comments: [...review.comments, newComment]
    };
  }

  completeReview(
    review: HumanReview,
    decision: Omit<ReviewDecision, 'approved'> & { approved: boolean }
  ): HumanReview {
    return {
      ...review,
      status: 'completed',
      reviewedAt: Date.now(),
      finalDecision: {
        approved: decision.approved,
        reason: decision.reason,
        conditions: decision.conditions,
        recommendedAction: decision.recommendedAction
      }
    };
  }

  async exportAllToBackup(backupPath: string): Promise<void> {
    try {
      await fs.copy(this.options.baseDirectory, backupPath);
      logger.info(`Created backup at: ${backupPath}`);
    } catch (error) {
      throw new StorageError(`Failed to create backup`, {
        backupPath,
        error: errorToRecord(error)
      });
    }
  }

  getOptions(): Readonly<StorageOptions> {
    return { ...this.options };
  }
}

export function createStorageManager(options?: StorageOptions): StorageManager {
  return new StorageManager(options);
}

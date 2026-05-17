import { v4 as uuidv4 } from 'uuid';
import { EvaluationSample, ReviewRecord, EvaluationBatch, ReviewReport, ReviewStatus } from '../types';

class MemoryStore {
  private static instance: MemoryStore;
  private batches: Map<string, EvaluationBatch>;
  private samples: Map<string, EvaluationSample>;
  private reviews: Map<string, ReviewRecord>;
  private reports: Map<string, ReviewReport>;

  private constructor() {
    this.batches = new Map();
    this.samples = new Map();
    this.reviews = new Map();
    this.reports = new Map();
  }

  public static getInstance(): MemoryStore {
    if (!MemoryStore.instance) {
      MemoryStore.instance = new MemoryStore();
    }
    return MemoryStore.instance;
  }

  createBatch(batch: Omit<EvaluationBatch, 'batchId' | 'createdAt' | 'updatedAt'>): EvaluationBatch {
    const batchId = uuidv4();
    const now = new Date();
    const newBatch: EvaluationBatch = {
      ...batch,
      batchId,
      createdAt: now,
      updatedAt: now
    };
    this.batches.set(batchId, newBatch);
    return newBatch;
  }

  getBatch(batchId: string): EvaluationBatch | undefined {
    return this.batches.get(batchId);
  }

  getAllBatches(): EvaluationBatch[] {
    return Array.from(this.batches.values());
  }

  updateBatch(batchId: string, updates: Partial<EvaluationBatch>): EvaluationBatch | undefined {
    const batch = this.batches.get(batchId);
    if (!batch) return undefined;
    const updated = { ...batch, ...updates, updatedAt: new Date() };
    this.batches.set(batchId, updated);
    return updated;
  }

  createSample(sample: Omit<EvaluationSample, 'sampleId' | 'createdAt' | 'updatedAt'>): EvaluationSample {
    const sampleId = uuidv4();
    const now = new Date();
    const newSample: EvaluationSample = {
      ...sample,
      sampleId,
      createdAt: now,
      updatedAt: now
    };
    this.samples.set(sampleId, newSample);
    return newSample;
  }

  getSample(sampleId: string): EvaluationSample | undefined {
    return this.samples.get(sampleId);
  }

  getSamplesByBatch(batchId: string): EvaluationSample[] {
    return Array.from(this.samples.values()).filter(s => s.batchId === batchId);
  }

  updateSample(sampleId: string, updates: Partial<EvaluationSample>): EvaluationSample | undefined {
    const sample = this.samples.get(sampleId);
    if (!sample) return undefined;
    const updated = { ...sample, ...updates, updatedAt: new Date() };
    this.samples.set(sampleId, updated);
    return updated;
  }

  createReview(review: Omit<ReviewRecord, 'reviewId' | 'createdAt' | 'updatedAt'>): ReviewRecord {
    const reviewId = uuidv4();
    const now = new Date();
    const newReview: ReviewRecord = {
      ...review,
      reviewId,
      createdAt: now,
      updatedAt: now
    };
    this.reviews.set(reviewId, newReview);
    return newReview;
  }

  getReview(reviewId: string): ReviewRecord | undefined {
    return this.reviews.get(reviewId);
  }

  getReviewsByBatch(batchId: string): ReviewRecord[] {
    return Array.from(this.reviews.values()).filter(r => r.batchId === batchId);
  }

  getReviewsBySample(sampleId: string): ReviewRecord[] {
    return Array.from(this.reviews.values()).filter(r => r.sampleId === sampleId);
  }

  updateReview(reviewId: string, updates: Partial<ReviewRecord>): ReviewRecord | undefined {
    const review = this.reviews.get(reviewId);
    if (!review) return undefined;
    const updated = { ...review, ...updates, updatedAt: new Date() };
    this.reviews.set(reviewId, updated);
    return updated;
  }

  createReport(report: Omit<ReviewReport, 'reportId' | 'generatedAt'>): ReviewReport {
    const reportId = uuidv4();
    const now = new Date();
    const newReport: ReviewReport = {
      ...report,
      reportId,
      generatedAt: now
    };
    this.reports.set(reportId, newReport);
    return newReport;
  }

  getReport(reportId: string): ReviewReport | undefined {
    return this.reports.get(reportId);
  }

  getReportsByBatch(batchId: string): ReviewReport[] {
    return Array.from(this.reports.values()).filter(r => r.batchId === batchId);
  }
}

export const store = MemoryStore.getInstance();

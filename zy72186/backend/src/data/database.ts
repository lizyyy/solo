import type { Sample, ReviewRecord, ReviewStatus, ReviewReport } from '../types';
import { mockSamples, mockReviewHistory } from './mockData';

class Database {
  private samples: Map<string, Sample>;
  private reviewRecords: Map<string, ReviewRecord>;

  constructor() {
    this.samples = new Map();
    this.reviewRecords = new Map();
    
    mockSamples.forEach(s => this.samples.set(s.id, s));
    mockReviewHistory.forEach(r => this.reviewRecords.set(r.id, r));
  }

  getSamples(): Sample[] {
    return Array.from(this.samples.values()).sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  getSampleById(id: string): Sample | undefined {
    return this.samples.get(id);
  }

  getSamplesByStatus(status: ReviewStatus): Sample[] {
    return this.getSamples().filter(s => s.status === status);
  }

  getDuplicateGroups(): Map<string, Sample[]> {
    const groups = new Map<string, Sample[]>();
    this.getSamples().forEach(s => {
      if (s.duplicateGroupId) {
        const existing = groups.get(s.duplicateGroupId) || [];
        existing.push(s);
        groups.set(s.duplicateGroupId, existing);
      }
    });
    return groups;
  }

  addReviewRecord(record: ReviewRecord): void {
    this.reviewRecords.set(record.id, record);
    
    const sample = this.samples.get(record.sampleId);
    if (sample) {
      sample.reviewHistory.unshift(record);
      sample.status = record.newStatus;
      sample.updatedAt = record.timestamp;
    }
  }

  getReviewRecordsBySample(sampleId: string): ReviewRecord[] {
    return Array.from(this.reviewRecords.values())
      .filter(r => r.sampleId === sampleId)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }

  updateSampleStatus(sampleId: string, status: ReviewStatus, reviewer: string | null = null): Sample | undefined {
    const sample = this.samples.get(sampleId);
    if (sample) {
      sample.status = status;
      sample.currentReviewer = reviewer;
      sample.updatedAt = new Date().toISOString();
      return sample;
    }
    return undefined;
  }

  resolveDuplicate(duplicateId: string, keepOriginal: boolean = true): boolean {
    const dupSample = this.samples.get(duplicateId);
    if (!dupSample || !dupSample.isDuplicate || !dupSample.duplicateOf) {
      return false;
    }

    if (keepOriginal) {
      this.samples.delete(duplicateId);
    } else {
      const original = this.samples.get(dupSample.duplicateOf);
      if (original) {
        original.reviewHistory.forEach(r => {
          dupSample.reviewHistory.unshift(r);
        });
        dupSample.isDuplicate = false;
        dupSample.duplicateOf = null;
        dupSample.duplicateGroupId = null;
        this.samples.delete(original.id);
      }
    }
    return true;
  }

  generateReport(): ReviewReport {
    const samples = this.getSamples();
    const statusCounts = new Map<ReviewStatus, number>();
    const clauseTypeCounts = new Map<string, number>();
    const reviewerCounts = new Map<string, number>();

    let duplicateCount = 0;
    let missingRefCount = 0;
    let manualOverrideCount = 0;
    let modelImportConflictCount = 0;

    samples.forEach(s => {
      statusCounts.set(s.status, (statusCounts.get(s.status) || 0) + 1);
      clauseTypeCounts.set(s.clauseType, (clauseTypeCounts.get(s.clauseType) || 0) + 1);
      
      if (s.isDuplicate) duplicateCount++;
      if (s.isMissingRef) missingRefCount++;
      if (s.hasManualOverride) manualOverrideCount++;
      if (s.hasModelImportConflict) modelImportConflictCount++;
    });

    this.reviewRecords.forEach(r => {
      reviewerCounts.set(r.reviewer, (reviewerCounts.get(r.reviewer) || 0) + 1);
    });

    const recentReviews = Array.from(this.reviewRecords.values())
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 10);

    return {
      totalSamples: samples.length,
      pendingCount: statusCounts.get('pending') || 0,
      approvedCount: statusCounts.get('approved') || 0,
      rejectedCount: statusCounts.get('rejected') || 0,
      conflictCount: statusCounts.get('conflict') || 0,
      needReviewCount: statusCounts.get('need_review') || 0,
      duplicateCount,
      missingRefCount,
      manualOverrideCount,
      modelImportConflictCount,
      samplesByStatus: Array.from(statusCounts.entries()).map(([status, count]) => ({ status, count })),
      samplesByClauseType: Array.from(clauseTypeCounts.entries()).map(([clauseType, count]) => ({ clauseType, count })),
      recentReviews,
      reviewerStats: Array.from(reviewerCounts.entries()).map(([reviewer, count]) => ({ reviewer, count })),
    };
  }

  resetDatabase(): void {
    this.samples.clear();
    this.reviewRecords.clear();
    mockSamples.forEach(s => this.samples.set(s.id, { ...s, reviewHistory: [...s.reviewHistory] }));
    mockReviewHistory.forEach(r => this.reviewRecords.set(r.id, r));
  }
}

export const db = new Database();

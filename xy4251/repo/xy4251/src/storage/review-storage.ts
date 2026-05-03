import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { Violation, ReviewDecision, AuditReport } from '../types';

export interface StorageOptions {
  dataDir?: string;
  autoSave?: boolean;
}

export class ReviewStorage {
  private dataDir: string;
  private autoSave: boolean;
  private reviews: Map<string, ReviewDecision[]> = new Map();
  private auditLogs: Array<{
    id: string;
    timestamp: number;
    action: string;
    userId: string;
    details: Record<string, unknown>;
  }> = [];

  constructor(options?: StorageOptions) {
    this.dataDir = options?.dataDir ?? path.join(process.cwd(), 'data');
    this.autoSave = options?.autoSave ?? true;
    
    this.ensureDataDir();
    this.loadFromDisk();
  }

  private ensureDataDir(): void {
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }

    const reviewsDir = path.join(this.dataDir, 'reviews');
    if (!fs.existsSync(reviewsDir)) {
      fs.mkdirSync(reviewsDir, { recursive: true });
    }

    const reportsDir = path.join(this.dataDir, 'reports');
    if (!fs.existsSync(reportsDir)) {
      fs.mkdirSync(reportsDir, { recursive: true });
    }
  }

  private loadFromDisk(): void {
    const reviewsDir = path.join(this.dataDir, 'reviews');
    
    try {
      if (fs.existsSync(reviewsDir)) {
        const files = fs.readdirSync(reviewsDir).filter(f => f.endsWith('.json'));
        
        for (const file of files) {
          const content = fs.readFileSync(path.join(reviewsDir, file), 'utf-8');
          const review = JSON.parse(content) as ReviewDecision;
          
          if (!this.reviews.has(review.violationId)) {
            this.reviews.set(review.violationId, []);
          }
          this.reviews.get(review.violationId)?.push(review);
        }
      }
    } catch (error) {
      console.warn('Failed to load reviews:', error);
    }
  }

  createReview(
    violationId: string,
    decision: ReviewDecision['decision'],
    reason: string,
    reviewer: string,
    attachments?: string[]
  ): ReviewDecision {
    const review: ReviewDecision = {
      id: uuidv4(),
      violationId,
      decision,
      reason,
      reviewer,
      timestamp: Date.now(),
      attachments
    };

    if (!this.reviews.has(violationId)) {
      this.reviews.set(violationId, []);
    }
    this.reviews.get(violationId)?.push(review);

    this.addAuditLog('review_created', reviewer, {
      violationId,
      decision,
      reasonLength: reason.length
    });

    if (this.autoSave) {
      this.saveReview(review);
    }

    return review;
  }

  private saveReview(review: ReviewDecision): void {
    const reviewsDir = path.join(this.dataDir, 'reviews');
    const filePath = path.join(reviewsDir, `${review.id}.json');
    
    try {
      fs.writeFileSync(filePath, JSON.stringify(review, null, 2), 'utf-8');
    } catch (error) {
      console.error('Failed to save review:', error);
    }
  }

  getReviewsByViolation(violationId: string): ReviewDecision[] {
    return [...(this.reviews.get(violationId) ?? []];
  }

  getReviewsByReviewer(reviewer: string): ReviewDecision[] {
    const allReviews: ReviewDecision[] = [];
    
    for (const reviews of this.reviews.values()) {
      allReviews.push(...reviews.filter(r => r.reviewer === reviewer));
    }
    
    return allReviews.sort((a, b) => b.timestamp - a.timestamp);
  }

  getAllReviews(): ReviewDecision[] {
    const allReviews: ReviewDecision[] = [];
    
    for (const reviews of this.reviews.values()) {
      allReviews.push(...reviews);
    }
    
    return allReviews.sort((a, b) => b.timestamp - a.timestamp);
  }

  getLatestReview(violationId: string): ReviewDecision | undefined {
    const reviews = this.getReviewsByViolation(violationId);
    return reviews.sort((a, b) => b.timestamp - a.timestamp)[0];
  }

  updateViolationStatus(
    violation: Violation,
    status: Violation['status']
  ): Violation {
    const updatedViolation = { ...violation, status };
    
    this.addAuditLog('violation_status_updated', 'system', {
      violationId: violation.id,
      oldStatus: violation.status,
      newStatus: status
    });

    return updatedViolation;
  }

  addAuditLog(
    action: string,
    userId: string,
    details: Record<string, unknown>
  ): void {
    this.auditLogs.push({
      id: uuidv4(),
      timestamp: Date.now(),
      action,
      userId,
      details
    });
  }

  getAuditLogs(startTime?: number, endTime?: number): typeof this.auditLogs {
    let logs = [...this.auditLogs];

    if (startTime) {
      logs = logs.filter(l => l.timestamp >= startTime);
    }

    if (endTime) {
      logs = logs.filter(l => l.timestamp <= endTime);
    }

    return logs.sort((a, b) => b.timestamp - a.timestamp);
  }

  saveReport(report: AuditReport, format: 'json' = 'json'): string {
    const reportsDir = path.join(this.dataDir, 'reports');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `report-${timestamp}.${format}`;
    const filePath = path.join(reportsDir, fileName);

    try {
      const reportData = {
        ...report,
        deviceStatuses: Array.from(report.deviceStatuses.entries()),
        retainedMessages: Array.from(report.retainedMessages.entries())
      };
      
      fs.writeFileSync(filePath, JSON.stringify(reportData, null, 2), 'utf-8');
      
      this.addAuditLog('report_saved', 'system', {
        reportId: report.reportId,
        fileName,
        format
      });
    } catch (error) {
      console.error('Failed to save report:', error);
    }

    return filePath;
  }

  loadReport(filePath: string): AuditReport | null {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const data = JSON.parse(content) as AuditReport & {
        deviceStatuses: [string, AuditReport['deviceStatuses']][];
        retainedMessages: [string, AuditReport['retainedMessages']][];
      };

      return {
        ...data,
        deviceStatuses: new Map(data.deviceStatuses),
        retainedMessages: new Map(data.retainedMessages)
      };
    } catch (error) {
      console.error('Failed to load report:', error);
      return null;
    }
  }

  listReports(): string[] {
    const reportsDir = path.join(this.dataDir, 'reports');
    
    try {
      if (!fs.existsSync(reportsDir)) {
        return [];
      }

      return fs.readdirSync(reportsDir)
        .filter(f => f.endsWith('.json'))
        .sort()
        .reverse();
    } catch (error) {
      console.error('Failed to list reports:', error);
      return [];
    }
  }

  getSummary(): {
    totalReviews: number;
    totalViolationsReviewed: number;
    decisionsByDecision: Record<string, number>;
    totalAuditLogs: number;
    totalReports: number;
  } {
    const decisionsByDecision: Record<string, number> = {};
    const violationIds = new Set<string>();

    for (const [violationId, reviews] of this.reviews) {
      violationIds.add(violationId);
      
      for (const review of reviews) {
        decisionsByDecision[review.decision] = (decisionsByDecision[review.decision] || 0) + 1;
      }
    }

    return {
      totalReviews: this.getAllReviews().length,
      totalViolationsReviewed: violationIds.size,
      decisionsByDecision,
      totalAuditLogs: this.auditLogs.length,
      totalReports: this.listReports().length
    };
  }

  reset(): void {
    this.reviews.clear();
    this.auditLogs = [];
  }
}

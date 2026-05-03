import * as fs from 'fs';
import * as path from 'path';
import { ReviewSession, IssueStatus, ReviewItem } from '../types';

export class ReviewStorage {
  private outputDir: string;

  constructor(outputDir: string) {
    this.outputDir = outputDir;
    this.ensureDirectory();
  }

  private ensureDirectory(): void {
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }
  }

  save(session: ReviewSession): void {
    const fileName = `review-${session.snapshotId}.json`;
    const filePath = path.join(this.outputDir, fileName);
    
    fs.writeFileSync(filePath, JSON.stringify(session, null, 2));
  }

  load(snapshotId: string): ReviewSession | null {
    const fileName = `review-${snapshotId}.json`;
    const filePath = path.join(this.outputDir, fileName);

    if (!fs.existsSync(filePath)) {
      return this.tryLoadLatest();
    }

    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(content) as ReviewSession;
    } catch {
      return null;
    }
  }

  private tryLoadLatest(): ReviewSession | null {
    if (!fs.existsSync(this.outputDir)) {
      return null;
    }

    const files = fs.readdirSync(this.outputDir)
      .filter(f => f.startsWith('review-') && f.endsWith('.json'))
      .sort((a, b) => b.localeCompare(a));

    if (files.length === 0) {
      return null;
    }

    try {
      const content = fs.readFileSync(path.join(this.outputDir, files[0]), 'utf-8');
      return JSON.parse(content) as ReviewSession;
    } catch {
      return null;
    }
  }

  create(snapshotId: string): ReviewSession {
    return {
      id: `review-${Date.now()}`,
      snapshotId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      issues: []
    };
  }

  updateIssueStatus(
    session: ReviewSession,
    issueId: string,
    status: IssueStatus,
    note?: string
  ): ReviewSession {
    const existingIndex = session.issues.findIndex(r => r.issueId === issueId);
    
    const reviewItem: ReviewItem = {
      issueId,
      status,
      reviewerNote: note,
      reviewedAt: new Date().toISOString()
    };

    if (existingIndex >= 0) {
      session.issues[existingIndex] = reviewItem;
    } else {
      session.issues.push(reviewItem);
    }

    session.updatedAt = new Date().toISOString();

    return session;
  }

  getIssueStatus(session: ReviewSession | null, issueId: string): IssueStatus {
    if (!session) return 'new';
    
    const reviewItem = session.issues.find(r => r.issueId === issueId);
    return reviewItem?.status || 'new';
  }

  getReviewNote(session: ReviewSession | null, issueId: string): string | undefined {
    if (!session) return undefined;
    
    const reviewItem = session.issues.find(r => r.issueId === issueId);
    return reviewItem?.reviewerNote;
  }

  listAllSessions(): { fileName: string; snapshotId: string; updatedAt: string }[] {
    if (!fs.existsSync(this.outputDir)) {
      return [];
    }

    const files = fs.readdirSync(this.outputDir)
      .filter(f => f.startsWith('review-') && f.endsWith('.json'))
      .sort((a, b) => b.localeCompare(a));

    const results: { fileName: string; snapshotId: string; updatedAt: string }[] = [];

    for (const file of files) {
      try {
        const content = fs.readFileSync(path.join(this.outputDir, file), 'utf-8');
        const session = JSON.parse(content) as ReviewSession;
        results.push({
          fileName: file,
          snapshotId: session.snapshotId,
          updatedAt: session.updatedAt
        });
      } catch {
        continue;
      }
    }

    return results;
  }

  mergeSessions(sessions: ReviewSession[]): ReviewSession {
    if (sessions.length === 0) {
      throw new Error('没有会话可合并');
    }

    if (sessions.length === 1) {
      return sessions[0];
    }

    const merged: Map<string, ReviewItem> = new Map();

    const sortedSessions = [...sessions].sort((a, b) => 
      new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime()
    );

    for (const session of sortedSessions) {
      for (const item of session.issues) {
        merged.set(item.issueId, item);
      }
    }

    const latestSession = sortedSessions[sortedSessions.length - 1];

    return {
      id: `review-merged-${Date.now()}`,
      snapshotId: latestSession.snapshotId,
      createdAt: latestSession.createdAt,
      updatedAt: new Date().toISOString(),
      issues: Array.from(merged.values())
    };
  }

  deleteSession(snapshotId: string): boolean {
    const fileName = `review-${snapshotId}.json`;
    const filePath = path.join(this.outputDir, fileName);

    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      return true;
    }

    return false;
  }

  getStatistics(session: ReviewSession | null): {
    total: number;
    new: number;
    confirmed: number;
    ignored: number;
    fixed: number;
  } {
    const stats = {
      total: 0,
      new: 0,
      confirmed: 0,
      ignored: 0,
      fixed: 0
    };

    if (!session) {
      return stats;
    }

    stats.total = session.issues.length;

    for (const item of session.issues) {
      stats[item.status] = (stats[item.status] || 0) + 1;
    }

    return stats;
  }
}

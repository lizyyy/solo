import Dexie, { Table } from 'dexie';
import type {
  EvidencePack,
  TransactionRecord,
  ApprovalScreenshot,
  SupplementEmail,
  CorrectionRecord,
  JudgmentResult,
  ReviewRecord,
} from '../types';

export class EvidenceDatabase extends Dexie {
  packs!: Table<EvidencePack, string>;
  transactions!: Table<TransactionRecord, string>;
  screenshots!: Table<ApprovalScreenshot, string>;
  emails!: Table<SupplementEmail, string>;
  corrections!: Table<CorrectionRecord, string>;
  judgments!: Table<JudgmentResult, string>;
  reviews!: Table<ReviewRecord, string>;

  constructor() {
    super('EvidenceDB');
    
    this.version(1).stores({
      packs: 'id, importedAt, status, reviewer',
      transactions: 'id, packId, timestamp, transactionNo, isDuplicate',
      screenshots: 'id, packId, timestamp, isLate',
      emails: 'id, packId, timestamp, isDuplicate',
      corrections: 'id, packId, timestamp, correctedItemId',
      judgments: 'id, packId, judgedAt, conclusion',
      reviews: 'id, packId, reviewedAt, action'
    });
  }
}

export const db = new EvidenceDatabase();

export async function initMockData() {
  const count = await db.packs.count();
  if (count > 0) return;

  const { 
    mockPacks, 
    mockTransactions, 
    mockScreenshots, 
    mockEmails, 
    mockCorrections, 
    mockJudgmentResult, 
    mockReviewRecords 
  } = await import('../data/mockData');

  await db.transaction('rw', [
    db.packs,
    db.transactions,
    db.screenshots,
    db.emails,
    db.corrections,
    db.judgments,
    db.reviews
  ], async () => {
    await db.packs.bulkAdd(mockPacks);
    await db.transactions.bulkAdd(mockTransactions);
    await db.screenshots.bulkAdd(mockScreenshots);
    await db.emails.bulkAdd(mockEmails);
    await db.corrections.bulkAdd(mockCorrections);
    await db.judgments.add(mockJudgmentResult);
    await db.reviews.bulkAdd(mockReviewRecords);
  });
}

export async function getPackWithDetail(packId: string) {
  const pack = await db.packs.get(packId);
  if (!pack) return null;

  const [transactions, screenshots, emails, corrections, judgments, reviews] = await Promise.all([
    db.transactions.where('packId').equals(packId).toArray(),
    db.screenshots.where('packId').equals(packId).toArray(),
    db.emails.where('packId').equals(packId).toArray(),
    db.corrections.where('packId').equals(packId).toArray(),
    db.judgments.where('packId').equals(packId).first(),
    db.reviews.where('packId').equals(packId).toArray()
  ]);

  return {
    ...pack,
    transactions,
    screenshots,
    emails,
    corrections,
    judgmentResult: judgments,
    reviewRecords: reviews
  };
}

export async function getStats() {
  const [total, pending, reviewing, completed] = await Promise.all([
    db.packs.count(),
    db.packs.where('status').anyOf('pending', 'parsing').count(),
    db.packs.where('status').anyOf('judged', 'reviewing').count(),
    db.packs.where('status').anyOf('completed', 'archived').count()
  ]);

  return { total, pending, reviewing, completed, abnormal: reviewing };
}

export async function addReviewRecord(review: ReviewRecord) {
  return db.reviews.add(review);
}

export async function updatePackStatus(packId: string, status: string) {
  return db.packs.update(packId, { status });
}

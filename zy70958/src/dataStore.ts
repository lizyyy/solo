import * as fs from 'fs';
import * as path from 'path';
import csv from 'csv-parser';
import {
  RepairRecord,
  Worker,
  RatingRecord,
  Discrepancy,
  ReviewRecord,
  AppealHistory,
  ReconciliationBatch,
  createId,
  BatchStatistics,
} from './types';

export class DataStore {
  private dataDir: string;
  private repairs: RepairRecord[] = [];
  private workers: Worker[] = [];
  private ratings: RatingRecord[] = [];
  private discrepancies: Discrepancy[] = [];
  private reviews: ReviewRecord[] = [];
  private appeals: AppealHistory[] = [];
  private batches: ReconciliationBatch[] = [];

  constructor(dataDir?: string) {
    this.dataDir = dataDir || path.join(process.cwd(), 'data');
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }
  }

  async importRepairsFromCSV(filePath: string, batchId: string): Promise<RepairRecord[]> {
    const results: RepairRecord[] = [];
    return new Promise((resolve, reject) => {
      fs.createReadStream(filePath)
        .pipe(csv())
        .on('data', (data: any) => {
          const repair: RepairRecord = {
            id: createId(),
            repairNo: data.repairNo || data.报修单号 || '',
            studentId: data.studentId || data.学号 || '',
            studentName: data.studentName || data.学生姓名 || '',
            location: data.location || data.报修地点 || '',
            description: data.description || data.报修描述 || '',
            category: data.category || data.报修类别 || '',
            createdAt: data.createdAt || data.报修时间 || new Date().toISOString(),
            acceptedAt: data.acceptedAt || data.接单时间 || undefined,
            completedAt: data.completedAt || data.完成时间 || undefined,
            status: (data.status || data.状态 || 'pending') as any,
            workerId: data.workerId || data.维修工ID || undefined,
            expectedCompletionTime: data.expectedCompletionTime
              ? parseInt(data.expectedCompletionTime)
              : data.预计完成时间
              ? parseInt(data.预计完成时间)
              : undefined,
            importBatchId: batchId,
          };
          results.push(repair);
        })
        .on('end', () => {
          this.repairs.push(...results);
          resolve(results);
        })
        .on('error', reject);
    });
  }

  async importWorkersFromJSON(filePath: string, batchId: string): Promise<Worker[]> {
    const content = fs.readFileSync(filePath, 'utf-8');
    const data = JSON.parse(content);
    const workers: Worker[] = data.map((item: any) => {
      const workerNo = item.workerNo || item.工号 || '';
      return {
        id: workerNo,
        workerNo: workerNo,
        name: item.name || item.姓名 || '',
        phone: item.phone || item.电话 || '',
        specialty: item.specialty || item.专长 || [],
        baseScore: item.baseScore || item.基础分 || 100,
        currentScore: item.currentScore || item.当前分 || 100,
        importBatchId: batchId,
      };
    });
    this.workers.push(...workers);
    return workers;
  }

  async importRatingsFromJSON(filePath: string, batchId: string): Promise<RatingRecord[]> {
    const content = fs.readFileSync(filePath, 'utf-8');
    const data = JSON.parse(content);
    const ratings: RatingRecord[] = data.map((item: any) => ({
      id: createId(),
      repairNo: item.repairNo || item.报修单号 || '',
      workerId: item.workerId || item.维修工ID || '',
      score: item.score || item.评分 || 0,
      maxScore: item.maxScore || item.满分 || 100,
      source: (item.source || item.来源 || 'student') as any,
      reason: item.reason || item.评分原因 || undefined,
      ratedBy: item.ratedBy || item.评分人 || undefined,
      ratedAt: item.ratedAt || item.评分时间 || new Date().toISOString(),
      isAppealed: item.isAppealed || item.是否申诉 || false,
      appealStatus: item.appealStatus || item.申诉状态 || undefined,
      importBatchId: batchId,
    }));
    this.ratings.push(...ratings);
    return ratings;
  }

  addDiscrepancy(discrepancy: Omit<Discrepancy, 'id' | 'detectedAt'>): Discrepancy {
    const d: Discrepancy = {
      ...discrepancy,
      id: createId(),
      detectedAt: new Date().toISOString(),
    };
    this.discrepancies.push(d);
    return d;
  }

  addReview(review: Omit<ReviewRecord, 'id'>): ReviewRecord {
    const r: ReviewRecord = {
      ...review,
      id: createId(),
    };
    this.reviews.push(r);
    return r;
  }

  addAppeal(appeal: Omit<AppealHistory, 'id'>): AppealHistory {
    const a: AppealHistory = {
      ...appeal,
      id: createId(),
    };
    this.appeals.push(a);
    return a;
  }

  addBatch(batch: Omit<ReconciliationBatch, 'id'>): ReconciliationBatch {
    const b: ReconciliationBatch = {
      ...batch,
      id: createId(),
    };
    this.batches.push(b);
    return b;
  }

  getRepairs(batchId?: string): RepairRecord[] {
    return batchId ? this.repairs.filter(r => r.importBatchId === batchId) : this.repairs;
  }

  getWorkers(batchId?: string): Worker[] {
    return batchId ? this.workers.filter(w => w.importBatchId === batchId) : this.workers;
  }

  getRatings(batchId?: string): RatingRecord[] {
    return batchId ? this.ratings.filter(r => r.importBatchId === batchId) : this.ratings;
  }

  getDiscrepancies(batchId?: string): Discrepancy[] {
    return this.discrepancies;
  }

  getReviews(batchId?: string): ReviewRecord[] {
    return this.reviews;
  }

  getAppeals(batchId?: string): AppealHistory[] {
    return this.appeals;
  }

  getBatches(): ReconciliationBatch[] {
    return this.batches;
  }

  getBatchById(id: string): ReconciliationBatch | undefined {
    return this.batches.find(b => b.id === id);
  }

  getAppealHistoryForRating(ratingId: string): AppealHistory[] {
    return this.appeals.filter(a => a.ratingId === ratingId);
  }

  getAppealHistoryForWorker(workerId: string): AppealHistory[] {
    return this.appeals.filter(a => a.workerId === workerId);
  }

  getReviewsForDiscrepancy(discrepancyId: string): ReviewRecord[] {
    return this.reviews.filter(r => r.discrepancyId === discrepancyId);
  }

  updateBatchStatistics(batchId: string, stats: Partial<BatchStatistics>): void {
    const batch = this.batches.find(b => b.id === batchId);
    if (batch) {
      batch.statistics = { ...batch.statistics, ...stats };
    }
  }

  updateBatchStatus(batchId: string, status: ReconciliationBatch['status']): void {
    const batch = this.batches.find(b => b.id === batchId);
    if (batch) {
      batch.status = status;
    }
  }

  updateRating(ratingId: string, updates: Partial<RatingRecord>): void {
    const index = this.ratings.findIndex(r => r.id === ratingId);
    if (index !== -1) {
      this.ratings[index] = { ...this.ratings[index], ...updates };
    }
  }

  updateWorker(workerId: string, updates: Partial<Worker>): void {
    const index = this.workers.findIndex(w => w.id === workerId);
    if (index !== -1) {
      this.workers[index] = { ...this.workers[index], ...updates };
    }
  }

  saveToFile(filename: string): void {
    const data = {
      repairs: this.repairs,
      workers: this.workers,
      ratings: this.ratings,
      discrepancies: this.discrepancies,
      reviews: this.reviews,
      appeals: this.appeals,
      batches: this.batches,
    };
    fs.writeFileSync(path.join(this.dataDir, filename), JSON.stringify(data, null, 2));
  }

  loadFromFile(filename: string): void {
    const content = fs.readFileSync(path.join(this.dataDir, filename), 'utf-8');
    const data = JSON.parse(content);
    this.repairs = data.repairs || [];
    this.workers = data.workers || [];
    this.ratings = data.ratings || [];
    this.discrepancies = data.discrepancies || [];
    this.reviews = data.reviews || [];
    this.appeals = data.appeals || [];
    this.batches = data.batches || [];
  }
}

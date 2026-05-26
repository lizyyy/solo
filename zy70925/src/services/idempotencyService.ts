import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { BatchSubmission, ValidationResult } from '../types';

const STORAGE_DIR = path.join(process.cwd(), 'data');
const BATCH_INDEX_FILE = path.join(STORAGE_DIR, 'batch-index.json');
const RESULTS_DIR = path.join(STORAGE_DIR, 'results');

export class IdempotencyService {
  private static initialized = false;

  private static initialize(): void {
    if (this.initialized) return;
    
    if (!fs.existsSync(STORAGE_DIR)) {
      fs.mkdirSync(STORAGE_DIR, { recursive: true });
    }
    if (!fs.existsSync(RESULTS_DIR)) {
      fs.mkdirSync(RESULTS_DIR, { recursive: true });
    }
    if (!fs.existsSync(BATCH_INDEX_FILE)) {
      fs.writeFileSync(BATCH_INDEX_FILE, JSON.stringify([]));
    }
    this.initialized = true;
  }

  private static loadBatchIndex(): BatchSubmission[] {
    this.initialize();
    try {
      const content = fs.readFileSync(BATCH_INDEX_FILE, 'utf-8');
      return JSON.parse(content);
    } catch {
      return [];
    }
  }

  private static saveBatchIndex(index: BatchSubmission[]): void {
    this.initialize();
    fs.writeFileSync(BATCH_INDEX_FILE, JSON.stringify(index, null, 2));
  }

  public static generateBatchId(): string {
    return uuidv4();
  }

  public static checkDuplicate(
    courseBatch: string,
    attendanceHash: string,
    assignmentHash: string
  ): { isDuplicate: boolean; existingBatch?: BatchSubmission; existingResult?: ValidationResult } {
    this.initialize();
    const index = this.loadBatchIndex();

    const existing = index.find(b => 
      b.courseBatch === courseBatch && 
      b.attendanceCount.toString() === attendanceHash && 
      b.assignmentCount.toString() === assignmentHash
    );

    if (existing) {
      const resultFile = path.join(RESULTS_DIR, `${existing.batchId}.json`);
      if (fs.existsSync(resultFile)) {
        try {
          const result = JSON.parse(fs.readFileSync(resultFile, 'utf-8')) as ValidationResult;
          return { isDuplicate: true, existingBatch: existing, existingResult: result };
        } catch {
          return { isDuplicate: true, existingBatch: existing };
        }
      }
      return { isDuplicate: true, existingBatch: existing };
    }

    return { isDuplicate: false };
  }

  public static registerBatch(
    batchId: string,
    courseBatch: string,
    attendanceCount: number,
    assignmentCount: number,
    result: ValidationResult
  ): BatchSubmission {
    this.initialize();
    const index = this.loadBatchIndex();

    const submission: BatchSubmission = {
      batchId,
      submittedAt: new Date().toISOString(),
      courseBatch,
      attendanceCount,
      assignmentCount,
      status: 'processed'
    };

    index.push(submission);
    this.saveBatchIndex(index);

    const resultFile = path.join(RESULTS_DIR, `${batchId}.json`);
    fs.writeFileSync(resultFile, JSON.stringify(result, null, 2));

    return submission;
  }

  public static getResult(batchId: string): ValidationResult | null {
    this.initialize();
    const resultFile = path.join(RESULTS_DIR, `${batchId}.json`);
    if (fs.existsSync(resultFile)) {
      try {
        return JSON.parse(fs.readFileSync(resultFile, 'utf-8')) as ValidationResult;
      } catch {
        return null;
      }
    }
    return null;
  }

  public static getAllBatches(): BatchSubmission[] {
    return this.loadBatchIndex();
  }

  public static createContentHash(content: string): string {
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString();
  }
}

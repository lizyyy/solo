import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { ProcessedBatch } from '../types';

export class IdempotencyService {
  private storagePath: string;
  private processedBatches: Map<string, ProcessedBatch> = new Map();

  constructor(storageDir: string = './data') {
    this.storagePath = path.join(storageDir, 'processed-batches.json');
    this.ensureStorageExists();
    this.loadBatches();
  }

  private ensureStorageExists(): void {
    const dir = path.dirname(this.storagePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    if (!fs.existsSync(this.storagePath)) {
      fs.writeFileSync(this.storagePath, JSON.stringify([]));
    }
  }

  private loadBatches(): void {
    try {
      const data = fs.readFileSync(this.storagePath, 'utf-8');
      const batches: ProcessedBatch[] = JSON.parse(data);
      batches.forEach(batch => {
        this.processedBatches.set(batch.batchId, batch);
      });
    } catch (e) {
      this.processedBatches = new Map();
    }
  }

  private saveBatches(): void {
    const batches = Array.from(this.processedBatches.values());
    fs.writeFileSync(this.storagePath, JSON.stringify(batches, null, 2));
  }

  generateFileHash(filePath: string): string {
    const content = fs.readFileSync(filePath);
    return crypto.createHash('md5').update(content).digest('hex');
  }

  generateBatchId(fileHashes: string[]): string {
    const combined = fileHashes.sort().join('|');
    return crypto.createHash('md5').update(combined).digest('hex');
  }

  isBatchProcessed(batchId: string): boolean {
    return this.processedBatches.has(batchId);
  }

  getExistingBatch(batchId: string): ProcessedBatch | undefined {
    return this.processedBatches.get(batchId);
  }

  markBatchAsProcessed(batchId: string, fileHashes: string[], recordCount: number): ProcessedBatch {
    const batch: ProcessedBatch = {
      batchId,
      processedAt: new Date().toISOString(),
      fileHashes,
      recordCount,
    };
    this.processedBatches.set(batchId, batch);
    this.saveBatches();
    return batch;
  }

  checkFilesAlreadyProcessed(filePaths: string[]): { isDuplicate: boolean; existingBatch?: ProcessedBatch } {
    const fileHashes = filePaths.map(fp => this.generateFileHash(fp));
    const batchId = this.generateBatchId(fileHashes);
    
    if (this.isBatchProcessed(batchId)) {
      return {
        isDuplicate: true,
        existingBatch: this.getExistingBatch(batchId),
      };
    }
    
    return { isDuplicate: false };
  }
}

import * as fs from 'fs';
import * as path from 'path';
import { BatchInfo, FailReason } from '../types';
import { calculateFileHash } from '../utils/fileParser';

const BATCH_STORAGE_FILE = path.join(process.cwd(), 'data', 'batches.json');

export class BatchService {
  private batches: BatchInfo[] = [];

  constructor() {
    this.initStorage();
    this.loadBatches();
  }

  private initStorage() {
    const dataDir = path.dirname(BATCH_STORAGE_FILE);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    if (!fs.existsSync(BATCH_STORAGE_FILE)) {
      fs.writeFileSync(BATCH_STORAGE_FILE, JSON.stringify([]));
    }
  }

  private loadBatches() {
    try {
      const content = fs.readFileSync(BATCH_STORAGE_FILE, 'utf-8');
      this.batches = JSON.parse(content);
    } catch (error) {
      this.batches = [];
    }
  }

  private saveBatches() {
    fs.writeFileSync(BATCH_STORAGE_FILE, JSON.stringify(this.batches, null, 2));
  }

  checkDuplicate(files: Express.Multer.File[]): { isDuplicate: boolean; existingBatch?: BatchInfo } {
    const currentHashes = files.map(f => calculateFileHash(fs.readFileSync(f.path)));
    
    for (const batch of this.batches) {
      if (batch.processed && this.areHashesEqual(currentHashes, batch.fileHashes)) {
        return { isDuplicate: true, existingBatch: batch };
      }
    }
    
    return { isDuplicate: false };
  }

  private areHashesEqual(hashes1: string[], hashes2: string[]): boolean {
    if (hashes1.length !== hashes2.length) return false;
    const sorted1 = [...hashes1].sort();
    const sorted2 = [...hashes2].sort();
    return sorted1.every((h, i) => h === sorted2[i]);
  }

  registerBatch(batchId: string, files: Express.Multer.File[]): BatchInfo {
    const fileHashes = files.map(f => calculateFileHash(fs.readFileSync(f.path)));
    const batch: BatchInfo = {
      batchId,
      uploadDate: new Date().toISOString(),
      fileHashes,
      processed: false
    };
    this.batches.push(batch);
    this.saveBatches();
    return batch;
  }

  markBatchProcessed(batchId: string): void {
    const batch = this.batches.find(b => b.batchId === batchId);
    if (batch) {
      batch.processed = true;
      this.saveBatches();
    }
  }

  getBatchHistory(): BatchInfo[] {
    return [...this.batches].sort((a, b) => 
      new Date(b.uploadDate).getTime() - new Date(a.uploadDate).getTime()
    );
  }

  createDuplicateError(batch: BatchInfo) {
    return {
      originalData: {
        batchId: batch.batchId,
        uploadDate: batch.uploadDate,
        fileCount: batch.fileHashes.length
      },
      failReason: FailReason.DUPLICATE_BATCH,
      failDescription: `该批次文件已在 ${new Date(batch.uploadDate).toLocaleString()} 提交过，请勿重复处理`,
      suggestion: '请检查是否为重复导入，如有变更请修改文件内容后重新上传',
      source: 'system'
    };
  }
}

export const batchService = new BatchService();

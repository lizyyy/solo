import * as fs from 'fs';
import * as path from 'path';
import { createHash } from 'crypto';
import { RunState, ProcessedRecord, MedicalReport } from './types';

export class IdempotencyManager {
  private stateFile: string;
  private state: RunState;

  constructor(outputDir: string) {
    this.stateFile = path.join(outputDir, '.run-state.json');
    this.state = this.loadState();
  }

  private loadState(): RunState {
    if (fs.existsSync(this.stateFile)) {
      try {
        const content = fs.readFileSync(this.stateFile, 'utf8');
        return JSON.parse(content);
      } catch {
      }
    }
    return {
      lastRun: '',
      processedFiles: [],
      processedRecords: []
    };
  }

  private saveState(): void {
    this.state.lastRun = new Date().toISOString();
    fs.mkdirSync(path.dirname(this.stateFile), { recursive: true });
    fs.writeFileSync(this.stateFile, JSON.stringify(this.state, null, 2), 'utf8');
  }

  private generateFileHash(filePath: string): string {
    const content = fs.readFileSync(filePath);
    return createHash('md5').update(content).digest('hex');
  }

  isFileProcessed(filePath: string): boolean {
    const fileHash = this.generateFileHash(filePath);
    return this.state.processedFiles.includes(fileHash);
  }

  isRecordProcessed(record: MedicalReport): boolean {
    return this.state.processedRecords.some(r => r.recordId === record.id);
  }

  markFileProcessed(filePath: string): void {
    const fileHash = this.generateFileHash(filePath);
    if (!this.state.processedFiles.includes(fileHash)) {
      this.state.processedFiles.push(fileHash);
    }
  }

  markRecordProcessed(record: MedicalReport): void {
    const existing = this.state.processedRecords.find(r => r.recordId === record.id);
    if (!existing) {
      this.state.processedRecords.push({
        recordId: record.id,
        fileHash: '',
        processedAt: new Date().toISOString()
      });
    }
  }

  filterNewRecords(records: MedicalReport[]): MedicalReport[] {
    return records.filter(record => !this.isRecordProcessed(record));
  }

  commit(): void {
    this.saveState();
  }

  reset(): void {
    this.state = {
      lastRun: '',
      processedFiles: [],
      processedRecords: []
    };
    this.saveState();
  }

  getProcessedCount(): number {
    return this.state.processedRecords.length;
  }
}

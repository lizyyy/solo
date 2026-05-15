import { ManualCorrection, DetectionHistory, FilterType } from './types';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

export class CorrectionManager {
  private historyFilePath: string;
  private correctionsFilePath: string;

  constructor(dataDir: string = './data') {
    this.historyFilePath = path.join(dataDir, 'detection_history.json');
    this.correctionsFilePath = path.join(dataDir, 'manual_corrections.json');
    this.ensureDataFiles();
  }

  private ensureDataFiles(): void {
    const dir = path.dirname(this.historyFilePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    if (!fs.existsSync(this.historyFilePath)) {
      fs.writeFileSync(this.historyFilePath, JSON.stringify([], null, 2));
    }
    if (!fs.existsSync(this.correctionsFilePath)) {
      fs.writeFileSync(this.correctionsFilePath, JSON.stringify([], null, 2));
    }
  }

  addCorrection(correction: Omit<ManualCorrection, 'correctionId' | 'correctedAt'>): ManualCorrection {
    const corrections = this.loadCorrections();
    const newCorrection: ManualCorrection = {
      ...correction,
      correctionId: `COR-${crypto.randomUUID().slice(0, 8)}`,
      correctedAt: new Date().toISOString()
    };
    
    corrections.push(newCorrection);
    this.saveCorrections(corrections);
    return newCorrection;
  }

  addHistory(history: Omit<DetectionHistory, 'historyId' | 'detectedAt'>): DetectionHistory {
    const histories = this.loadHistories();
    const newHistory: DetectionHistory = {
      ...history,
      historyId: `HST-${crypto.randomUUID().slice(0, 8)}`,
      detectedAt: new Date().toISOString()
    };
    
    histories.push(newHistory);
    this.saveHistories(histories);
    return newHistory;
  }

  private loadCorrections(): ManualCorrection[] {
    try {
      const data = fs.readFileSync(this.correctionsFilePath, 'utf-8');
      return JSON.parse(data);
    } catch {
      return [];
    }
  }

  private saveCorrections(corrections: ManualCorrection[]): void {
    fs.writeFileSync(this.correctionsFilePath, JSON.stringify(corrections, null, 2));
  }

  private loadHistories(): DetectionHistory[] {
    try {
      const data = fs.readFileSync(this.historyFilePath, 'utf-8');
      return JSON.parse(data);
    } catch {
      return [];
    }
  }

  private saveHistories(histories: DetectionHistory[]): void {
    fs.writeFileSync(this.historyFilePath, JSON.stringify(histories, null, 2));
  }

  filterHistories(filterType: FilterType, value: string): DetectionHistory[] {
    const histories = this.loadHistories();
    
    switch (filterType) {
      case 'batch':
        return histories.filter(h => h.batchId === value);
      case 'operator':
        return histories.filter(h => h.operator === value);
      case 'riskType':
        return histories.filter(h => h.riskType === value);
      default:
        return histories;
    }
  }

  getAllHistories(): DetectionHistory[] {
    return this.loadHistories();
  }

  getAllCorrections(): ManualCorrection[] {
    return this.loadCorrections();
  }

  getCorrectionsByBatch(batchId: string): ManualCorrection[] {
    return this.loadCorrections().filter(c => c.batchId === batchId);
  }
}

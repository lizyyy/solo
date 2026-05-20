import * as fs from 'fs';
import * as path from 'path';
import { TransferRecord, Batch, ErrorRecord, Teller, ScheduleEntry } from '../types';

export class FileStorage {
  private dataDir: string;
  private recordsPath: string;
  private batchesPath: string;
  private errorsPath: string;
  private tellersPath: string;
  private schedulesPath: string;

  constructor(dataDir: string = './data') {
    this.dataDir = path.resolve(dataDir);
    this.recordsPath = path.join(this.dataDir, 'records.json');
    this.batchesPath = path.join(this.dataDir, 'batches.json');
    this.errorsPath = path.join(this.dataDir, 'errors.json');
    this.tellersPath = path.join(this.dataDir, 'tellers.json');
    this.schedulesPath = path.join(this.dataDir, 'schedules.json');
    this.ensureDataDir();
  }

  private ensureDataDir(): void {
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }
    this.initFileIfNotExists(this.recordsPath, []);
    this.initFileIfNotExists(this.batchesPath, []);
    this.initFileIfNotExists(this.errorsPath, []);
    this.initFileIfNotExists(this.tellersPath, []);
    this.initFileIfNotExists(this.schedulesPath, []);
  }

  private initFileIfNotExists(filePath: string, defaultValue: any): void {
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, JSON.stringify(defaultValue, null, 2));
    }
  }

  private readFile<T>(filePath: string): T[] {
    const content = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(content) as T[];
  }

  private writeFile<T>(filePath: string, data: T[]): void {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  }

  async getRecords(): Promise<TransferRecord[]> {
    return this.readFile<TransferRecord>(this.recordsPath);
  }

  async saveRecord(record: TransferRecord): Promise<void> {
    const records = await this.getRecords();
    const index = records.findIndex(r => r.id === record.id);
    if (index >= 0) {
      records[index] = record;
    } else {
      records.push(record);
    }
    this.writeFile(this.recordsPath, records);
  }

  async saveRecords(records: TransferRecord[]): Promise<void> {
    const existingRecords = await this.getRecords();
    for (const record of records) {
      const index = existingRecords.findIndex(r => r.id === record.id);
      if (index >= 0) {
        existingRecords[index] = record;
      } else {
        existingRecords.push(record);
      }
    }
    this.writeFile(this.recordsPath, existingRecords);
  }

  async getBatches(): Promise<Batch[]> {
    return this.readFile<Batch>(this.batchesPath);
  }

  async saveBatch(batch: Batch): Promise<void> {
    const batches = await this.getBatches();
    const index = batches.findIndex(b => b.id === batch.id);
    if (index >= 0) {
      batches[index] = batch;
    } else {
      batches.push(batch);
    }
    this.writeFile(this.batchesPath, batches);
  }

  async getErrors(): Promise<ErrorRecord[]> {
    return this.readFile<ErrorRecord>(this.errorsPath);
  }

  async saveError(error: ErrorRecord): Promise<void> {
    const errors = await this.getErrors();
    const index = errors.findIndex(e => e.errorNumber === error.errorNumber);
    if (index >= 0) {
      errors[index] = error;
    } else {
      errors.push(error);
    }
    this.writeFile(this.errorsPath, errors);
  }

  async getTellers(): Promise<Teller[]> {
    return this.readFile<Teller>(this.tellersPath);
  }

  async saveTeller(teller: Teller): Promise<void> {
    const tellers = await this.getTellers();
    const index = tellers.findIndex(t => t.tellerId === teller.tellerId);
    if (index >= 0) {
      tellers[index] = teller;
    } else {
      tellers.push(teller);
    }
    this.writeFile(this.tellersPath, tellers);
  }

  async saveTellers(tellers: Teller[]): Promise<void> {
    this.writeFile(this.tellersPath, tellers);
  }

  async getSchedules(): Promise<ScheduleEntry[]> {
    return this.readFile<ScheduleEntry>(this.schedulesPath);
  }

  async saveSchedules(schedules: ScheduleEntry[]): Promise<void> {
    this.writeFile(this.schedulesPath, schedules);
  }
}

export const storage = new FileStorage();

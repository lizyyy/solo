import { Low } from 'lowdb';
import { JSONFile } from 'lowdb/node';
import path from 'path';
import { ChangeRecord, ManualCorrection, Batch, QueryFilter } from '../types';

interface DatabaseSchema {
  batches: Batch[];
  records: ChangeRecord[];
  corrections: ManualCorrection[];
}

const defaultData: DatabaseSchema = {
  batches: [],
  records: [],
  corrections: []
};

export class ChangeIndexDB {
  private db: Low<DatabaseSchema>;

  constructor(dbPath?: string) {
    const dbFile = dbPath || path.join(process.cwd(), 'change-index.json');
    const adapter = new JSONFile<DatabaseSchema>(dbFile);
    this.db = new Low(adapter, defaultData);
  }

  async init(): Promise<void> {
    await this.db.read();
    if (!this.db.data) {
      this.db.data = { ...defaultData };
      await this.db.write();
    }
  }

  async insertBatch(batch: Batch): Promise<void> {
    this.db.data!.batches.push(batch);
    await this.db.write();
  }

  async insertRecord(record: ChangeRecord): Promise<void> {
    this.db.data!.records.push(record);
    await this.db.write();
  }

  async insertCorrection(correction: ManualCorrection): Promise<void> {
    this.db.data!.corrections.push(correction);
    await this.db.write();
  }

  async updateRecord(record: ChangeRecord): Promise<void> {
    const index = this.db.data!.records.findIndex(r => r.id === record.id);
    if (index !== -1) {
      this.db.data!.records[index] = record;
      await this.db.write();
    }
  }

  getRecords(filter: QueryFilter = {}): ChangeRecord[] {
    let records = [...this.db.data!.records];

    if (filter.batchId) {
      records = records.filter(r => r.batchId === filter.batchId);
    }
    if (filter.operator) {
      records = records.filter(r => r.operator === filter.operator);
    }
    if (filter.riskType) {
      records = records.filter(r => r.riskType === filter.riskType);
    }
    if (filter.status) {
      records = records.filter(r => r.status === filter.status);
    }
    if (filter.startDate) {
      records = records.filter(r => r.createdAt >= filter.startDate!);
    }
    if (filter.endDate) {
      records = records.filter(r => r.createdAt <= filter.endDate!);
    }

    records.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return records;
  }

  getRecordById(id: string): ChangeRecord | null {
    return this.db.data!.records.find(r => r.id === id) || null;
  }

  getBatches(): Batch[] {
    return [...this.db.data!.batches].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  getBatchById(id: string): Batch | null {
    return this.db.data!.batches.find(b => b.id === id) || null;
  }

  getCorrectionsByRecordId(recordId: string): ManualCorrection[] {
    return this.db.data!.corrections
      .filter(c => c.recordId === recordId)
      .sort((a, b) => new Date(a.correctedAt).getTime() - new Date(b.correctedAt).getTime());
  }

  getCorrectionsByApprovalNode(approvalNode: string): ManualCorrection[] {
    return this.db.data!.corrections
      .filter(c => c.approvalNode === approvalNode)
      .sort((a, b) => new Date(b.correctedAt).getTime() - new Date(a.correctedAt).getTime());
  }

  close(): void {
    // lowdb 不需要显式关闭
  }
}

export async function createDB(dbPath?: string): Promise<ChangeIndexDB> {
  const db = new ChangeIndexDB(dbPath);
  await db.init();
  return db;
}

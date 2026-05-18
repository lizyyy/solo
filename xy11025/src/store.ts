import { ReturnBucketRecord } from './types';

class ReturnBucketStore {
  private records: Map<string, ReturnBucketRecord> = new Map();

  add(record: ReturnBucketRecord): void {
    this.records.set(record.id, record);
  }

  get(id: string): ReturnBucketRecord | undefined {
    return this.records.get(id);
  }

  getAll(): ReturnBucketRecord[] {
    return Array.from(this.records.values());
  }

  update(id: string, record: Partial<ReturnBucketRecord>): ReturnBucketRecord | undefined {
    const existing = this.records.get(id);
    if (existing) {
      const updated = { ...existing, ...record, updateTime: new Date().toISOString() };
      this.records.set(id, updated);
      return updated;
    }
    return undefined;
  }

  findByBucketNumber(bucketNumber: string): ReturnBucketRecord[] {
    return this.getAll().filter(r => r.bucketNumber === bucketNumber);
  }

  findByBucketNumberAndStatus(bucketNumber: string, statuses: string[]): ReturnBucketRecord[] {
    return this.getAll().filter(r => 
      r.bucketNumber === bucketNumber && 
      statuses.includes(r.status)
    );
  }
}

export const returnBucketStore = new ReturnBucketStore();

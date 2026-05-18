import { DetentionFeeRecord, DetentionFeeStatus } from '../types/detention-fee';

class StorageService {
  private records: Map<string, DetentionFeeRecord> = new Map();
  private uniqueKeys: Set<string> = new Set();

  private generateUniqueKey(record: Partial<DetentionFeeRecord>): string {
    return `${record.billOfLadingNo}_${record.containerNo}_${record.portCode}`;
  }

  exists(record: Partial<DetentionFeeRecord>): boolean {
    const key = this.generateUniqueKey(record);
    return this.uniqueKeys.has(key);
  }

  findByBillOfLadingAndContainer(billOfLadingNo: string, containerNo: string, portCode: string): DetentionFeeRecord | undefined {
    for (const record of this.records.values()) {
      if (record.billOfLadingNo === billOfLadingNo &&
          record.containerNo === containerNo &&
          record.portCode === portCode) {
        return record;
      }
    }
    return undefined;
  }

  save(record: DetentionFeeRecord): DetentionFeeRecord {
    const id = record.id || `DF${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    const now = new Date().toISOString();
    const savedRecord = {
      ...record,
      id,
      createdAt: record.createdAt || now,
      updatedAt: now
    };
    this.records.set(id, savedRecord);
    this.uniqueKeys.add(this.generateUniqueKey(savedRecord));
    return savedRecord;
  }

  findById(id: string): DetentionFeeRecord | undefined {
    return this.records.get(id);
  }

  findAll(): DetentionFeeRecord[] {
    return Array.from(this.records.values());
  }

  clear(): void {
    this.records.clear();
    this.uniqueKeys.clear();
  }

  getStatus(id: string): DetentionFeeStatus | undefined {
    const record = this.records.get(id);
    return record?.status;
  }

  updateStatus(id: string, newStatus: DetentionFeeStatus, operatorId: string): DetentionFeeRecord | undefined {
    const record = this.records.get(id);
    if (!record) return undefined;

    const updatedRecord = {
      ...record,
      status: newStatus,
      updatedAt: new Date().toISOString()
    };

    if (newStatus === DetentionFeeStatus.REVIEWED) {
      updatedRecord.reviewedBy = operatorId;
      updatedRecord.reviewedAt = new Date().toISOString();
    }

    this.records.set(id, updatedRecord);
    return updatedRecord;
  }
}

export const storageService = new StorageService();

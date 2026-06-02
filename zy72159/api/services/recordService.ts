import { recordRepository } from '../repositories/recordRepository';
import type { BikeRecord, RecordStatus, UpdateRecordRequest } from '../../shared/types';

export class RecordService {
  getAllRecords(): BikeRecord[] {
    return recordRepository.findAll();
  }

  getRecordById(id: string): BikeRecord | null {
    return recordRepository.findById(id);
  }

  updateRecord(id: string, request: UpdateRecordRequest): BikeRecord | null {
    const updates: Partial<BikeRecord> = {};
    if (request.status !== undefined) updates.status = request.status;
    if (request.notes !== undefined) updates.notes = request.notes;
    if (request.reason !== undefined) updates.reason = request.reason;
    if (request.status) {
      updates.reviewTime = new Date().toISOString();
    }
    return recordRepository.update(id, updates);
  }

  updateStatus(id: string, status: RecordStatus, notes?: string): BikeRecord | null {
    const updates: Partial<BikeRecord> = {
      status,
      reviewTime: new Date().toISOString(),
    };
    if (notes !== undefined) updates.notes = notes;
    return recordRepository.update(id, updates);
  }

  getRecordsByStatus(status: RecordStatus): BikeRecord[] {
    return this.getAllRecords().filter(r => r.status === status);
  }

  getStats(): {
    total: number;
    pending: number;
    processed: number;
    verify: number;
    onsite: number;
    withConflicts: number;
    oldCaliber: number;
  } {
    const records = this.getAllRecords();
    return {
      total: records.length,
      pending: records.filter(r => r.status === 'pending').length,
      processed: records.filter(r => r.status === 'processed').length,
      verify: records.filter(r => r.status === 'verify').length,
      onsite: records.filter(r => r.status === 'onsite').length,
      withConflicts: records.filter(r => r.conflicts.length > 0).length,
      oldCaliber: records.filter(r => r.isOldCaliber).length,
    };
  }

  deleteRecord(id: string): boolean {
    return recordRepository.delete(id);
  }

  clearAll(): void {
    recordRepository.clearAll();
  }
}

export const recordService = new RecordService();

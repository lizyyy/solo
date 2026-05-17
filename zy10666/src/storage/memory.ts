import { v4 as uuidv4 } from 'uuid';
import {
  CorrectionRecord,
  CorrectionHistory,
  ImportBadRow,
  ListRequest,
  ListResponse,
  CorrectionStatus
} from '../types';

class MemoryStorage {
  private records: Map<string, CorrectionRecord> = new Map();
  private histories: Map<string, CorrectionHistory[]> = new Map();
  private badRows: ImportBadRow[] = [];

  async createRecord(record: Omit<CorrectionRecord, 'id' | 'createdAt' | 'updatedAt'>): Promise<CorrectionRecord> {
    const now = new Date().toISOString();
    const newRecord: CorrectionRecord = {
      ...record,
      id: uuidv4(),
      createdAt: now,
      updatedAt: now
    };
    this.records.set(newRecord.id, newRecord);
    return newRecord;
  }

  async getRecordById(id: string): Promise<CorrectionRecord | null> {
    return this.records.get(id) || null;
  }

  async updateRecord(id: string, updates: Partial<CorrectionRecord>): Promise<CorrectionRecord | null> {
    const record = this.records.get(id);
    if (!record) return null;

    const updatedRecord: CorrectionRecord = {
      ...record,
      ...updates,
      updatedAt: new Date().toISOString()
    };
    this.records.set(id, updatedRecord);
    return updatedRecord;
  }

  async listRecords(params: ListRequest): Promise<ListResponse<CorrectionRecord>> {
    const {
      page = 1,
      pageSize = 20,
      status,
      sourceSystem,
      userId,
      videoId,
      keyword
    } = params;

    let filteredList = Array.from(this.records.values());

    if (status) {
      filteredList = filteredList.filter(r => r.status === status);
    }

    if (sourceSystem) {
      filteredList = filteredList.filter(r => r.sourceSystem === sourceSystem);
    }

    if (userId) {
      filteredList = filteredList.filter(r => r.user.userId === userId);
    }

    if (videoId) {
      filteredList = filteredList.filter(r => r.video.videoId === videoId);
    }

    if (keyword) {
      const lowerKeyword = keyword.toLowerCase();
      filteredList = filteredList.filter(r =>
        r.video.videoTitle.toLowerCase().includes(lowerKeyword) ||
        r.user.userName.toLowerCase().includes(lowerKeyword) ||
        r.readableReason.toLowerCase().includes(lowerKeyword)
      );
    }

    filteredList.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    const total = filteredList.length;
    const start = (page - 1) * pageSize;
    const list = filteredList.slice(start, start + pageSize);

    return { list, total, page, pageSize };
  }

  async findConflicts(userId: string, videoId: string): Promise<CorrectionRecord[]> {
    return Array.from(this.records.values()).filter(
      r => r.user.userId === userId && r.video.videoId === videoId
    );
  }

  async addHistory(history: Omit<CorrectionHistory, 'id' | 'createdAt'>): Promise<CorrectionHistory> {
    const newHistory: CorrectionHistory = {
      ...history,
      id: uuidv4(),
      createdAt: new Date().toISOString()
    };

    const histories = this.histories.get(history.recordId) || [];
    histories.push(newHistory);
    this.histories.set(history.recordId, histories);

    return newHistory;
  }

  async getHistoriesByRecordId(recordId: string): Promise<CorrectionHistory[]> {
    return this.histories.get(recordId) || [];
  }

  async addBadRow(badRow: Omit<ImportBadRow, 'id'>): Promise<ImportBadRow> {
    const newBadRow: ImportBadRow = {
      ...badRow,
      id: uuidv4()
    } as ImportBadRow;
    this.badRows.push(newBadRow);
    return newBadRow;
  }

  async getBadRows(batchId?: string): Promise<ImportBadRow[]> {
    if (batchId) {
      return this.badRows.filter(row => row.batchId === batchId);
    }
    return this.badRows;
  }

  async getAllRecords(): Promise<CorrectionRecord[]> {
    return Array.from(this.records.values());
  }

  async getRecordsByStatus(status: CorrectionStatus): Promise<CorrectionRecord[]> {
    return Array.from(this.records.values()).filter(r => r.status === status);
  }
}

export const memoryStorage = new MemoryStorage();

import { v4 as uuidv4 } from 'uuid';
import { TicketRow, ImportBatch, TrackRemark, RehearsalChange, ClassificationResult } from '../types';

class DataStore {
  private ticketRows: Map<string, TicketRow> = new Map();
  private importBatches: Map<string, ImportBatch> = new Map();
  private fileHashSet: Set<string> = new Set();
  private classificationResults: Map<string, ClassificationResult> = new Map();

  generateId(): string {
    return uuidv4();
  }

  addImportBatch(batch: ImportBatch): void {
    this.importBatches.set(batch.id, batch);
    this.fileHashSet.add(batch.fileHash);
  }

  getImportBatch(id: string): ImportBatch | undefined {
    return this.importBatches.get(id);
  }

  hasFileHash(hash: string): boolean {
    return this.fileHashSet.has(hash);
  }

  getAllImportBatches(): ImportBatch[] {
    return Array.from(this.importBatches.values());
  }

  addTicketRow(row: TicketRow): void {
    this.ticketRows.set(row.id, row);
  }

  getTicketRow(id: string): TicketRow | undefined {
    return this.ticketRows.get(id);
  }

  getAllTicketRows(): TicketRow[] {
    return Array.from(this.ticketRows.values());
  }

  getTicketRowsByBatch(batchId: string): TicketRow[] {
    return Array.from(this.ticketRows.values()).filter(r => r.importBatchId === batchId);
  }

  getTicketRowsByTrack(trackId: string): TicketRow[] {
    return Array.from(this.ticketRows.values()).filter(r => r.trackId === trackId);
  }

  updateTicketRow(id: string, updates: Partial<TicketRow>): TicketRow | undefined {
    const row = this.ticketRows.get(id);
    if (!row) return undefined;
    const updated = { ...row, ...updates, lastUpdatedAt: new Date().toISOString() };
    this.ticketRows.set(id, updated);
    return updated;
  }

  findDuplicateRow(studentName: string, instrument: string, trackId: string): TicketRow | undefined {
    return Array.from(this.ticketRows.values()).find(
      r => r.studentName === studentName && r.instrument === instrument && r.trackId === trackId
    );
  }

  setClassificationResult(trackId: string, result: ClassificationResult): void {
    this.classificationResults.set(trackId, result);
  }

  getClassificationResult(trackId: string): ClassificationResult | undefined {
    return this.classificationResults.get(trackId);
  }

  getAllClassificationResults(): ClassificationResult[] {
    return Array.from(this.classificationResults.values());
  }

  clear(): void {
    this.ticketRows.clear();
    this.importBatches.clear();
    this.fileHashSet.clear();
    this.classificationResults.clear();
  }
}

export const dataStore = new DataStore();

import { v4 as uuidv4 } from 'uuid';
import {
  TrackAlias,
  ClassSessionPhoto,
  ScheduleRecord,
  TrackChecklistItem,
  WorkflowState,
  MaterialSource,
  AuditEntry,
} from '../types';

export class DataStore {
  private trackAliases: Map<string, TrackAlias> = new Map();
  private sessionPhotos: Map<string, ClassSessionPhoto> = new Map();
  private scheduleRecords: Map<string, ScheduleRecord> = new Map();
  private checklist: Map<string, TrackChecklistItem> = new Map();
  private workflowStates: Map<string, WorkflowState> = new Map();
  private importBatches: Set<string> = new Set();
  private auditLog: AuditEntry[] = [];

  generateId(): string {
    return uuidv4();
  }

  generateBatchId(): string {
    const batchId = `batch-${Date.now()}-${uuidv4().slice(0, 8)}`;
    this.importBatches.add(batchId);
    return batchId;
  }

  isBatchExists(batchId: string): boolean {
    return this.importBatches.has(batchId);
  }

  addAuditEntry(entry: AuditEntry): void {
    this.auditLog.push(entry);
  }

  getAuditLog(entityType?: string, entityId?: string): AuditEntry[] {
    let entries = this.auditLog;
    if (entityType) {
      entries = entries.filter((e) => e.entityType === entityType);
    }
    if (entityId) {
      entries = entries.filter((e) => e.entityId === entityId);
    }
    return entries;
  }

  getAuditLogByBatch(batchId: string): AuditEntry[] {
    return this.auditLog.filter((e) => e.batchId === batchId);
  }

  saveTrackAlias(alias: TrackAlias): void {
    this.trackAliases.set(alias.id, alias);
  }

  getTrackAlias(id: string): TrackAlias | undefined {
    return this.trackAliases.get(id);
  }

  getAllTrackAliases(): TrackAlias[] {
    return Array.from(this.trackAliases.values());
  }

  findTrackAliasByName(name: string): TrackAlias | undefined {
    const normalized = name.trim().toLowerCase();
    return Array.from(this.trackAliases.values()).find(
      (a) =>
        a.canonicalName.trim().toLowerCase() === normalized ||
        a.aliases.some((alias) => alias.trim().toLowerCase() === normalized)
    );
  }

  findDuplicateAlias(canonicalName: string, aliases: string[]): TrackAlias | undefined {
    const normalizedCanonical = canonicalName.trim().toLowerCase();
    const normalizedAliases = aliases.map((a) => a.trim().toLowerCase());

    return Array.from(this.trackAliases.values()).find((existing) => {
      if (existing.canonicalName.trim().toLowerCase() === normalizedCanonical) {
        return true;
      }
      return existing.aliases.some(
        (a) =>
          normalizedAliases.includes(a.trim().toLowerCase()) ||
          normalizedAliases.includes(existing.canonicalName.trim().toLowerCase())
      );
    });
  }

  saveSessionPhoto(photo: ClassSessionPhoto): void {
    this.sessionPhotos.set(photo.id, photo);
  }

  getSessionPhoto(id: string): ClassSessionPhoto | undefined {
    return this.sessionPhotos.get(id);
  }

  getAllSessionPhotos(): ClassSessionPhoto[] {
    return Array.from(this.sessionPhotos.values());
  }

  getSessionPhotosBySource(source: MaterialSource): ClassSessionPhoto[] {
    return Array.from(this.sessionPhotos.values()).filter((p) => p.source === source);
  }

  saveScheduleRecord(record: ScheduleRecord): void {
    this.scheduleRecords.set(record.id, record);
  }

  getScheduleRecord(id: string): ScheduleRecord | undefined {
    return this.scheduleRecords.get(id);
  }

  getAllScheduleRecords(): ScheduleRecord[] {
    return Array.from(this.scheduleRecords.values());
  }

  getScheduleRecordsByBatch(batchId: string): ScheduleRecord[] {
    return Array.from(this.scheduleRecords.values()).filter((r) => r.importBatchId === batchId);
  }

  findDuplicateScheduleRecords(record: Partial<ScheduleRecord>): ScheduleRecord[] {
    return Array.from(this.scheduleRecords.values()).filter(
      (r) =>
        r.performerId === record.performerId &&
        r.sessionDate.getTime() === record.sessionDate?.getTime() &&
        r.locationId === record.locationId &&
        r.trackName === record.trackName
    );
  }

  saveChecklistItem(item: TrackChecklistItem): void {
    this.checklist.set(item.id, item);
  }

  getChecklistItem(id: string): TrackChecklistItem | undefined {
    return this.checklist.get(id);
  }

  getAllChecklistItems(): TrackChecklistItem[] {
    return Array.from(this.checklist.values());
  }

  getChecklistItemsBySource(source: MaterialSource): TrackChecklistItem[] {
    return Array.from(this.checklist.values()).filter((c) => c.source === source);
  }

  saveWorkflowState(state: WorkflowState): void {
    this.workflowStates.set(state.batchId, state);
  }

  getWorkflowState(batchId: string): WorkflowState | undefined {
    return this.workflowStates.get(batchId);
  }

  getAllWorkflowStates(): WorkflowState[] {
    return Array.from(this.workflowStates.values());
  }

  clear(): void {
    this.trackAliases.clear();
    this.sessionPhotos.clear();
    this.scheduleRecords.clear();
    this.checklist.clear();
    this.workflowStates.clear();
    this.importBatches.clear();
    this.auditLog = [];
  }
}

export const dataStore = new DataStore();

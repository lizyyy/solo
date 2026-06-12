import { v4 as uuidv4 } from 'uuid';
import dayjs from 'dayjs';
import {
  TrackAlias,
  TrackRemark,
  ClassCheckinPhoto,
  RehearsalChangeRecord,
  ApprovalRecord,
  ChangeHistory,
  ImportBatch,
  Snapshot,
  ReworkApplication
} from '../types';

export class DataStore {
  private trackAliases: Map<string, TrackAlias> = new Map();
  private trackRemarks: Map<string, TrackRemark> = new Map();
  private checkinPhotos: Map<string, ClassCheckinPhoto> = new Map();
  private rehearsalChanges: Map<string, RehearsalChangeRecord> = new Map();
  private approvalRecords: Map<string, ApprovalRecord> = new Map();
  private changeHistories: ChangeHistory[] = [];
  private importBatches: Map<string, ImportBatch> = new Map();
  private snapshots: Map<string, Snapshot> = new Map();
  private reworkApplications: Map<string, ReworkApplication> = new Map();

  private static instance: DataStore;

  static getInstance(): DataStore {
    if (!DataStore.instance) {
      DataStore.instance = new DataStore();
    }
    return DataStore.instance;
  }

  generateId(): string {
    return uuidv4();
  }

  now(): string {
    return dayjs().toISOString();
  }

  createTrackAlias(data: Omit<TrackAlias, 'id' | 'createdAt' | 'updatedAt'>): TrackAlias {
    const now = this.now();
    const trackAlias: TrackAlias = {
      ...data,
      id: this.generateId(),
      createdAt: now,
      updatedAt: now
    };
    this.trackAliases.set(trackAlias.id, trackAlias);
    return trackAlias;
  }

  getTrackAlias(id: string): TrackAlias | undefined {
    return this.trackAliases.get(id);
  }

  getTrackAliasByTrackId(trackId: string): TrackAlias | undefined {
    return Array.from(this.trackAliases.values()).find(t => t.trackId === trackId);
  }

  getTrackAliasesByBatch(batchId: string): TrackAlias[] {
    return Array.from(this.trackAliases.values()).filter(t => t.importBatchId === batchId);
  }

  getAllTrackAliases(): TrackAlias[] {
    return Array.from(this.trackAliases.values());
  }

  trackAliasExists(trackId: string, aliases: string[]): boolean {
    return Array.from(this.trackAliases.values()).some(t =>
      t.trackId === trackId ||
      t.aliases.some(a => aliases.includes(a))
    );
  }

  findExistingTrackAlias(trackId: string, aliases: string[]): { alias: TrackAlias; batch: ImportBatch } | undefined {
    const alias = Array.from(this.trackAliases.values()).find(t =>
      t.trackId === trackId || t.aliases.some(a => aliases.includes(a))
    );
    if (!alias) return undefined;
    const batch = this.importBatches.get(alias.importBatchId);
    return batch ? { alias, batch } : undefined;
  }

  createTrackRemark(data: Omit<TrackRemark, 'id' | 'createdAt' | 'updatedAt'>): TrackRemark {
    const now = this.now();
    const remark: TrackRemark = {
      ...data,
      id: this.generateId(),
      createdAt: now,
      updatedAt: now
    };
    this.trackRemarks.set(remark.id, remark);
    return remark;
  }

  updateTrackRemark(id: string, updates: Partial<TrackRemark>): TrackRemark | undefined {
    const remark = this.trackRemarks.get(id);
    if (!remark) return undefined;
    const updated: TrackRemark = {
      ...remark,
      ...updates,
      updatedAt: this.now()
    };
    this.trackRemarks.set(id, updated);
    return updated;
  }

  getTrackRemark(id: string): TrackRemark | undefined {
    return this.trackRemarks.get(id);
  }

  getTrackRemarksByTrackId(trackId: string): TrackRemark[] {
    return Array.from(this.trackRemarks.values()).filter(r => r.trackId === trackId);
  }

  hasReworkReasonForTrack(trackId: string): boolean {
    return this.getTrackRemarksByTrackId(trackId).some(r => r.hasReworkReason);
  }

  createCheckinPhoto(data: Omit<ClassCheckinPhoto, 'id' | 'uploadedAt'>): ClassCheckinPhoto {
    const photo: ClassCheckinPhoto = {
      ...data,
      id: this.generateId(),
      uploadedAt: this.now()
    };
    this.checkinPhotos.set(photo.id, photo);
    return photo;
  }

  getCheckinPhoto(id: string): ClassCheckinPhoto | undefined {
    return this.checkinPhotos.get(id);
  }

  getCheckinPhotosByTrack(trackId: string): ClassCheckinPhoto[] {
    return Array.from(this.checkinPhotos.values()).filter(p => p.trackId === trackId);
  }

  reviewCheckinPhoto(id: string, reviewedBy: string): ClassCheckinPhoto | undefined {
    const photo = this.checkinPhotos.get(id);
    if (!photo) return undefined;
    const updated: ClassCheckinPhoto = {
      ...photo,
      reviewed: true,
      reviewedBy,
      reviewedAt: this.now()
    };
    this.checkinPhotos.set(id, updated);
    return updated;
  }

  createRehearsalChange(data: Omit<RehearsalChangeRecord, 'id' | 'createdAt'>): RehearsalChangeRecord {
    const record: RehearsalChangeRecord = {
      ...data,
      id: this.generateId(),
      createdAt: this.now()
    };
    this.rehearsalChanges.set(record.id, record);
    return record;
  }

  getRehearsalChangesByTrack(trackId: string): RehearsalChangeRecord[] {
    return Array.from(this.rehearsalChanges.values()).filter(r => r.trackId === trackId);
  }

  createApprovalRecord(data: Omit<ApprovalRecord, 'id' | 'createdAt' | 'updatedAt'>): ApprovalRecord {
    const now = this.now();
    const record: ApprovalRecord = {
      ...data,
      id: this.generateId(),
      createdAt: now,
      updatedAt: now
    };
    this.approvalRecords.set(record.id, record);
    return record;
  }

  updateApprovalRecord(id: string, updates: Partial<ApprovalRecord>): ApprovalRecord | undefined {
    const record = this.approvalRecords.get(id);
    if (!record) return undefined;
    const updated: ApprovalRecord = {
      ...record,
      ...updates,
      updatedAt: this.now()
    };
    this.approvalRecords.set(id, updated);
    return updated;
  }

  getApprovalRecord(id: string): ApprovalRecord | undefined {
    return this.approvalRecords.get(id);
  }

  getApprovalRecordByTrackId(trackId: string): ApprovalRecord | undefined {
    return Array.from(this.approvalRecords.values()).find(r => r.trackId === trackId);
  }

  getAllApprovalRecords(): ApprovalRecord[] {
    return Array.from(this.approvalRecords.values());
  }

  createImportBatch(data: Omit<ImportBatch, 'id' | 'importedAt'>): ImportBatch {
    const batch: ImportBatch = {
      ...data,
      id: this.generateId(),
      importedAt: this.now()
    };
    this.importBatches.set(batch.id, batch);
    return batch;
  }

  getImportBatchByIdentifier(identifier: string): ImportBatch | undefined {
    return Array.from(this.importBatches.values()).find(b => b.batchIdentifier === identifier);
  }

  getImportBatch(id: string): ImportBatch | undefined {
    return this.importBatches.get(id);
  }

  updateImportBatch(id: string, updates: Partial<ImportBatch>): ImportBatch | undefined {
    const batch = this.importBatches.get(id);
    if (!batch) return undefined;
    const updated: ImportBatch = { ...batch, ...updates };
    this.importBatches.set(id, updated);
    return updated;
  }

  addChangeHistory(data: Omit<ChangeHistory, 'id' | 'changedAt'>): ChangeHistory {
    const history: ChangeHistory = {
      ...data,
      id: this.generateId(),
      changedAt: this.now()
    };
    this.changeHistories.push(history);
    return history;
  }

  getChangeHistoryByEntity(entityType: ChangeHistory['entityType'], entityId: string): ChangeHistory[] {
    return this.changeHistories.filter(h => h.entityType === entityType && h.entityId === entityId);
  }

  getChangeHistoryByBatch(importBatchId: string): ChangeHistory[] {
    return this.changeHistories.filter(h => h.importBatchId === importBatchId);
  }

  getChangeHistoryByAffectedEntity(entityType: 'approval_record' | 'track_alias', entityId: string): ChangeHistory[] {
    return this.changeHistories.filter(h => h.affectedEntityType === entityType && h.affectedEntityId === entityId);
  }

  getAllChangeHistory(): ChangeHistory[] {
    return [...this.changeHistories];
  }

  createSnapshot(data: Omit<Snapshot, 'id' | 'createdAt'>): Snapshot {
    const snapshot: Snapshot = {
      ...data,
      id: this.generateId(),
      createdAt: this.now()
    };
    this.snapshots.set(snapshot.id, snapshot);
    return snapshot;
  }

  getSnapshot(id: string): Snapshot | undefined {
    return this.snapshots.get(id);
  }

  getLatestSnapshotForApproval(approvalId: string): Snapshot | undefined {
    const approvalSnapshots = Array.from(this.snapshots.values())
      .filter(s => s.approvalId === approvalId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return approvalSnapshots[0];
  }

  createReworkApplication(data: Omit<ReworkApplication, 'id' | 'appliedAt'>): ReworkApplication {
    const application: ReworkApplication = {
      ...data,
      id: this.generateId(),
      appliedAt: this.now()
    };
    this.reworkApplications.set(application.id, application);
    return application;
  }

  getReworkApplication(id: string): ReworkApplication | undefined {
    return this.reworkApplications.get(id);
  }

  getReworkApplicationsByApproval(approvalId: string): ReworkApplication[] {
    return Array.from(this.reworkApplications.values()).filter(r => r.approvalId === approvalId);
  }

  updateReworkApplication(id: string, updates: Partial<ReworkApplication>): ReworkApplication | undefined {
    const app = this.reworkApplications.get(id);
    if (!app) return undefined;
    const updated: ReworkApplication = { ...app, ...updates };
    this.reworkApplications.set(id, updated);
    return updated;
  }

  clearAll(): void {
    this.trackAliases.clear();
    this.trackRemarks.clear();
    this.checkinPhotos.clear();
    this.rehearsalChanges.clear();
    this.approvalRecords.clear();
    this.changeHistories = [];
    this.importBatches.clear();
    this.snapshots.clear();
    this.reworkApplications.clear();
  }
}

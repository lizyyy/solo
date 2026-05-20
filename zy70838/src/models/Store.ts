import { v4 as uuidv4 } from 'uuid';
import {
  KeyBorrowRecord,
  VehicleInfo,
  ViolationRecord,
  Discrepancy,
  ReviewRecord,
  ReconciliationResult,
  TraceLink
} from '../types';

class DataStore {
  private static instance: DataStore;
  
  private borrowRecords: Map<string, KeyBorrowRecord> = new Map();
  private vehicles: Map<string, VehicleInfo> = new Map();
  private violations: Map<string, ViolationRecord> = new Map();
  private discrepancies: Map<string, Discrepancy> = new Map();
  private reviews: Map<string, ReviewRecord> = new Map();
  private reconciliations: Map<string, ReconciliationResult> = new Map();
  private traceLinks: Map<string, TraceLink> = new Map();

  private constructor() {}

  public static getInstance(): DataStore {
    if (!DataStore.instance) {
      DataStore.instance = new DataStore();
    }
    return DataStore.instance;
  }

  addBorrowRecord(record: Omit<KeyBorrowRecord, 'id' | 'createdAt' | 'updatedAt'>): KeyBorrowRecord {
    const id = uuidv4();
    const now = new Date();
    const newRecord: KeyBorrowRecord = {
      ...record,
      id,
      createdAt: now,
      updatedAt: now
    };
    this.borrowRecords.set(id, newRecord);
    this.addTraceLink({
      recordId: id,
      recordType: 'borrow',
      timestamp: now,
      action: 'create',
      details: newRecord
    });
    return newRecord;
  }

  getBorrowRecord(id: string): KeyBorrowRecord | undefined {
    return this.borrowRecords.get(id);
  }

  getAllBorrowRecords(): KeyBorrowRecord[] {
    return Array.from(this.borrowRecords.values());
  }

  updateBorrowRecord(id: string, updates: Partial<KeyBorrowRecord>): KeyBorrowRecord | undefined {
    const record = this.borrowRecords.get(id);
    if (record) {
      const updated = { ...record, ...updates, updatedAt: new Date() };
      this.borrowRecords.set(id, updated);
      this.addTraceLink({
        recordId: id,
        recordType: 'borrow',
        timestamp: new Date(),
        action: 'update',
        details: updates
      });
      return updated;
    }
    return undefined;
  }

  addVehicle(vehicle: Omit<VehicleInfo, 'id'>): VehicleInfo {
    const id = uuidv4();
    const newVehicle: VehicleInfo = { ...vehicle, id };
    this.vehicles.set(id, newVehicle);
    this.addTraceLink({
      recordId: id,
      recordType: 'vehicle',
      timestamp: new Date(),
      action: 'create',
      details: newVehicle
    });
    return newVehicle;
  }

  getVehicle(id: string): VehicleInfo | undefined {
    return this.vehicles.get(id);
  }

  getVehicleByPlate(plateNumber: string): VehicleInfo | undefined {
    return Array.from(this.vehicles.values()).find(v => v.plateNumber === plateNumber);
  }

  getAllVehicles(): VehicleInfo[] {
    return Array.from(this.vehicles.values());
  }

  updateVehicle(id: string, updates: Partial<VehicleInfo>): VehicleInfo | undefined {
    const vehicle = this.vehicles.get(id);
    if (vehicle) {
      const updated = { ...vehicle, ...updates };
      this.vehicles.set(id, updated);
      this.addTraceLink({
        recordId: id,
        recordType: 'vehicle',
        timestamp: new Date(),
        action: 'update',
        details: updates
      });
      return updated;
    }
    return undefined;
  }

  addViolation(violation: Omit<ViolationRecord, 'id'>): ViolationRecord {
    const id = uuidv4();
    const newViolation: ViolationRecord = { ...violation, id };
    this.violations.set(id, newViolation);
    this.addTraceLink({
      recordId: id,
      recordType: 'violation',
      timestamp: new Date(),
      action: 'create',
      details: newViolation
    });
    return newViolation;
  }

  getViolation(id: string): ViolationRecord | undefined {
    return this.violations.get(id);
  }

  getViolationsByPlate(plateNumber: string): ViolationRecord[] {
    return Array.from(this.violations.values()).filter(v => v.vehiclePlate === plateNumber);
  }

  getAllViolations(): ViolationRecord[] {
    return Array.from(this.violations.values());
  }

  updateViolation(id: string, updates: Partial<ViolationRecord>): ViolationRecord | undefined {
    const violation = this.violations.get(id);
    if (violation) {
      const updated = { ...violation, ...updates };
      this.violations.set(id, updated);
      this.addTraceLink({
        recordId: id,
        recordType: 'violation',
        timestamp: new Date(),
        action: 'update',
        details: updates
      });
      return updated;
    }
    return undefined;
  }

  addDiscrepancy(discrepancy: Omit<Discrepancy, 'id' | 'detectedAt'>): Discrepancy {
    const id = uuidv4();
    const newDiscrepancy: Discrepancy = {
      ...discrepancy,
      id,
      detectedAt: new Date()
    };
    this.discrepancies.set(id, newDiscrepancy);
    this.addTraceLink({
      recordId: id,
      recordType: 'discrepancy',
      timestamp: new Date(),
      action: 'detect',
      details: newDiscrepancy,
      prevLinks: [discrepancy.sourceRecordId]
    });
    return newDiscrepancy;
  }

  getDiscrepancy(id: string): Discrepancy | undefined {
    return this.discrepancies.get(id);
  }

  getAllDiscrepancies(): Discrepancy[] {
    return Array.from(this.discrepancies.values());
  }

  updateDiscrepancy(id: string, updates: Partial<Discrepancy>): Discrepancy | undefined {
    const discrepancy = this.discrepancies.get(id);
    if (discrepancy) {
      const updated = { ...discrepancy, ...updates };
      this.discrepancies.set(id, updated);
      this.addTraceLink({
        recordId: id,
        recordType: 'discrepancy',
        timestamp: new Date(),
        action: 'update',
        details: updates
      });
      return updated;
    }
    return undefined;
  }

  addReview(review: Omit<ReviewRecord, 'id'>): ReviewRecord {
    const id = uuidv4();
    const newReview: ReviewRecord = { ...review, id };
    this.reviews.set(id, newReview);
    this.addTraceLink({
      recordId: id,
      recordType: 'review',
      timestamp: new Date(),
      action: 'review',
      details: newReview,
      prevLinks: [review.discrepancyId]
    });
    return newReview;
  }

  getReview(id: string): ReviewRecord | undefined {
    return this.reviews.get(id);
  }

  getReviewsByReconciliation(reconciliationId: string): ReviewRecord[] {
    return Array.from(this.reviews.values()).filter(r => r.reconciliationId === reconciliationId);
  }

  addReconciliation(reconciliation: Omit<ReconciliationResult, 'id'>): ReconciliationResult {
    const id = uuidv4();
    const newReconciliation: ReconciliationResult = { ...reconciliation, id };
    this.reconciliations.set(id, newReconciliation);
    this.addTraceLink({
      recordId: id,
      recordType: 'report',
      timestamp: new Date(),
      action: 'generate',
      details: newReconciliation,
      prevLinks: reconciliation.discrepancies
    });
    return newReconciliation;
  }

  getReconciliation(id: string): ReconciliationResult | undefined {
    return this.reconciliations.get(id);
  }

  getAllReconciliations(): ReconciliationResult[] {
    return Array.from(this.reconciliations.values());
  }

  updateReconciliation(id: string, updates: Partial<ReconciliationResult>): ReconciliationResult | undefined {
    const reconciliation = this.reconciliations.get(id);
    if (reconciliation) {
      const updated = { ...reconciliation, ...updates };
      this.reconciliations.set(id, updated);
      return updated;
    }
    return undefined;
  }

  addTraceLink(link: Omit<TraceLink, 'id'>): string {
    const id = uuidv4();
    this.traceLinks.set(id, { ...link, id });
    return id;
  }

  getTraceChain(recordId: string): TraceLink[] {
    const chain: TraceLink[] = [];
    const visited = new Set<string>();
    
    const traverse = (currentRecordId: string) => {
      if (visited.has(currentRecordId)) return;
      visited.add(currentRecordId);
      
      const links = Array.from(this.traceLinks.values()).filter(l => l.recordId === currentRecordId);
      links.forEach(link => {
        if (!chain.find(c => c.id === link.id)) {
          chain.push(link);
        }
        if (link.prevLinks) {
          link.prevLinks.forEach(traverse);
        }
        if (link.nextLinks) {
          link.nextLinks.forEach(traverse);
        }
      });
      
      const relatedLinks = Array.from(this.traceLinks.values()).filter(l => 
        l.prevLinks?.includes(currentRecordId) || l.nextLinks?.includes(currentRecordId)
      );
      relatedLinks.forEach(link => {
        if (!chain.find(c => c.id === link.id)) {
          chain.push(link);
          traverse(link.recordId);
        }
      });
    };
    
    traverse(recordId);
    return chain.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }

  getTraceLinksByRecord(recordId: string): TraceLink[] {
    return Array.from(this.traceLinks.values())
      .filter(l => l.recordId === recordId || 
                   l.prevLinks?.includes(recordId) ||
                   l.nextLinks?.includes(recordId))
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }

  clearAll(): void {
    this.borrowRecords.clear();
    this.vehicles.clear();
    this.violations.clear();
    this.discrepancies.clear();
    this.reviews.clear();
    this.reconciliations.clear();
    this.traceLinks.clear();
  }
}

export const store = DataStore.getInstance();

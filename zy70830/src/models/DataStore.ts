import { v4 as uuidv4 } from 'uuid';
import {
  Bed,
  Patient,
  CleaningWorkOrder,
  Discrepancy,
  AuditLog,
  ReconciliationRecord,
  ReviewDecision,
  DataSource
} from '../types';

export class DataStore {
  private static instance: DataStore;
  
  private beds: Map<string, Bed> = new Map();
  private patients: Map<string, Patient> = new Map();
  private workOrders: Map<string, CleaningWorkOrder> = new Map();
  private discrepancies: Map<string, Discrepancy> = new Map();
  private auditLogs: AuditLog[] = [];
  private reconciliationRecords: ReconciliationRecord[] = [];
  private reviewDecisions: ReviewDecision[] = [];
  
  private constructor() {}
  
  static getInstance(): DataStore {
    if (!DataStore.instance) {
      DataStore.instance = new DataStore();
    }
    return DataStore.instance;
  }
  
  generateId(): string {
    return uuidv4();
  }
  
  addBed(bed: Bed): void {
    this.beds.set(bed.id, bed);
  }
  
  getBed(id: string): Bed | undefined {
    return this.beds.get(id);
  }
  
  getBedByNumber(bedNumber: string): Bed | undefined {
    return Array.from(this.beds.values()).find(b => b.bedNumber === bedNumber);
  }
  
  getAllBeds(): Bed[] {
    return Array.from(this.beds.values());
  }
  
  updateBed(id: string, updates: Partial<Bed>): Bed | undefined {
    const bed = this.beds.get(id);
    if (bed) {
      const updatedBed = { ...bed, ...updates, updatedAt: new Date() };
      this.beds.set(id, updatedBed);
      return updatedBed;
    }
    return undefined;
  }
  
  clearBeds(): void {
    this.beds.clear();
  }
  
  addPatient(patient: Patient): void {
    this.patients.set(patient.id, patient);
  }
  
  getPatient(id: string): Patient | undefined {
    return this.patients.get(id);
  }
  
  getPatientByMRN(medicalRecordNumber: string): Patient | undefined {
    return Array.from(this.patients.values()).find(p => p.medicalRecordNumber === medicalRecordNumber);
  }
  
  getAllPatients(): Patient[] {
    return Array.from(this.patients.values());
  }
  
  updatePatient(id: string, updates: Partial<Patient>): Patient | undefined {
    const patient = this.patients.get(id);
    if (patient) {
      const updatedPatient = { ...patient, ...updates, updatedAt: new Date() };
      this.patients.set(id, updatedPatient);
      return updatedPatient;
    }
    return undefined;
  }
  
  clearPatients(): void {
    this.patients.clear();
  }
  
  addWorkOrder(workOrder: CleaningWorkOrder): void {
    this.workOrders.set(workOrder.id, workOrder);
  }
  
  getWorkOrder(id: string): CleaningWorkOrder | undefined {
    return this.workOrders.get(id);
  }
  
  getWorkOrdersByBedId(bedId: string): CleaningWorkOrder[] {
    return Array.from(this.workOrders.values()).filter(wo => wo.bedId === bedId);
  }
  
  getAllWorkOrders(): CleaningWorkOrder[] {
    return Array.from(this.workOrders.values());
  }
  
  updateWorkOrder(id: string, updates: Partial<CleaningWorkOrder>): CleaningWorkOrder | undefined {
    const workOrder = this.workOrders.get(id);
    if (workOrder) {
      const updatedWorkOrder = { ...workOrder, ...updates, updatedAt: new Date() };
      this.workOrders.set(id, updatedWorkOrder);
      return updatedWorkOrder;
    }
    return undefined;
  }
  
  clearWorkOrders(): void {
    this.workOrders.clear();
  }
  
  addDiscrepancy(discrepancy: Discrepancy): void {
    this.discrepancies.set(discrepancy.id, discrepancy);
  }
  
  getDiscrepancy(id: string): Discrepancy | undefined {
    return this.discrepancies.get(id);
  }
  
  getAllDiscrepancies(): Discrepancy[] {
    return Array.from(this.discrepancies.values());
  }
  
  getUnresolvedDiscrepancies(): Discrepancy[] {
    return Array.from(this.discrepancies.values()).filter(d => !d.isResolved);
  }
  
  updateDiscrepancy(id: string, updates: Partial<Discrepancy>): Discrepancy | undefined {
    const discrepancy = this.discrepancies.get(id);
    if (discrepancy) {
      const updatedDiscrepancy = { ...discrepancy, ...updates };
      this.discrepancies.set(id, updatedDiscrepancy);
      return updatedDiscrepancy;
    }
    return undefined;
  }
  
  clearDiscrepancies(): void {
    this.discrepancies.clear();
  }
  
  addAuditLog(log: Omit<AuditLog, 'id' | 'timestamp'>): AuditLog {
    const auditLog: AuditLog = {
      ...log,
      id: this.generateId(),
      timestamp: new Date()
    };
    this.auditLogs.push(auditLog);
    return auditLog;
  }
  
  getAuditLogsByEntity(entityType: AuditLog['entityType'], entityId: string): AuditLog[] {
    return this.auditLogs.filter(log => log.entityType === entityType && log.entityId === entityId);
  }
  
  getAllAuditLogs(): AuditLog[] {
    return [...this.auditLogs];
  }
  
  addReconciliationRecord(record: ReconciliationRecord): void {
    this.reconciliationRecords.push(record);
  }
  
  getReconciliationRecord(id: string): ReconciliationRecord | undefined {
    return this.reconciliationRecords.find(r => r.id === id);
  }
  
  getAllReconciliationRecords(): ReconciliationRecord[] {
    return [...this.reconciliationRecords];
  }
  
  addReviewDecision(decision: ReviewDecision): void {
    this.reviewDecisions.push(decision);
  }
  
  getReviewDecision(id: string): ReviewDecision | undefined {
    return this.reviewDecisions.find(d => d.id === id);
  }
  
  getReviewDecisionsByDiscrepancy(discrepancyId: string): ReviewDecision[] {
    return this.reviewDecisions.filter(d => d.discrepancyId === discrepancyId);
  }
  
  getAllReviewDecisions(): ReviewDecision[] {
    return [...this.reviewDecisions];
  }
  
  clearAll(): void {
    this.clearBeds();
    this.clearPatients();
    this.clearWorkOrders();
    this.clearDiscrepancies();
    this.auditLogs = [];
    this.reconciliationRecords = [];
    this.reviewDecisions = [];
  }
}

export const dataStore = DataStore.getInstance();

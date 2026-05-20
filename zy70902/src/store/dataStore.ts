import { v4 as uuidv4 } from 'uuid';
import {
  MaintenanceRecord,
  SensorData,
  ApprovalRecord,
  ReconciliationResult,
  DiffDetail,
  ReviewRecord,
  ReportData,
  BatchImportResult,
} from '../types';

class DataStore {
  private maintenanceRecords: Map<string, MaintenanceRecord> = new Map();
  private sensorData: Map<string, SensorData> = new Map();
  private approvalRecords: Map<string, ApprovalRecord> = new Map();
  private reconciliationResults: Map<string, ReconciliationResult> = new Map();
  private reviewRecords: Map<string, ReviewRecord> = new Map();
  private reports: Map<string, ReportData> = new Map();
  private batchImports: Map<string, BatchImportResult> = new Map();

  addMaintenanceRecord(record: Omit<MaintenanceRecord, 'id' | 'importedAt' | 'source'>): MaintenanceRecord {
    const id = uuidv4();
    const fullRecord: MaintenanceRecord = {
      ...record,
      id,
      source: 'csv',
      importedAt: new Date().toISOString(),
    };
    this.maintenanceRecords.set(id, fullRecord);
    return fullRecord;
  }

  addSensorData(data: Omit<SensorData, 'id' | 'importedAt' | 'source'>): SensorData {
    const id = uuidv4();
    const fullData: SensorData = {
      ...data,
      id,
      source: 'json',
      importedAt: new Date().toISOString(),
    };
    this.sensorData.set(id, fullData);
    return fullData;
  }

  addApprovalRecord(record: Omit<ApprovalRecord, 'id' | 'importedAt'>): ApprovalRecord {
    const id = uuidv4();
    const fullRecord: ApprovalRecord = {
      ...record,
      id,
      importedAt: new Date().toISOString(),
    };
    this.approvalRecords.set(id, fullRecord);
    return fullRecord;
  }

  getMaintenanceRecord(id: string): MaintenanceRecord | undefined {
    return this.maintenanceRecords.get(id);
  }

  getSensorData(id: string): SensorData | undefined {
    return this.sensorData.get(id);
  }

  getApprovalRecord(id: string): ApprovalRecord | undefined {
    return this.approvalRecords.get(id);
  }

  getAllMaintenanceRecords(): MaintenanceRecord[] {
    return Array.from(this.maintenanceRecords.values());
  }

  getAllSensorData(): SensorData[] {
    return Array.from(this.sensorData.values());
  }

  getAllApprovalRecords(): ApprovalRecord[] {
    return Array.from(this.approvalRecords.values());
  }

  getMaintenanceByCableCar(cableCarId: string): MaintenanceRecord[] {
    return this.getAllMaintenanceRecords().filter(r => r.cableCarId === cableCarId);
  }

  getSensorByCableCar(cableCarId: string): SensorData[] {
    return this.getAllSensorData().filter(s => s.cableCarId === cableCarId);
  }

  getApprovalByCableCar(cableCarId: string): ApprovalRecord[] {
    return this.getAllApprovalRecords().filter(a => a.cableCarId === cableCarId);
  }

  addReconciliationResult(result: Omit<ReconciliationResult, 'id' | 'createdAt'>): ReconciliationResult {
    const id = uuidv4();
    const fullResult: ReconciliationResult = {
      ...result,
      id,
      createdAt: new Date().toISOString(),
    };
    this.reconciliationResults.set(id, fullResult);
    return fullResult;
  }

  getReconciliationResult(id: string): ReconciliationResult | undefined {
    return this.reconciliationResults.get(id);
  }

  getAllReconciliationResults(): ReconciliationResult[] {
    return Array.from(this.reconciliationResults.values());
  }

  updateReconciliationResult(id: string, updates: Partial<ReconciliationResult>): ReconciliationResult | undefined {
    const existing = this.reconciliationResults.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...updates };
    this.reconciliationResults.set(id, updated);
    return updated;
  }

  addReviewRecord(record: Omit<ReviewRecord, 'id' | 'reviewedAt'>): ReviewRecord {
    const id = uuidv4();
    const fullRecord: ReviewRecord = {
      ...record,
      id,
      reviewedAt: new Date().toISOString(),
    };
    this.reviewRecords.set(id, fullRecord);
    return fullRecord;
  }

  getReviewRecordsByDiff(diffId: string): ReviewRecord[] {
    return Array.from(this.reviewRecords.values()).filter(r => r.diffId === diffId);
  }

  addReport(report: Omit<ReportData, 'id' | 'generatedAt'>): ReportData {
    const id = uuidv4();
    const fullReport: ReportData = {
      ...report,
      id,
      generatedAt: new Date().toISOString(),
    };
    this.reports.set(id, fullReport);
    return fullReport;
  }

  getReport(id: string): ReportData | undefined {
    return this.reports.get(id);
  }

  getAllReports(): ReportData[] {
    return Array.from(this.reports.values());
  }

  addBatchImport(batch: Omit<BatchImportResult, 'batchId' | 'importedAt'>): BatchImportResult {
    const batchId = uuidv4();
    const fullBatch: BatchImportResult = {
      ...batch,
      batchId,
      importedAt: new Date().toISOString(),
    };
    this.batchImports.set(batchId, fullBatch);
    return fullBatch;
  }

  getBatchImport(batchId: string): BatchImportResult | undefined {
    return this.batchImports.get(batchId);
  }

  clearAll(): void {
    this.maintenanceRecords.clear();
    this.sensorData.clear();
    this.approvalRecords.clear();
    this.reconciliationResults.clear();
    this.reviewRecords.clear();
    this.reports.clear();
    this.batchImports.clear();
  }
}

export const dataStore = new DataStore();

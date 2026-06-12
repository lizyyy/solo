import { ConflictRecordService } from './ConflictRecordService';
import { ProcessingStatus, ConflictRecord, WeeklyReportVersion, ImportBatch } from './types';

const service = new ConflictRecordService();

export const api = {
  importRecords: (
    rows: Array<{
      originalRowNumber: number;
      liveName: string;
      copyrightName: string;
      band: string;
      conflictDescription: string;
    }>,
    importedBy: string,
    source?: string
  ): { batch: ImportBatch; records: ConflictRecord[] } => {
    return service.importRecords(rows, importedBy, source);
  },

  rollbackImportBatch: (batchId: string, rolledBackBy: string, reason: string): ImportBatch | null => {
    return service.rollbackImportBatch(batchId, rolledBackBy, reason);
  },

  getImportBatches: (): ImportBatch[] => {
    return service.getImportBatches();
  },

  getImportBatch: (batchId: string): ImportBatch | null => {
    return service.getImportBatch(batchId);
  },

  getRecords: (includeRolledBack: boolean = false): ConflictRecord[] => {
    return service.getAllUnifiedRecords(includeRolledBack);
  },

  getRecord: (recordId: string): ConflictRecord | null => {
    return service.getUnifiedRecordData(recordId);
  },

  getRecordForPage: (recordId: string): ConflictRecord | null => {
    return service.getUnifiedRecordData(recordId);
  },

  getRecordsForExport: (includeRolledBack: boolean = false): string => {
    return service.exportRecords(includeRolledBack);
  },

  getRecordsForApi: (includeRolledBack: boolean = false): ConflictRecord[] => {
    return service.getAllUnifiedRecords(includeRolledBack);
  },

  addEngineerMessage: (
    recordId: string,
    message: string,
    addedBy: string
  ): ConflictRecord | null => {
    return service.addEngineerMessage(recordId, message, addedBy);
  },

  updateRecordStatus: (
    recordId: string,
    newStatus: ProcessingStatus,
    updatedBy: string,
    reason: string
  ): ConflictRecord | null => {
    return service.updateStatus(recordId, newStatus, updatedBy, reason);
  },

  getRecordChangeHistory: (recordId: string) => {
    return service.getRecordChangeHistory(recordId);
  },

  createWeeklyReport: (createdBy: string): WeeklyReportVersion => {
    return service.createWeeklyReport(createdBy);
  },

  getWeeklyReportVersions: (): WeeklyReportVersion[] => {
    return service.getWeeklyReportVersions();
  },

  getCurrentWeeklyReport: (): WeeklyReportVersion | null => {
    return service.getCurrentWeeklyReport();
  },

  rollbackToPreviousReport: (): WeeklyReportVersion | null => {
    return service.rollbackToPreviousReport();
  },

  rollbackRecordStatus: (
    recordId: string,
    rolledBackBy: string,
    reason: string
  ): ConflictRecord | null => {
    return service.rollbackRecordStatus(recordId, rolledBackBy, reason);
  },

  _getService: (): ConflictRecordService => {
    return service;
  },
};

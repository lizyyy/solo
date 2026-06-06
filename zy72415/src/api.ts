import { ConflictRecordService } from './ConflictRecordService';
import { ProcessingStatus, ConflictRecord, WeeklyReportVersion } from './types';

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
    importedBy: string
  ): ConflictRecord[] => {
    return service.importRecords(rows, importedBy);
  },

  getRecords: (): ConflictRecord[] => {
    return service.getAllUnifiedRecords();
  },

  getRecord: (recordId: string): ConflictRecord | null => {
    return service.getUnifiedRecordData(recordId);
  },

  getRecordForPage: (recordId: string): ConflictRecord | null => {
    return service.getUnifiedRecordData(recordId);
  },

  getRecordsForExport: (): string => {
    return service.exportRecords();
  },

  getRecordsForApi: (): ConflictRecord[] => {
    return service.getAllUnifiedRecords();
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
};

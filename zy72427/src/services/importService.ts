import { v4 as uuidv4 } from 'uuid';
import { insertMany, findMany } from '../database';
import { CardService } from './cardService';
import {
  ClassAttendanceRecord,
  TicketExportRecord,
  AttendanceStatus,
  ImportResultDetail,
} from '../types';

export class ImportService {
  private cardService = new CardService();

  importAttendance(
    cardId: string,
    records: Array<{
      classDate: string;
      className: string;
      studentName: string;
      status: AttendanceStatus;
      sourceNote?: string;
      isGroupMessageOnly?: boolean;
    }>,
    importedBy: string
  ): { 
    batchId: string; 
    records: ClassAttendanceRecord[]; 
    details: ImportResultDetail[];
    summary: {
      newCount: number;
      duplicateCurrentBatchCount: number;
      duplicateHistoricalCount: number;
    };
  } {
    const batchId = uuidv4();
    const now = new Date().toISOString();
    const importedRecords: ClassAttendanceRecord[] = [];
    const details: ImportResultDetail[] = [];

    const existingRecords = this.getAttendanceByCardId(cardId);
    const existingKeyToRecord = new Map<string, ClassAttendanceRecord>();
    for (const r of existingRecords) {
      const key = `${r.classDate}_${r.className}_${r.studentName}`;
      existingKeyToRecord.set(key, r);
    }

    const currentBatchKeys = new Set<string>();
    const recordsToInsert: ClassAttendanceRecord[] = [];

    for (const record of records) {
      const key = `${record.classDate}_${record.className}_${record.studentName}`;
      
      if (currentBatchKeys.has(key)) {
        details.push({
          record: {
            id: '',
            cardId,
            ...record,
            isGroupMessageOnly: record.isGroupMessageOnly || false,
            importedAt: now,
            importBatchId: batchId,
          },
          importStatus: 'DUPLICATE_CURRENT_BATCH',
          duplicateOf: key,
        });
        continue;
      }

      if (existingKeyToRecord.has(key)) {
        const existing = existingKeyToRecord.get(key)!;
        details.push({
          record: {
            id: '',
            cardId,
            ...record,
            isGroupMessageOnly: record.isGroupMessageOnly || false,
            importedAt: now,
            importBatchId: batchId,
          },
          importStatus: 'DUPLICATE_HISTORICAL',
          duplicateOf: `历史记录(${existing.importBatchId.substring(0, 8)}...)`,
        });
        currentBatchKeys.add(key);
        continue;
      }

      currentBatchKeys.add(key);
      const id = uuidv4();
      const attendanceRecord: ClassAttendanceRecord = {
        id,
        cardId,
        classDate: record.classDate,
        className: record.className,
        studentName: record.studentName,
        status: record.status,
        sourceNote: record.sourceNote,
        isGroupMessageOnly: record.isGroupMessageOnly || false,
        importedAt: now,
        importBatchId: batchId,
      };

      recordsToInsert.push(attendanceRecord);
      importedRecords.push(attendanceRecord);
      details.push({
        record: attendanceRecord,
        importStatus: 'NEW',
      });
    }

    if (recordsToInsert.length > 0) {
      insertMany('attendance', recordsToInsert);
    }

    this.cardService.updateCardFields(cardId, {
      attendanceBatchId: batchId,
      status: 'ATTENDANCE_IMPORTED',
    });

    const summary = {
      newCount: details.filter(d => d.importStatus === 'NEW').length,
      duplicateCurrentBatchCount: details.filter(d => d.importStatus === 'DUPLICATE_CURRENT_BATCH').length,
      duplicateHistoricalCount: details.filter(d => d.importStatus === 'DUPLICATE_HISTORICAL').length,
    };

    return { batchId, records: importedRecords, details, summary };
  }

  supplementTickets(
    cardId: string,
    records: Array<{
      classDate: string;
      className: string;
      studentName: string;
      ticketCount: number;
      ticketType: string;
      supplementNote?: string;
    }>,
    supplementedBy: string
  ): { 
    batchId: string; 
    records: TicketExportRecord[];
    details: Array<{
      record: TicketExportRecord;
      importStatus: 'NEW' | 'DUPLICATE_CURRENT_BATCH' | 'DUPLICATE_HISTORICAL' | 'MANUAL_SUPPLEMENT';
      duplicateOf?: string;
      supplementNote?: string;
    }>;
    summary: {
      newCount: number;
      duplicateCurrentBatchCount: number;
      duplicateHistoricalCount: number;
      manualSupplementCount: number;
    };
  } {
    const batchId = uuidv4();
    const now = new Date().toISOString();
    const importedRecords: TicketExportRecord[] = [];
    const details: any[] = [];

    const existingRecords = this.getTicketsByCardId(cardId);
    const existingKeyToRecord = new Map<string, TicketExportRecord>();
    for (const r of existingRecords) {
      const key = `${r.classDate}_${r.className}_${r.studentName}`;
      existingKeyToRecord.set(key, r);
    }

    const currentBatchKeys = new Set<string>();
    const recordsToInsert: TicketExportRecord[] = [];

    for (const record of records) {
      const key = `${record.classDate}_${record.className}_${record.studentName}`;
      
      if (currentBatchKeys.has(key)) {
        details.push({
          record: {
            id: '',
            cardId,
            ...record,
            exportedAt: now,
            exportBatchId: batchId,
          },
          importStatus: 'DUPLICATE_CURRENT_BATCH',
          duplicateOf: key,
        });
        continue;
      }

      const isManualSupplement = !!record.supplementNote;
      
      if (existingKeyToRecord.has(key)) {
        const existing = existingKeyToRecord.get(key)!;
        if (isManualSupplement) {
          details.push({
            record: {
              id: '',
              cardId,
              ...record,
              exportedAt: now,
              exportBatchId: batchId,
            },
            importStatus: 'DUPLICATE_HISTORICAL',
            duplicateOf: `历史记录(${existing.exportBatchId.substring(0, 8)}...)`,
            supplementNote: record.supplementNote,
          });
        } else {
          details.push({
            record: {
              id: '',
              cardId,
              ...record,
              exportedAt: now,
              exportBatchId: batchId,
            },
            importStatus: 'DUPLICATE_HISTORICAL',
            duplicateOf: `历史记录(${existing.exportBatchId.substring(0, 8)}...)`,
          });
        }
        currentBatchKeys.add(key);
        continue;
      }

      currentBatchKeys.add(key);
      const id = uuidv4();
      const ticketRecord: TicketExportRecord = {
        id,
        cardId,
        classDate: record.classDate,
        className: record.className,
        studentName: record.studentName,
        ticketCount: record.ticketCount,
        ticketType: record.ticketType,
        exportedAt: now,
        exportBatchId: batchId,
        supplementNote: record.supplementNote,
      };

      recordsToInsert.push(ticketRecord);
      importedRecords.push(ticketRecord);
      
      const status = isManualSupplement ? 'MANUAL_SUPPLEMENT' : 'NEW';
      details.push({
        record: ticketRecord,
        importStatus: status,
        supplementNote: record.supplementNote,
      });
    }

    if (recordsToInsert.length > 0) {
      insertMany('tickets', recordsToInsert);
    }

    this.cardService.updateCardFields(cardId, {
      ticketBatchId: batchId,
      status: 'TICKET_SUPPLEMENTED',
    });

    const summary = {
      newCount: details.filter(d => d.importStatus === 'NEW').length,
      duplicateCurrentBatchCount: details.filter(d => d.importStatus === 'DUPLICATE_CURRENT_BATCH').length,
      duplicateHistoricalCount: details.filter(d => d.importStatus === 'DUPLICATE_HISTORICAL').length,
      manualSupplementCount: details.filter(d => d.importStatus === 'MANUAL_SUPPLEMENT').length,
    };

    return { batchId, records: importedRecords, details, summary };
  }

  getAttendanceByCardId(cardId: string): ClassAttendanceRecord[] {
    return findMany('attendance', (a: any) => a.cardId === cardId)
      .sort((a, b) => a.classDate.localeCompare(b.classDate)) as ClassAttendanceRecord[];
  }

  getTicketsByCardId(cardId: string): TicketExportRecord[] {
    return findMany('tickets', (t: any) => t.cardId === cardId)
      .sort((a, b) => a.classDate.localeCompare(b.classDate)) as TicketExportRecord[];
  }

  getAttendanceByBatchId(batchId: string): ClassAttendanceRecord[] {
    return findMany('attendance', (a: any) => a.importBatchId === batchId)
      .sort((a, b) => a.classDate.localeCompare(b.classDate)) as ClassAttendanceRecord[];
  }

  getTicketsByBatchId(batchId: string): TicketExportRecord[] {
    return findMany('tickets', (t: any) => t.exportBatchId === batchId)
      .sort((a, b) => a.classDate.localeCompare(b.classDate)) as TicketExportRecord[];
  }
}

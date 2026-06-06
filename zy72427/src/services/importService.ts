import { v4 as uuidv4 } from 'uuid';
import { insertMany, findMany } from '../database';
import { CardService } from './cardService';
import {
  ClassAttendanceRecord,
  TicketExportRecord,
  AttendanceStatus,
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
  ): { batchId: string; records: ClassAttendanceRecord[]; duplicateCount: number } {
    const batchId = uuidv4();
    const now = new Date().toISOString();
    const importedRecords: ClassAttendanceRecord[] = [];
    let duplicateCount = 0;

    const existingRecords = this.getAttendanceByCardId(cardId);
    const existingKeys = new Set(
      existingRecords.map((r) => `${r.classDate}_${r.className}_${r.studentName}`)
    );

    const recordsToInsert: ClassAttendanceRecord[] = [];

    for (const record of records) {
      const key = `${record.classDate}_${record.className}_${record.studentName}`;
      if (existingKeys.has(key)) {
        duplicateCount++;
        continue;
      }

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
    }

    if (recordsToInsert.length > 0) {
      insertMany('attendance', recordsToInsert);
    }

    this.cardService.updateCardFields(cardId, {
      attendanceBatchId: batchId,
      status: 'ATTENDANCE_IMPORTED',
    });

    return { batchId, records: importedRecords, duplicateCount };
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
  ): { batchId: string; records: TicketExportRecord[] } {
    const batchId = uuidv4();
    const now = new Date().toISOString();
    const importedRecords: TicketExportRecord[] = [];

    const recordsToInsert: TicketExportRecord[] = [];

    for (const record of records) {
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
    }

    if (recordsToInsert.length > 0) {
      insertMany('tickets', recordsToInsert);
    }

    this.cardService.updateCardFields(cardId, {
      ticketBatchId: batchId,
      status: 'TICKET_SUPPLEMENTED',
    });

    return { batchId, records: importedRecords };
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

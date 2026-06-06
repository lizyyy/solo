import { v4 as uuidv4 } from 'uuid';
import { insertMany, findOne, findMany, updateOne } from '../database';
import { ImportService } from './importService';
import { CardService } from './cardService';
import {
  ConflictRecord,
  ConflictResolution,
} from '../types';

export class ConflictService {
  private importService = new ImportService();
  private cardService = new CardService();

  detectConflicts(cardId: string): ConflictRecord[] {
    const attendanceRecords = this.importService.getAttendanceByCardId(cardId);
    const ticketRecords = this.importService.getTicketsByCardId(cardId);

    const conflicts: ConflictRecord[] = [];
    const now = new Date().toISOString();

    const ticketMap = new Map<string, any>();
    for (const ticket of ticketRecords) {
      const key = `${ticket.classDate}_${ticket.className}_${ticket.studentName}`;
      ticketMap.set(key, ticket);
    }

    for (const attendance of attendanceRecords) {
      const key = `${attendance.classDate}_${attendance.className}_${attendance.studentName}`;
      const ticket = ticketMap.get(key);

      if (attendance.isGroupMessageOnly) {
        const conflict: ConflictRecord = {
          id: uuidv4(),
          cardId,
          attendanceId: attendance.id,
          ticketId: ticket?.id,
          conflictType: 'GROUP_MESSAGE_ONLY_SUBSTITUTE',
          description: '临时替补仅在群里提及，无正式票务记录，需票务同事复核',
          attendanceData: attendance,
          ticketData: ticket,
          createdAt: now,
        };
        conflicts.push(conflict);
        continue;
      }

      if (!ticket) {
        const conflict: ConflictRecord = {
          id: uuidv4(),
          cardId,
          attendanceId: attendance.id,
          conflictType: 'MISSING_TICKET',
          description: '签到记录存在但无对应票务导出记录',
          attendanceData: attendance,
          createdAt: now,
        };
        conflicts.push(conflict);
        continue;
      }

      if (attendance.status === 'ABSENT' && ticket.ticketCount > 0) {
        const conflict: ConflictRecord = {
          id: uuidv4(),
          cardId,
          attendanceId: attendance.id,
          ticketId: ticket.id,
          conflictType: 'STATUS_TICKET_MISMATCH',
          description: `签到状态为缺席但票务显示有${ticket.ticketCount}张票`,
          attendanceData: attendance,
          ticketData: ticket,
          createdAt: now,
        };
        conflicts.push(conflict);
        continue;
      }

      if (attendance.status === 'NORMAL' || attendance.status === 'MAKEUP') {
        if (ticket.ticketCount === 0) {
          const conflict: ConflictRecord = {
            id: uuidv4(),
            cardId,
            attendanceId: attendance.id,
            ticketId: ticket.id,
            conflictType: 'STATUS_TICKET_MISMATCH',
            description: '签到状态为正常/补录但票务显示0张票',
            attendanceData: attendance,
            ticketData: ticket,
            createdAt: now,
          };
          conflicts.push(conflict);
        }
      }
    }

    if (conflicts.length > 0) {
      insertMany('conflicts', conflicts);
      this.cardService.updateCardStatus(cardId, 'CONFLICT_DETECTED', 'system');
    } else {
      this.cardService.updateCardStatus(cardId, 'CONFLICT_RESOLVED', 'system');
    }

    return conflicts;
  }

  resolveConflict(
    conflictId: string,
    resolution: ConflictResolution,
    resolvedBy: string
  ): ConflictRecord | null {
    const now = new Date().toISOString();
    const updated = updateOne(
      'conflicts',
      (c: any) => c.id === conflictId,
      { resolution, resolvedBy, resolvedAt: now }
    );

    if (!updated) return null;

    const conflict = updated as ConflictRecord;
    const cardConflicts = this.getConflictsByCardId(conflict.cardId);
    const unresolvedCount = cardConflicts.filter((c) => !c.resolution).length;
    if (unresolvedCount === 0) {
      this.cardService.updateCardStatus(conflict.cardId, 'CONFLICT_RESOLVED', resolvedBy);
    }

    return conflict;
  }

  getConflictById(conflictId: string): ConflictRecord | null {
    const row = findOne('conflicts', (c: any) => c.id === conflictId);
    return row as ConflictRecord || null;
  }

  getConflictsByCardId(cardId: string): ConflictRecord[] {
    return findMany('conflicts', (c: any) => c.cardId === cardId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()) as ConflictRecord[];
  }

  getUnresolvedConflicts(cardId: string): ConflictRecord[] {
    return this.getConflictsByCardId(cardId).filter((c) => !c.resolution);
  }
}

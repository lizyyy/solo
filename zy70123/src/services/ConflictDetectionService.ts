import { getDb } from '../database';
import {
  Schedule,
  Conflict,
  ConflictReport,
  ConflictType,
  CompensationType
} from '../types';

export class ConflictDetectionService {
  detectAllConflicts(schedule: Schedule): Conflict[] {
    const db = getDb();
    const conflicts: Conflict[] = [];

    conflicts.push(...this.detectTimeOverlapConflicts(schedule, db));
    conflicts.push(...this.detectKeyWindowConflicts(schedule, db));
    conflicts.push(...this.detectCleaningGapConflicts(schedule, db));
    conflicts.push(...this.detectTicketLockConflicts(schedule, db));

    return conflicts;
  }

  private detectTimeOverlapConflicts(schedule: Schedule, db: any): Conflict[] {
    const conflicts: Conflict[] = [];
    const overlapping = db.getSchedulesByHallAndTime(
      schedule.hallId,
      schedule.startAt,
      schedule.endAt
    ).filter((s: Schedule) => s.id !== schedule.id);

    if (overlapping.length > 0) {
      const conflict = db.createConflict(
        ConflictType.TIME_OVERLAP,
        schedule.id,
        `排片时间与影厅内其他 ${overlapping.length} 场排片重叠`,
        'high',
        overlapping.map((s: Schedule) => s.id)
      );
      conflicts.push(conflict);
    }

    return conflicts;
  }

  private detectKeyWindowConflicts(schedule: Schedule, db: any): Conflict[] {
    const conflicts: Conflict[] = [];
    const keys = db.getKeysByMovie(schedule.movieId);

    const hasValidKey = keys.some((key: any) => {
      return schedule.startAt >= key.startAt && schedule.endAt <= key.endAt;
    });

    if (!hasValidKey && keys.length > 0) {
      const conflict = db.createConflict(
        ConflictType.KEY_WINDOW,
        schedule.id,
        '排片时间不在影片密钥有效期内',
        'high'
      );
      conflicts.push(conflict);
    }

    if (keys.length === 0) {
      const conflict = db.createConflict(
        ConflictType.KEY_WINDOW,
        schedule.id,
        '影片未配置密钥',
        'high'
      );
      conflicts.push(conflict);
    }

    return conflicts;
  }

  private detectCleaningGapConflicts(schedule: Schedule, db: any): Conflict[] {
    const conflicts: Conflict[] = [];
    const cleaningRule = db.getCleaningRuleByHall(schedule.hallId);

    if (!cleaningRule) {
      return conflicts;
    }

    const cleaningDuration = cleaningRule.duration * 60 * 1000;

    const allHallSchedules = db.getSchedulesByHallAndTime(
      schedule.hallId,
      schedule.startAt - cleaningDuration,
      schedule.endAt + cleaningDuration
    ).filter((s: Schedule) => s.id !== schedule.id);

    for (const otherSchedule of allHallSchedules) {
      const gapBefore = schedule.startAt - otherSchedule.endAt;
      const gapAfter = otherSchedule.startAt - schedule.endAt;

      if (gapBefore > 0 && gapBefore < cleaningDuration) {
        const conflict = db.createConflict(
          ConflictType.CLEANING_GAP,
          schedule.id,
          `与前一场排片清洁时间不足，剩余 ${Math.floor(gapBefore / 60000)} 分钟，需要 ${cleaningRule.duration} 分钟`,
          'medium',
          [otherSchedule.id]
        );
        conflicts.push(conflict);
      }

      if (gapAfter > 0 && gapAfter < cleaningDuration) {
        const conflict = db.createConflict(
          ConflictType.CLEANING_GAP,
          schedule.id,
          `与后一场排片清洁时间不足，剩余 ${Math.floor(gapAfter / 60000)} 分钟，需要 ${cleaningRule.duration} 分钟`,
          'medium',
          [otherSchedule.id]
        );
        conflicts.push(conflict);
      }
    }

    return conflicts;
  }

  private detectTicketLockConflicts(schedule: Schedule, db: any): Conflict[] {
    const conflicts: Conflict[] = [];
    
    if (schedule.ticketLock) {
      const conflict = db.createConflict(
        ConflictType.TICKET_LOCK,
        schedule.id,
        '该排片售票已被锁定',
        'low'
      );
      conflicts.push(conflict);
    }

    return conflicts;
  }

  generateConflictReport(conflict: Conflict, schedule: Schedule): ConflictReport {
    const db = getDb();
    const affectedSchedules = conflict.affectedScheduleIds
      ? conflict.affectedScheduleIds.map((id: string) => db.getSchedule(id)).filter(Boolean) as Schedule[]
      : [];

    const report: ConflictReport = {
      conflictId: conflict.id,
      type: conflict.type,
      schedule,
      affectedSchedules: affectedSchedules.length > 0 ? affectedSchedules : undefined,
      description: conflict.description,
      ticketLockRequired: false,
      suggestedCompensations: []
    };

    switch (conflict.type) {
      case ConflictType.TIME_OVERLAP:
        report.ticketLockRequired = true;
        report.ticketLockReason = '排片时间冲突';
        report.suggestedCompensations = [
          { type: CompensationType.RESCHEDULE, description: '建议调整排片时间' },
          { type: CompensationType.MANUAL, description: '需要人工确认冲突解决方式' }
        ];
        break;

      case ConflictType.KEY_WINDOW:
        report.ticketLockRequired = true;
        report.ticketLockReason = '密钥无效';
        report.suggestedCompensations = [
          { type: CompensationType.RESCHEDULE, description: '建议调整排片至密钥有效期内' },
          { type: CompensationType.VOUCHER, description: '若无法调整，建议发放观影券补偿' }
        ];
        break;

      case ConflictType.CLEANING_GAP:
        report.ticketLockRequired = false;
        report.suggestedCompensations = [
          { type: CompensationType.RESCHEDULE, description: '建议调整排片时间以满足清洁间隔' }
        ];
        break;

      case ConflictType.TICKET_LOCK:
        report.ticketLockRequired = true;
        report.ticketLockReason = schedule.ticketLockReason || '售票已锁定';
        report.suggestedCompensations = [
          { type: CompensationType.MANUAL, description: '需要人工解锁售票' }
        ];
        break;
    }

    return report;
  }

  lockTicketsForConflicts(scheduleId: string, reason: string): void {
    const db = getDb();
    const schedule = db.getSchedule(scheduleId);
    if (schedule && !schedule.ticketLock) {
      db.updateSchedule(scheduleId, {
        ticketLock: true,
        ticketLockReason: reason
      });
    }
  }

  unlockTickets(scheduleId: string): void {
    const db = getDb();
    const schedule = db.getSchedule(scheduleId);
    if (schedule && schedule.ticketLock) {
      db.updateSchedule(scheduleId, {
        ticketLock: false,
        ticketLockReason: undefined
      });
    }
  }
}

export const conflictDetectionService = new ConflictDetectionService();

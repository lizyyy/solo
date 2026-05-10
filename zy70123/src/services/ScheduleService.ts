import { getDb } from '../database';
import {
  Schedule,
  ScheduleChangeResult,
  ConflictReport,
  CompensationType
} from '../types';
import { conflictDetectionService } from './ConflictDetectionService';
import { compensationService } from './CompensationService';

export class ScheduleService {
  async createSchedule(
    hallId: string,
    movieId: string,
    startAt: number
  ): Promise<ScheduleChangeResult> {
    const db = getDb();
    const movie = db.getMovie(movieId);
    if (!movie) {
      throw new Error('影片不存在');
    }

    const hall = db.getHall(hallId);
    if (!hall) {
      throw new Error('影厅不存在');
    }

    const endAt = startAt + movie.duration * 60 * 1000;
    const schedule = db.createSchedule(hallId, movieId, startAt, endAt);

    return this.processScheduleChange(schedule);
  }

  async updateSchedule(
    scheduleId: string,
    updates: { startAt?: number; movieId?: string }
  ): Promise<ScheduleChangeResult> {
    const db = getDb();
    const existingSchedule = db.getSchedule(scheduleId);
    if (!existingSchedule) {
      throw new Error('排片不存在');
    }

    let endAt = existingSchedule.endAt;
    let movieId = existingSchedule.movieId;

    if (updates.movieId) {
      const movie = db.getMovie(updates.movieId);
      if (!movie) {
        throw new Error('影片不存在');
      }
      movieId = updates.movieId;
      if (updates.startAt) {
        endAt = updates.startAt + movie.duration * 60 * 1000;
      }
    }

    const schedule = db.updateSchedule(scheduleId, {
      startAt: updates.startAt,
      endAt: updates.startAt ? endAt : undefined,
      movieId: updates.movieId
    });

    return this.processScheduleChange(schedule);
  }

  private async processScheduleChange(schedule: Schedule): Promise<ScheduleChangeResult> {
    const db = getDb();
    const conflicts = conflictDetectionService.detectAllConflicts(schedule);
    const conflictReports: ConflictReport[] = [];
    const ticketLocks: { scheduleId: string; locked: boolean; reason?: string }[] = [];
    const compensationTasks = [];

    for (const conflict of conflicts) {
      const report = conflictDetectionService.generateConflictReport(conflict, schedule);
      conflictReports.push(report);

      if (report.ticketLockRequired && report.ticketLockReason) {
        conflictDetectionService.lockTicketsForConflicts(schedule.id, report.ticketLockReason);
        ticketLocks.push({
          scheduleId: schedule.id,
          locked: true,
          reason: report.ticketLockReason
        });

        const suggestedTypes = report.suggestedCompensations.map(c => c.type);
        if (suggestedTypes.length > 0) {
          const tasks = compensationService.createCompensationTasks(
            schedule.id,
            suggestedTypes,
            {
              conflictType: conflict.type,
              conflictDescription: conflict.description,
              reason: report.ticketLockReason
            },
            3
          );
          compensationTasks.push(...tasks);
        }
      }
    }

    const updatedSchedule = db.getSchedule(schedule.id)!;

    return {
      success: conflicts.length === 0,
      schedule: updatedSchedule,
      conflicts,
      conflictReports,
      ticketLocks,
      compensationTasks
    };
  }

  getSchedule(scheduleId: string): Schedule | undefined {
    const db = getDb();
    return db.getSchedule(scheduleId);
  }

  getConflicts(scheduleId: string) {
    const db = getDb();
    return db.getConflictsBySchedule(scheduleId);
  }

  resolveConflict(conflictId: string): void {
    const db = getDb();
    db.resolveConflict(conflictId);
  }

  unlockScheduleTickets(scheduleId: string): void {
    conflictDetectionService.unlockTickets(scheduleId);
  }

  cancelSchedule(scheduleId: string): Schedule {
    const db = getDb();
    return db.updateSchedule(scheduleId, { status: 'cancelled' });
  }
}

export const scheduleService = new ScheduleService();

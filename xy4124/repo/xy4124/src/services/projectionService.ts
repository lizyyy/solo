import {
  FilmVersionRepository,
  AuditoriumDeviceRepository,
  KDMRepository,
  ScheduleRepository,
  ProjectionCheckRepository,
  AuditLogRepository,
} from '../storage';
import {
  runRules,
  RuleContext,
} from '../rules';
import {
  Schedule,
  ScheduleCreateInput,
  FilmVersion,
  AuditoriumDevice,
  KDM,
  CheckStatus,
  OverallCheckResult,
  CheckTrigger,
  ProjectionCheckCreateInput,
  AuditAction,
  AuditEntityType,
} from '../models';

export class ProjectionService {
  private filmRepo = new FilmVersionRepository();
  private auditoriumRepo = new AuditoriumDeviceRepository();
  private kdmRepo = new KDMRepository();
  private scheduleRepo = new ScheduleRepository();
  private checkRepo = new ProjectionCheckRepository();
  private auditRepo = new AuditLogRepository();

  async createSchedule(input: ScheduleCreateInput, actor: string = 'system'): Promise<{
    schedule: Schedule;
    checkResult: OverallCheckResult;
  }> {
    const schedule = this.scheduleRepo.create(input);
    
    const checkResult = await this.checkSchedule(schedule.scheduleId);
    
    this.auditRepo.create({
      action: AuditAction.CREATE,
      entityType: AuditEntityType.SCHEDULE,
      entityId: schedule.scheduleId,
      actor,
      actorRole: 'operator',
      success: true,
      details: {
        schedule: {
          filmId: schedule.filmId,
          versionId: schedule.versionId,
          auditoriumId: schedule.auditoriumId,
          showTime: schedule.showTime,
        },
        checkResult: {
          overallStatus: checkResult.overallStatus,
          checkCount: checkResult.checks.length,
        },
      },
    });
    
    return { schedule, checkResult };
  }

  async checkSchedule(scheduleId: string, trigger: CheckTrigger = CheckTrigger.ON_DEMAND, actor?: string): Promise<OverallCheckResult> {
    const schedule = this.scheduleRepo.findByScheduleId(scheduleId);
    
    if (!schedule) {
      throw new Error(`Schedule not found: ${scheduleId}`);
    }
    
    const filmVersion = this.filmRepo.findByFilmAndVersion(schedule.filmId, schedule.versionId);
    const auditoriumDevice = this.auditoriumRepo.findByAuditoriumId(schedule.auditoriumId);
    const kdms = this.kdmRepo.findByFilmVersionAuditorium(
      schedule.filmId,
      schedule.versionId,
      schedule.auditoriumId
    );
    const overlappingSchedules = this.scheduleRepo.findByAuditoriumAndTime(
      schedule.auditoriumId,
      schedule.showTime,
      schedule.scheduleId
    );
    
    const context: RuleContext = {
      schedule,
      filmVersion,
      auditoriumDevice,
      kdms,
      overlappingSchedules,
    };
    
    const checkResult = runRules(context);
    
    const checkInput: ProjectionCheckCreateInput = {
      scheduleId,
      overallStatus: checkResult.overallStatus,
      checks: checkResult.checks,
      checkTrigger: trigger,
      checkedBy: actor,
    };
    
    this.checkRepo.create(checkInput);
    
    return checkResult;
  }

  async checkAllSchedules(dateRange?: { start: string; end: string }, actor?: string): Promise<Map<string, OverallCheckResult>> {
    let schedules: Schedule[];
    
    if (dateRange) {
      schedules = this.scheduleRepo.findByDateRange(dateRange.start, dateRange.end);
    } else {
      schedules = this.scheduleRepo.findAll();
    }
    
    const results = new Map<string, OverallCheckResult>();
    
    for (const schedule of schedules) {
      if (!schedule.isCancelled) {
        const result = await this.checkSchedule(schedule.scheduleId, CheckTrigger.SCHEDULED, actor);
        results.set(schedule.scheduleId, result);
      }
    }
    
    return results;
  }

  getScheduleCheckResult(scheduleId: string): {
    schedule: Schedule;
    filmVersion: FilmVersion | null;
    auditorium: AuditoriumDevice | null;
    kdms: KDM[];
    latestCheck: {
      status: CheckStatus;
      checks: any[];
      checkedAt: string;
    } | null;
  } {
    const schedule = this.scheduleRepo.findByScheduleId(scheduleId);
    
    if (!schedule) {
      throw new Error(`Schedule not found: ${scheduleId}`);
    }
    
    const filmVersion = this.filmRepo.findByFilmAndVersion(schedule.filmId, schedule.versionId);
    const auditorium = this.auditoriumRepo.findByAuditoriumId(schedule.auditoriumId);
    const kdms = this.kdmRepo.findByFilmVersionAuditorium(
      schedule.filmId,
      schedule.versionId,
      schedule.auditoriumId
    );
    
    const latestCheckRecord = this.checkRepo.findLatestByScheduleId(scheduleId);
    const latestCheck = latestCheckRecord ? {
      status: latestCheckRecord.overallStatus,
      checks: latestCheckRecord.checks,
      checkedAt: latestCheckRecord.createdAt,
    } : null;
    
    return {
      schedule,
      filmVersion,
      auditorium,
      kdms,
      latestCheck,
    };
  }

  cancelSchedule(scheduleId: string, reason: string, actor: string = 'system'): Schedule {
    const schedule = this.scheduleRepo.cancel(scheduleId, reason);
    
    this.auditRepo.create({
      action: AuditAction.UPDATE,
      entityType: AuditEntityType.SCHEDULE,
      entityId: scheduleId,
      actor,
      actorRole: 'operator',
      success: true,
      details: {
        action: 'cancel',
        reason,
      },
    });
    
    return schedule;
  }

  deleteSchedule(scheduleId: string, actor: string = 'system'): void {
    const schedule = this.scheduleRepo.findByScheduleId(scheduleId);
    
    if (!schedule) {
      throw new Error(`Schedule not found: ${scheduleId}`);
    }
    
    this.scheduleRepo.delete(schedule.id);
    
    this.auditRepo.create({
      action: AuditAction.DELETE,
      entityType: AuditEntityType.SCHEDULE,
      entityId: scheduleId,
      actor,
      actorRole: 'operator',
      success: true,
    });
  }

  getAllSchedules(): Schedule[] {
    return this.scheduleRepo.findAll();
  }

  getSchedulesByDateRange(start: string, end: string): Schedule[] {
    return this.scheduleRepo.findByDateRange(start, end);
  }

  getFilmVersions(): FilmVersion[] {
    return this.filmRepo.findAll();
  }

  getAuditoriums(): AuditoriumDevice[] {
    return this.auditoriumRepo.findAll();
  }

  getKDMs(): KDM[] {
    return this.kdmRepo.findAll();
  }
}

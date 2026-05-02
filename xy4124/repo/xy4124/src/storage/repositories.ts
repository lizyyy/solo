import { v4 as uuidv4 } from 'uuid';
import { getDatabase } from './database';
import {
  FilmVersion, FilmVersionCreateInput,
  AuditoriumDevice, AuditoriumDeviceCreateInput,
  KDM, KDMCreateInput,
  Schedule, ScheduleCreateInput,
  ProjectionCheck, ProjectionCheckCreateInput,
  AuditLog, AuditLogCreateInput,
  TimestampRange,
} from '../models';

function nowISO(): string {
  return new Date().toISOString();
}

function parseJSON<T>(value: string | null): T | null {
  if (value === null) return null;
  return JSON.parse(value);
}

function stringifyJSON(value: unknown): string {
  return JSON.stringify(value);
}

export class FilmVersionRepository {
  private db = getDatabase();

  create(input: FilmVersionCreateInput): FilmVersion {
    const id = uuidv4();
    const now = nowISO();
    
    const stmt = this.db.prepare(`
      INSERT INTO film_versions (
        id, film_id, film_title, version_id, version_name,
        audio_language, subtitle_language, subtitle_type,
        aspect_ratio, sound_format, runtime_minutes, dcp_hash,
        notes, is_active, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
    `);
    
    stmt.run(
      id, input.filmId, input.filmTitle, input.versionId, input.versionName,
      input.audioLanguage, input.subtitleLanguage, input.subtitleType,
      input.aspectRatio, input.soundFormat, input.runtimeMinutes, input.dcpHash,
      input.notes, now, now
    );
    
    return this.findById(id)!;
  }

  findById(id: string): FilmVersion | null {
    const stmt = this.db.prepare(`SELECT * FROM film_versions WHERE id = ?`);
    const row = stmt.get(id) as any;
    return this.rowToFilmVersion(row);
  }

  findByFilmAndVersion(filmId: string, versionId: string): FilmVersion | null {
    const stmt = this.db.prepare(
      `SELECT * FROM film_versions WHERE film_id = ? AND version_id = ?`
    );
    const row = stmt.get(filmId, versionId) as any;
    return this.rowToFilmVersion(row);
  }

  findAll(onlyActive: boolean = true): FilmVersion[] {
    let query = `SELECT * FROM film_versions`;
    const params: any[] = [];
    
    if (onlyActive) {
      query += ` WHERE is_active = 1`;
    }
    
    const stmt = this.db.prepare(query);
    const rows = stmt.all(...params) as any[];
    return rows.map(row => this.rowToFilmVersion(row)!);
  }

  update(id: string, updates: Partial<FilmVersionCreateInput>): FilmVersion {
    const now = nowISO();
    const setClauses: string[] = ['updated_at = ?'];
    const values: any[] = [now];
    
    const fieldMap: Record<string, string> = {
      filmId: 'film_id',
      filmTitle: 'film_title',
      versionId: 'version_id',
      versionName: 'version_name',
      audioLanguage: 'audio_language',
      subtitleLanguage: 'subtitle_language',
      subtitleType: 'subtitle_type',
      aspectRatio: 'aspect_ratio',
      soundFormat: 'sound_format',
      runtimeMinutes: 'runtime_minutes',
      dcpHash: 'dcp_hash',
      notes: 'notes',
    };
    
    for (const [key, dbField] of Object.entries(fieldMap)) {
      if (key in updates) {
        setClauses.push(`${dbField} = ?`);
        values.push((updates as any)[key]);
      }
    }
    
    values.push(id);
    
    const stmt = this.db.prepare(
      `UPDATE film_versions SET ${setClauses.join(', ')} WHERE id = ?`
    );
    stmt.run(...values);
    
    return this.findById(id)!;
  }

  deactivate(id: string): FilmVersion {
    const now = nowISO();
    const stmt = this.db.prepare(
      `UPDATE film_versions SET is_active = 0, updated_at = ? WHERE id = ?`
    );
    stmt.run(now, id);
    return this.findById(id)!;
  }

  private rowToFilmVersion(row: any): FilmVersion | null {
    if (!row) return null;
    return {
      id: row.id,
      filmId: row.film_id,
      filmTitle: row.film_title,
      versionId: row.version_id,
      versionName: row.version_name,
      audioLanguage: row.audio_language,
      subtitleLanguage: row.subtitle_language,
      subtitleType: row.subtitle_type,
      aspectRatio: row.aspect_ratio,
      soundFormat: row.sound_format,
      runtimeMinutes: row.runtime_minutes,
      dcpHash: row.dcp_hash,
      notes: row.notes,
      isActive: row.is_active === 1,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}

export class AuditoriumDeviceRepository {
  private db = getDatabase();

  create(input: AuditoriumDeviceCreateInput): AuditoriumDevice {
    const id = uuidv4();
    const now = nowISO();
    
    const stmt = this.db.prepare(`
      INSERT INTO auditorium_devices (
        id, auditorium_id, auditorium_name, seat_count,
        supported_aspect_ratios, supported_sound_formats,
        status, status_reason, last_maintenance, next_maintenance,
        is_active, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
    `);
    
    stmt.run(
      id, input.auditoriumId, input.auditoriumName, input.seatCount,
      stringifyJSON(input.supportedFormats.aspectRatios),
      stringifyJSON(input.supportedFormats.soundFormats),
      input.status, input.statusReason, input.lastMaintenance, input.nextMaintenance,
      now, now
    );
    
    return this.findById(id)!;
  }

  findById(id: string): AuditoriumDevice | null {
    const stmt = this.db.prepare(`SELECT * FROM auditorium_devices WHERE id = ?`);
    const row = stmt.get(id) as any;
    return this.rowToAuditoriumDevice(row);
  }

  findByAuditoriumId(auditoriumId: string): AuditoriumDevice | null {
    const stmt = this.db.prepare(
      `SELECT * FROM auditorium_devices WHERE auditorium_id = ?`
    );
    const row = stmt.get(auditoriumId) as any;
    return this.rowToAuditoriumDevice(row);
  }

  findAll(onlyActive: boolean = true): AuditoriumDevice[] {
    let query = `SELECT * FROM auditorium_devices`;
    const params: any[] = [];
    
    if (onlyActive) {
      query += ` WHERE is_active = 1`;
    }
    
    const stmt = this.db.prepare(query);
    const rows = stmt.all(...params) as any[];
    return rows.map(row => this.rowToAuditoriumDevice(row)!);
  }

  update(id: string, updates: Partial<AuditoriumDeviceCreateInput>): AuditoriumDevice {
    const now = nowISO();
    const setClauses: string[] = ['updated_at = ?'];
    const values: any[] = [now];
    
    const fieldMap: Record<string, string> = {
      auditoriumId: 'auditorium_id',
      auditoriumName: 'auditorium_name',
      seatCount: 'seat_count',
      status: 'status',
      statusReason: 'status_reason',
      lastMaintenance: 'last_maintenance',
      nextMaintenance: 'next_maintenance',
    };
    
    for (const [key, dbField] of Object.entries(fieldMap)) {
      if (key in updates) {
        setClauses.push(`${dbField} = ?`);
        values.push((updates as any)[key]);
      }
    }
    
    if (updates.supportedFormats) {
      setClauses.push('supported_aspect_ratios = ?');
      values.push(stringifyJSON(updates.supportedFormats.aspectRatios));
      setClauses.push('supported_sound_formats = ?');
      values.push(stringifyJSON(updates.supportedFormats.soundFormats));
    }
    
    values.push(id);
    
    const stmt = this.db.prepare(
      `UPDATE auditorium_devices SET ${setClauses.join(', ')} WHERE id = ?`
    );
    stmt.run(...values);
    
    return this.findById(id)!;
  }

  deactivate(id: string): AuditoriumDevice {
    const now = nowISO();
    const stmt = this.db.prepare(
      `UPDATE auditorium_devices SET is_active = 0, updated_at = ? WHERE id = ?`
    );
    stmt.run(now, id);
    return this.findById(id)!;
  }

  private rowToAuditoriumDevice(row: any): AuditoriumDevice | null {
    if (!row) return null;
    return {
      id: row.id,
      auditoriumId: row.auditorium_id,
      auditoriumName: row.auditorium_name,
      seatCount: row.seat_count,
      supportedFormats: {
        aspectRatios: parseJSON<string[]>(row.supported_aspect_ratios) || [],
        soundFormats: parseJSON<string[]>(row.supported_sound_formats) || [],
      },
      status: row.status,
      statusReason: row.status_reason,
      lastMaintenance: row.last_maintenance,
      nextMaintenance: row.next_maintenance,
      isActive: row.is_active === 1,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}

export class KDMRepository {
  private db = getDatabase();

  create(input: KDMCreateInput): KDM {
    const id = uuidv4();
    const now = nowISO();
    
    const stmt = this.db.prepare(`
      INSERT INTO kdms (
        id, kdm_id, film_id, version_id, auditorium_id,
        validity_start, validity_end, cpl_id, issuer, issuer_org,
        content_title_text, notes, is_active, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
    `);
    
    stmt.run(
      id, input.kdmId, input.filmId, input.versionId, input.auditoriumId,
      input.validity.start, input.validity.end, input.cplId, input.issuer, input.issuerOrg,
      input.contentTitleText, input.notes, now, now
    );
    
    return this.findById(id)!;
  }

  findById(id: string): KDM | null {
    const stmt = this.db.prepare(`SELECT * FROM kdms WHERE id = ?`);
    const row = stmt.get(id) as any;
    return this.rowToKDM(row);
  }

  findByKDMId(kdmId: string): KDM | null {
    const stmt = this.db.prepare(`SELECT * FROM kdms WHERE kdm_id = ?`);
    const row = stmt.get(kdmId) as any;
    return this.rowToKDM(row);
  }

  findByFilmVersionAuditorium(filmId: string, versionId: string, auditoriumId: string): KDM[] {
    const stmt = this.db.prepare(`
      SELECT * FROM kdms 
      WHERE film_id = ? AND version_id = ? AND auditorium_id = ? AND is_active = 1
      ORDER BY validity_start ASC
    `);
    const rows = stmt.all(filmId, versionId, auditoriumId) as any[];
    return rows.map(row => this.rowToKDM(row)!);
  }

  findOverlapping(filmId: string, versionId: string, auditoriumId: string, timeRange: TimestampRange): KDM[] {
    const stmt = this.db.prepare(`
      SELECT * FROM kdms 
      WHERE film_id = ? AND version_id = ? AND auditorium_id = ? 
        AND is_active = 1
        AND validity_start <= ? AND validity_end >= ?
      ORDER BY validity_start ASC
    `);
    const rows = stmt.all(filmId, versionId, auditoriumId, timeRange.end, timeRange.start) as any[];
    return rows.map(row => this.rowToKDM(row)!);
  }

  findAll(onlyActive: boolean = true): KDM[] {
    let query = `SELECT * FROM kdms`;
    const params: any[] = [];
    
    if (onlyActive) {
      query += ` WHERE is_active = 1`;
    }
    query += ` ORDER BY validity_start ASC`;
    
    const stmt = this.db.prepare(query);
    const rows = stmt.all(...params) as any[];
    return rows.map(row => this.rowToKDM(row)!);
  }

  deactivate(id: string): KDM {
    const now = nowISO();
    const stmt = this.db.prepare(
      `UPDATE kdms SET is_active = 0, updated_at = ? WHERE id = ?`
    );
    stmt.run(now, id);
    return this.findById(id)!;
  }

  private rowToKDM(row: any): KDM | null {
    if (!row) return null;
    return {
      id: row.id,
      kdmId: row.kdm_id,
      filmId: row.film_id,
      versionId: row.version_id,
      auditoriumId: row.auditorium_id,
      validity: {
        start: row.validity_start,
        end: row.validity_end,
      },
      cplId: row.cpl_id,
      issuer: row.issuer,
      issuerOrg: row.issuer_org,
      contentTitleText: row.content_title_text,
      notes: row.notes,
      isActive: row.is_active === 1,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}

export class ScheduleRepository {
  private db = getDatabase();

  create(input: ScheduleCreateInput): Schedule {
    const id = uuidv4();
    const scheduleId = input.scheduleId || uuidv4();
    const now = nowISO();
    
    const showEnd = new Date(input.showTime.start);
    showEnd.setMinutes(showEnd.getMinutes() + input.preShowMinutes + input.bufferMinutesBefore);
    
    const actualEndTime = showEnd.toISOString();
    
    const stmt = this.db.prepare(`
      INSERT INTO schedules (
        id, schedule_id, film_id, version_id, auditorium_id,
        show_start, show_end, pre_show_minutes, buffer_before_minutes,
        buffer_after_minutes, actual_end_time, notes, is_cancelled,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
    `);
    
    stmt.run(
      id, scheduleId, input.filmId, input.versionId, input.auditoriumId,
      input.showTime.start, input.showTime.end, input.preShowMinutes,
      input.bufferMinutesBefore, input.bufferMinutesAfter,
      actualEndTime, input.notes, now, now
    );
    
    return this.findById(id)!;
  }

  findById(id: string): Schedule | null {
    const stmt = this.db.prepare(`SELECT * FROM schedules WHERE id = ?`);
    const row = stmt.get(id) as any;
    return this.rowToSchedule(row);
  }

  findByScheduleId(scheduleId: string): Schedule | null {
    const stmt = this.db.prepare(`SELECT * FROM schedules WHERE schedule_id = ?`);
    const row = stmt.get(scheduleId) as any;
    return this.rowToSchedule(row);
  }

  findByAuditoriumAndTime(auditoriumId: string, timeRange: TimestampRange, excludeScheduleId?: string): Schedule[] {
    let query = `
      SELECT * FROM schedules 
      WHERE auditorium_id = ? 
        AND is_cancelled = 0
        AND (
          (show_start <= ? AND show_end > ?)
          OR (show_start < ? AND show_end >= ?)
          OR (show_start >= ? AND show_end <= ?)
        )
    `;
    const params: any[] = [
      auditoriumId,
      timeRange.start, timeRange.start,
      timeRange.end, timeRange.end,
      timeRange.start, timeRange.end
    ];
    
    if (excludeScheduleId) {
      query += ` AND schedule_id != ?`;
      params.push(excludeScheduleId);
    }
    
    query += ` ORDER BY show_start ASC`;
    
    const stmt = this.db.prepare(query);
    const rows = stmt.all(...params) as any[];
    return rows.map(row => this.rowToSchedule(row)!);
  }

  findByDateRange(startDate: string, endDate: string): Schedule[] {
    const stmt = this.db.prepare(`
      SELECT * FROM schedules 
      WHERE show_start >= ? AND show_start <= ?
      ORDER BY show_start ASC
    `);
    const rows = stmt.all(startDate, endDate) as any[];
    return rows.map(row => this.rowToSchedule(row)!);
  }

  findAll(): Schedule[] {
    const stmt = this.db.prepare(`SELECT * FROM schedules ORDER BY show_start ASC`);
    const rows = stmt.all() as any[];
    return rows.map(row => this.rowToSchedule(row)!);
  }

  cancel(scheduleId: string, reason: string): Schedule {
    const now = nowISO();
    const stmt = this.db.prepare(
      `UPDATE schedules SET is_cancelled = 1, cancel_reason = ?, updated_at = ? WHERE schedule_id = ?`
    );
    stmt.run(reason, now, scheduleId);
    return this.findByScheduleId(scheduleId)!;
  }

  delete(id: string): void {
    const stmt = this.db.prepare(`DELETE FROM schedules WHERE id = ?`);
    stmt.run(id);
  }

  private rowToSchedule(row: any): Schedule | null {
    if (!row) return null;
    return {
      id: row.id,
      scheduleId: row.schedule_id,
      filmId: row.film_id,
      versionId: row.version_id,
      auditoriumId: row.auditorium_id,
      showTime: {
        start: row.show_start,
        end: row.show_end,
      },
      preShowMinutes: row.pre_show_minutes,
      bufferMinutesBefore: row.buffer_before_minutes,
      bufferMinutesAfter: row.buffer_after_minutes,
      actualEndTime: row.actual_end_time,
      notes: row.notes,
      isCancelled: row.is_cancelled === 1,
      cancelReason: row.cancel_reason,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}

export class ProjectionCheckRepository {
  private db = getDatabase();

  create(input: ProjectionCheckCreateInput): ProjectionCheck {
    const id = uuidv4();
    const checkId = uuidv4();
    const now = nowISO();
    
    const stmt = this.db.prepare(`
      INSERT INTO projection_checks (
        id, check_id, schedule_id, overall_status, checks,
        check_trigger, checked_by, notes, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(
      id, checkId, input.scheduleId, input.overallStatus,
      stringifyJSON(input.checks), input.checkTrigger,
      input.checkedBy, input.notes, now, now
    );
    
    return this.findById(id)!;
  }

  findById(id: string): ProjectionCheck | null {
    const stmt = this.db.prepare(`SELECT * FROM projection_checks WHERE id = ?`);
    const row = stmt.get(id) as any;
    return this.rowToProjectionCheck(row);
  }

  findByScheduleId(scheduleId: string): ProjectionCheck[] {
    const stmt = this.db.prepare(`
      SELECT * FROM projection_checks 
      WHERE schedule_id = ? 
      ORDER BY created_at DESC
    `);
    const rows = stmt.all(scheduleId) as any[];
    return rows.map(row => this.rowToProjectionCheck(row)!);
  }

  findLatestByScheduleId(scheduleId: string): ProjectionCheck | null {
    const stmt = this.db.prepare(`
      SELECT * FROM projection_checks 
      WHERE schedule_id = ? 
      ORDER BY created_at DESC
      LIMIT 1
    `);
    const row = stmt.get(scheduleId) as any;
    return this.rowToProjectionCheck(row);
  }

  findAll(): ProjectionCheck[] {
    const stmt = this.db.prepare(`SELECT * FROM projection_checks ORDER BY created_at DESC`);
    const rows = stmt.all() as any[];
    return rows.map(row => this.rowToProjectionCheck(row)!);
  }

  private rowToProjectionCheck(row: any): ProjectionCheck | null {
    if (!row) return null;
    return {
      id: row.id,
      checkId: row.check_id,
      scheduleId: row.schedule_id,
      overallStatus: row.overall_status,
      checks: parseJSON(row.checks) || [],
      checkTrigger: row.check_trigger,
      checkedBy: row.checked_by,
      notes: row.notes,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}

export class AuditLogRepository {
  private db = getDatabase();

  create(input: AuditLogCreateInput): AuditLog {
    const id = uuidv4();
    const auditId = uuidv4();
    const now = nowISO();
    
    const stmt = this.db.prepare(`
      INSERT INTO audit_logs (
        id, audit_id, action, entity_type, entity_id, actor, actor_role,
        changes, old_values, new_values, details, ip_address, user_agent,
        success, error_message, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(
      id, auditId, input.action, input.entityType, input.entityId,
      input.actor, input.actorRole,
      input.changes ? stringifyJSON(input.changes) : null,
      input.oldValues ? stringifyJSON(input.oldValues) : null,
      input.newValues ? stringifyJSON(input.newValues) : null,
      input.details ? stringifyJSON(input.details) : null,
      input.ipAddress, input.userAgent,
      input.success ? 1 : 0, input.errorMessage,
      now, now
    );
    
    return this.findById(id)!;
  }

  findById(id: string): AuditLog | null {
    const stmt = this.db.prepare(`SELECT * FROM audit_logs WHERE id = ?`);
    const row = stmt.get(id) as any;
    return this.rowToAuditLog(row);
  }

  findByEntity(entityType: string, entityId: string): AuditLog[] {
    const stmt = this.db.prepare(`
      SELECT * FROM audit_logs 
      WHERE entity_type = ? AND entity_id = ?
      ORDER BY created_at DESC
    `);
    const rows = stmt.all(entityType, entityId) as any[];
    return rows.map(row => this.rowToAuditLog(row)!);
  }

  findByDateRange(startDate: string, endDate: string): AuditLog[] {
    const stmt = this.db.prepare(`
      SELECT * FROM audit_logs 
      WHERE created_at >= ? AND created_at <= ?
      ORDER BY created_at DESC
    `);
    const rows = stmt.all(startDate, endDate) as any[];
    return rows.map(row => this.rowToAuditLog(row)!);
  }

  findAll(limit: number = 100): AuditLog[] {
    const stmt = this.db.prepare(`
      SELECT * FROM audit_logs 
      ORDER BY created_at DESC
      LIMIT ?
    `);
    const rows = stmt.all(limit) as any[];
    return rows.map(row => this.rowToAuditLog(row)!);
  }

  private rowToAuditLog(row: any): AuditLog | null {
    if (!row) return null;
    return {
      id: row.id,
      auditId: row.audit_id,
      action: row.action,
      entityType: row.entity_type,
      entityId: row.entity_id,
      actor: row.actor,
      actorRole: row.actor_role,
      changes: parseJSON(row.changes),
      oldValues: parseJSON(row.old_values),
      newValues: parseJSON(row.new_values),
      details: parseJSON(row.details),
      ipAddress: row.ip_address,
      userAgent: row.user_agent,
      success: row.success === 1,
      errorMessage: row.error_message,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}

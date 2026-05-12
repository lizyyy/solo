import sqlite3 from 'sqlite3';
import { v4 as uuidv4 } from 'uuid';
import {
  Appointment,
  Authorization,
  ChangeLog,
  AppointmentStatus,
  AuthorizationStatus,
  ChangeSource,
  CreateAppointmentRequest
} from './types';

export class Database {
  private db: sqlite3.Database;

  constructor(dbPath: string = './parking.db') {
    this.db = new sqlite3.Database(dbPath);
  }

  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.serialize(() => {
        this.db.run(`
          CREATE TABLE IF NOT EXISTS appointments (
            id TEXT PRIMARY KEY,
            request_id TEXT UNIQUE NOT NULL,
            visitor_name TEXT NOT NULL,
            visitor_phone TEXT NOT NULL,
            visitor_company TEXT NOT NULL,
            host_name TEXT NOT NULL,
            host_department TEXT NOT NULL,
            license_plate TEXT NOT NULL,
            meeting_subject TEXT NOT NULL,
            start_time TEXT NOT NULL,
            end_time TEXT NOT NULL,
            status TEXT NOT NULL,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
          )
        `);

        this.db.run(`
          CREATE TABLE IF NOT EXISTS authorizations (
            id TEXT PRIMARY KEY,
            appointment_id TEXT NOT NULL,
            license_plate TEXT NOT NULL,
            valid_from TEXT NOT NULL,
            valid_to TEXT NOT NULL,
            status TEXT NOT NULL,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            FOREIGN KEY (appointment_id) REFERENCES appointments(id)
          )
        `);

        this.db.run(`
          CREATE TABLE IF NOT EXISTS change_logs (
            id TEXT PRIMARY KEY,
            entity_type TEXT NOT NULL,
            entity_id TEXT NOT NULL,
            field TEXT NOT NULL,
            old_value TEXT,
            new_value TEXT,
            source TEXT NOT NULL,
            operator_id TEXT,
            operator_name TEXT,
            remark TEXT,
            created_at TEXT NOT NULL
          )
        `);

        this.db.run(`CREATE INDEX IF NOT EXISTS idx_appointments_license_plate ON appointments(license_plate)`);
        this.db.run(`CREATE INDEX IF NOT EXISTS idx_appointments_status ON appointments(status)`);
        this.db.run(`CREATE INDEX IF NOT EXISTS idx_appointments_request_id ON appointments(request_id)`);
        this.db.run(`CREATE INDEX IF NOT EXISTS idx_authorizations_license_plate ON authorizations(license_plate)`);
        this.db.run(`CREATE INDEX IF NOT EXISTS idx_authorizations_status ON authorizations(status)`);
        this.db.run(`CREATE INDEX IF NOT EXISTS idx_change_logs_entity ON change_logs(entity_type, entity_id)`);

        resolve();
      });
    });
  }

  private async runQuery(sql: string, params: any[] = []): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.run(sql, params, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  private async getOne<T>(sql: string, params: any[] = []): Promise<T | null> {
    return new Promise((resolve, reject) => {
      this.db.get(sql, params, (err, row: any) => {
        if (err) reject(err);
        else resolve(row || null);
      });
    });
  }

  private async getAll<T>(sql: string, params: any[] = []): Promise<T[]> {
    return new Promise((resolve, reject) => {
      this.db.all(sql, params, (err, rows: any[]) => {
        if (err) reject(err);
        else resolve(rows || []);
      });
    });
  }

  private mapToAppointment(row: any): Appointment {
    return {
      id: row.id,
      requestId: row.request_id,
      visitorName: row.visitor_name,
      visitorPhone: row.visitor_phone,
      visitorCompany: row.visitor_company,
      hostName: row.host_name,
      hostDepartment: row.host_department,
      licensePlate: row.license_plate,
      meetingSubject: row.meeting_subject,
      startTime: row.start_time,
      endTime: row.end_time,
      status: row.status as AppointmentStatus,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  private mapToAuthorization(row: any): Authorization {
    return {
      id: row.id,
      appointmentId: row.appointment_id,
      licensePlate: row.license_plate,
      validFrom: row.valid_from,
      validTo: row.valid_to,
      status: row.status as AuthorizationStatus,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  private mapToChangeLog(row: any): ChangeLog {
    return {
      id: row.id,
      entityType: row.entity_type as 'appointment' | 'authorization',
      entityId: row.entity_id,
      field: row.field,
      oldValue: row.old_value,
      newValue: row.new_value,
      source: row.source as ChangeSource,
      operatorId: row.operator_id,
      operatorName: row.operator_name,
      remark: row.remark,
      createdAt: row.created_at
    };
  }

  async createAppointment(req: CreateAppointmentRequest): Promise<Appointment> {
    const now = new Date().toISOString();
    const id = uuidv4();
    const appointment: Appointment = {
      id,
      requestId: req.requestId,
      visitorName: req.visitorName,
      visitorPhone: req.visitorPhone,
      visitorCompany: req.visitorCompany,
      hostName: req.hostName,
      hostDepartment: req.hostDepartment,
      licensePlate: req.licensePlate,
      meetingSubject: req.meetingSubject,
      startTime: req.startTime,
      endTime: req.endTime,
      status: AppointmentStatus.PENDING,
      createdAt: now,
      updatedAt: now
    };

    await this.runQuery(
      `INSERT INTO appointments (
        id, request_id, visitor_name, visitor_phone, visitor_company,
        host_name, host_department, license_plate, meeting_subject,
        start_time, end_time, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        appointment.id,
        appointment.requestId,
        appointment.visitorName,
        appointment.visitorPhone,
        appointment.visitorCompany,
        appointment.hostName,
        appointment.hostDepartment,
        appointment.licensePlate,
        appointment.meetingSubject,
        appointment.startTime,
        appointment.endTime,
        appointment.status,
        appointment.createdAt,
        appointment.updatedAt
      ]
    );

    await this.logChange(
      'appointment',
      appointment.id,
      'status',
      null,
      appointment.status,
      ChangeSource.USER_CREATE,
      null,
      null,
      '创建预约'
    );

    return appointment;
  }

  async getAppointmentById(id: string): Promise<Appointment | null> {
    const row = await this.getOne<any>('SELECT * FROM appointments WHERE id = ?', [id]);
    return row ? this.mapToAppointment(row) : null;
  }

  async getAppointmentByRequestId(requestId: string): Promise<Appointment | null> {
    const row = await this.getOne<any>('SELECT * FROM appointments WHERE request_id = ?', [requestId]);
    return row ? this.mapToAppointment(row) : null;
  }

  async getConflictingAppointments(
    licensePlate: string,
    startTime: string,
    endTime: string,
    excludeAppointmentId?: string
  ): Promise<Appointment[]> {
    let sql = `
      SELECT * FROM appointments 
      WHERE license_plate = ?
      AND status NOT IN (?, ?, ?)
      AND (
        (start_time <= ? AND end_time >= ?) OR
        (start_time >= ? AND start_time <= ?) OR
        (end_time >= ? AND end_time <= ?)
      )
    `;
    const params: any[] = [
      licensePlate,
      AppointmentStatus.REJECTED,
      AppointmentStatus.CANCELLED,
      AppointmentStatus.CHECKED_OUT,
      endTime,
      startTime,
      startTime,
      endTime,
      startTime,
      endTime
    ];

    if (excludeAppointmentId) {
      sql += ' AND id != ?';
      params.push(excludeAppointmentId);
    }

    const rows = await this.getAll<any>(sql, params);
    return rows.map(this.mapToAppointment);
  }

  async updateAppointmentStatus(
    id: string,
    status: AppointmentStatus,
    source: ChangeSource,
    operatorId: string | null,
    operatorName: string | null,
    remark: string | null
  ): Promise<Appointment | null> {
    const appointment = await this.getAppointmentById(id);
    if (!appointment) return null;

    const oldStatus = appointment.status;
    const now = new Date().toISOString();

    await this.runQuery(
      'UPDATE appointments SET status = ?, updated_at = ? WHERE id = ?',
      [status, now, id]
    );

    await this.logChange(
      'appointment',
      id,
      'status',
      oldStatus,
      status,
      source,
      operatorId,
      operatorName,
      remark
    );

    return this.getAppointmentById(id);
  }

  async createAuthorization(
    appointmentId: string,
    licensePlate: string,
    validFrom: string,
    validTo: string,
    source: ChangeSource,
    operatorId: string | null,
    operatorName: string | null
  ): Promise<Authorization> {
    const now = new Date().toISOString();
    const id = uuidv4();
    const authorization: Authorization = {
      id,
      appointmentId,
      licensePlate,
      validFrom,
      validTo,
      status: AuthorizationStatus.ACTIVE,
      createdAt: now,
      updatedAt: now
    };

    await this.runQuery(
      `INSERT INTO authorizations (
        id, appointment_id, license_plate, valid_from, valid_to,
        status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        authorization.id,
        authorization.appointmentId,
        authorization.licensePlate,
        authorization.validFrom,
        authorization.validTo,
        authorization.status,
        authorization.createdAt,
        authorization.updatedAt
      ]
    );

    await this.logChange(
      'authorization',
      authorization.id,
      'status',
      null,
      authorization.status,
      source,
      operatorId,
      operatorName,
      '创建车牌授权'
    );

    return authorization;
  }

  async getAuthorizationById(id: string): Promise<Authorization | null> {
    const row = await this.getOne<any>('SELECT * FROM authorizations WHERE id = ?', [id]);
    return row ? this.mapToAuthorization(row) : null;
  }

  async getAuthorizationByAppointmentId(appointmentId: string): Promise<Authorization | null> {
    const row = await this.getOne<any>('SELECT * FROM authorizations WHERE appointment_id = ?', [appointmentId]);
    return row ? this.mapToAuthorization(row) : null;
  }

  async getActiveAuthorizationsByLicensePlate(licensePlate: string): Promise<Authorization[]> {
    const rows = await this.getAll<any>(
      'SELECT * FROM authorizations WHERE license_plate = ? AND status = ?',
      [licensePlate, AuthorizationStatus.ACTIVE]
    );
    return rows.map(this.mapToAuthorization);
  }

  async updateAuthorizationStatus(
    id: string,
    status: AuthorizationStatus,
    source: ChangeSource,
    operatorId: string | null,
    operatorName: string | null,
    remark: string | null
  ): Promise<Authorization | null> {
    const authorization = await this.getAuthorizationById(id);
    if (!authorization) return null;

    const oldStatus = authorization.status;
    const now = new Date().toISOString();

    await this.runQuery(
      'UPDATE authorizations SET status = ?, updated_at = ? WHERE id = ?',
      [status, now, id]
    );

    await this.logChange(
      'authorization',
      id,
      'status',
      oldStatus,
      status,
      source,
      operatorId,
      operatorName,
      remark
    );

    return this.getAuthorizationById(id);
  }

  async logChange(
    entityType: 'appointment' | 'authorization',
    entityId: string,
    field: string,
    oldValue: string | null,
    newValue: string | null,
    source: ChangeSource,
    operatorId: string | null,
    operatorName: string | null,
    remark: string | null
  ): Promise<void> {
    const id = uuidv4();
    const now = new Date().toISOString();

    await this.runQuery(
      `INSERT INTO change_logs (
        id, entity_type, entity_id, field, old_value, new_value,
        source, operator_id, operator_name, remark, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, entityType, entityId, field, oldValue, newValue, source, operatorId, operatorName, remark, now]
    );
  }

  async getChangeLogs(entityType: 'appointment' | 'authorization', entityId: string): Promise<ChangeLog[]> {
    const rows = await this.getAll<any>(
      'SELECT * FROM change_logs WHERE entity_type = ? AND entity_id = ? ORDER BY created_at ASC',
      [entityType, entityId]
    );
    return rows.map(this.mapToChangeLog);
  }

  async getOverdueAuthorizations(): Promise<Authorization[]> {
    const now = new Date().toISOString();
    const rows = await this.getAll<any>(
      `SELECT * FROM authorizations 
       WHERE status = ? AND valid_to < ?`,
      [AuthorizationStatus.ACTIVE, now]
    );
    return rows.map(this.mapToAuthorization);
  }

  async getPendingAppointments(): Promise<Appointment[]> {
    const rows = await this.getAll<any>(
      'SELECT * FROM appointments WHERE status = ? ORDER BY created_at ASC',
      [AppointmentStatus.PENDING]
    );
    return rows.map(this.mapToAppointment);
  }

  async getAllAppointments(): Promise<Appointment[]> {
    const rows = await this.getAll<any>('SELECT * FROM appointments ORDER BY created_at DESC');
    return rows.map(this.mapToAppointment);
  }

  async getAllAuthorizations(): Promise<Authorization[]> {
    const rows = await this.getAll<any>('SELECT * FROM authorizations ORDER BY created_at DESC');
    return rows.map(this.mapToAuthorization);
  }

  async close(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.close((err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }
}

export const db = new Database();

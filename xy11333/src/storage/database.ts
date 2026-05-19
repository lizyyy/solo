import Database from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';
import {
  Escort,
  Appointment,
  EscortTask,
  ImportRecord,
  HistoryRecord,
  ErrorLog,
  PermissionLevel,
} from '../types';

export class LedgerDatabase {
  private db: Database.Database;

  constructor(dbPath: string = './outpatient_ledger.db') {
    this.db = new Database(dbPath);
    this.initializeTables();
  }

  private initializeTables(): void {
    const tables = [
      `CREATE TABLE IF NOT EXISTS escorts (
        id TEXT PRIMARY KEY,
        employee_id TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        phone TEXT NOT NULL,
        department TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'off_duty',
        shift_start TEXT NOT NULL,
        shift_end TEXT NOT NULL,
        current_task_count INTEGER NOT NULL DEFAULT 0,
        max_task_count INTEGER NOT NULL DEFAULT 5,
        skills TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS appointments (
        id TEXT PRIMARY KEY,
        appointment_no TEXT UNIQUE NOT NULL,
        patient_name TEXT NOT NULL,
        patient_id TEXT NOT NULL,
        patient_phone TEXT NOT NULL,
        department TEXT NOT NULL,
        exam_type TEXT NOT NULL,
        exam_location TEXT NOT NULL,
        scheduled_time INTEGER NOT NULL,
        estimated_duration INTEGER NOT NULL,
        status TEXT NOT NULL DEFAULT 'scheduled',
        notes TEXT,
        source TEXT NOT NULL,
        import_batch_id TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS escort_tasks (
        id TEXT PRIMARY KEY,
        task_no TEXT UNIQUE NOT NULL,
        appointment_id TEXT NOT NULL,
        escort_id TEXT,
        status TEXT NOT NULL DEFAULT 'pending',
        priority TEXT NOT NULL DEFAULT 'normal',
        patient_name TEXT NOT NULL,
        patient_id TEXT NOT NULL,
        exam_type TEXT NOT NULL,
        exam_location TEXT NOT NULL,
        scheduled_time INTEGER NOT NULL,
        assigned_at INTEGER,
        accepted_at INTEGER,
        started_at INTEGER,
        completed_at INTEGER,
        cancelled_at INTEGER,
        timeout_at INTEGER,
        wait_duration INTEGER,
        actual_duration INTEGER,
        is_inserted INTEGER NOT NULL DEFAULT 0,
        insert_reason TEXT,
        cancel_reason TEXT,
        timeout_reason TEXT,
        created_by TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        FOREIGN KEY (appointment_id) REFERENCES appointments(id),
        FOREIGN KEY (escort_id) REFERENCES escorts(id)
      )`,
      `CREATE TABLE IF NOT EXISTS import_records (
        id TEXT PRIMARY KEY,
        batch_id TEXT NOT NULL,
        source_type TEXT NOT NULL,
        file_name TEXT NOT NULL,
        record_type TEXT NOT NULL,
        original_index INTEGER NOT NULL,
        raw_data TEXT NOT NULL,
        status TEXT NOT NULL,
        errors TEXT NOT NULL,
        record_id TEXT,
        imported_at INTEGER NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS history_records (
        id TEXT PRIMARY KEY,
        entity_type TEXT NOT NULL,
        entity_id TEXT NOT NULL,
        action TEXT NOT NULL,
        old_value TEXT,
        new_value TEXT,
        operator TEXT NOT NULL,
        operator_level TEXT NOT NULL,
        ip_address TEXT,
        reason TEXT,
        timestamp INTEGER NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS error_logs (
        id TEXT PRIMARY KEY,
        error_type TEXT NOT NULL,
        error_code TEXT NOT NULL,
        message TEXT NOT NULL,
        stack TEXT,
        context TEXT NOT NULL,
        resolved INTEGER NOT NULL DEFAULT 0,
        resolved_at INTEGER,
        resolved_by TEXT,
        created_at INTEGER NOT NULL
      )`,
      `CREATE INDEX IF NOT EXISTS idx_tasks_status ON escort_tasks(status)`,
      `CREATE INDEX IF NOT EXISTS idx_tasks_escort ON escort_tasks(escort_id)`,
      `CREATE INDEX IF NOT EXISTS idx_tasks_scheduled ON escort_tasks(scheduled_time)`,
      `CREATE INDEX IF NOT EXISTS idx_history_entity ON history_records(entity_type, entity_id)`,
      `CREATE INDEX IF NOT EXISTS idx_import_batch ON import_records(batch_id)`,
      `CREATE INDEX IF NOT EXISTS idx_appointments_no ON appointments(appointment_no)`,
    ];

    tables.forEach(sql => this.db.exec(sql));
  }

  generateId(): string {
    return uuidv4();
  }

  now(): number {
    return Date.now();
  }

  private toSqlValue(value: any): string {
    if (value === null || value === undefined) return '';
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  }

  private fromSqlValue<T = any>(value: string): T {
    if (!value) return null as unknown as T;
    try {
      return JSON.parse(value) as T;
    } catch {
      return value as unknown as T;
    }
  }

  insertEscort(escort: Omit<Escort, 'id' | 'createdAt' | 'updatedAt'>): Escort {
    const id = this.generateId();
    const now = this.now();
    const stmt = this.db.prepare(`
      INSERT INTO escorts (
        id, employee_id, name, phone, department, status,
        shift_start, shift_end, current_task_count, max_task_count,
        skills, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      id,
      escort.employeeId,
      escort.name,
      escort.phone,
      escort.department,
      escort.status,
      escort.shiftStart,
      escort.shiftEnd,
      escort.currentTaskCount,
      escort.maxTaskCount,
      JSON.stringify(escort.skills),
      now,
      now
    );
    return { ...escort, id, createdAt: now, updatedAt: now };
  }

  updateEscort(id: string, updates: Partial<Omit<Escort, 'id' | 'createdAt' | 'updatedAt'>>): Escort | null {
    const existing = this.getEscortById(id);
    if (!existing) return null;

    const updated = { ...existing, ...updates, updatedAt: this.now() };
    const fields: string[] = [];
    const values: any[] = [];

    Object.entries(updates).forEach(([key, value]) => {
      const dbField = key.replace(/([A-Z])/g, '_$1').toLowerCase();
      fields.push(`${dbField} = ?`);
      values.push(key === 'skills' ? JSON.stringify(value) : value);
    });

    fields.push('updated_at = ?');
    values.push(updated.updatedAt);
    values.push(id);

    const stmt = this.db.prepare(`
      UPDATE escorts SET ${fields.join(', ')} WHERE id = ?
    `);
    stmt.run(...values);

    return updated;
  }

  getEscortById(id: string): Escort | null {
    const stmt = this.db.prepare('SELECT * FROM escorts WHERE id = ?');
    const row = stmt.get(id) as any;
    return row ? this.mapEscort(row) : null;
  }

  getEscortByEmployeeId(employeeId: string): Escort | null {
    const stmt = this.db.prepare('SELECT * FROM escorts WHERE employee_id = ?');
    const row = stmt.get(employeeId) as any;
    return row ? this.mapEscort(row) : null;
  }

  getAllEscorts(): Escort[] {
    const stmt = this.db.prepare('SELECT * FROM escorts ORDER BY created_at DESC');
    const rows = stmt.all() as any[];
    return rows.map(row => this.mapEscort(row));
  }

  private mapEscort(row: any): Escort {
    return {
      id: row.id,
      employeeId: row.employee_id,
      name: row.name,
      phone: row.phone,
      department: row.department,
      status: row.status,
      shiftStart: row.shift_start,
      shiftEnd: row.shift_end,
      currentTaskCount: row.current_task_count,
      maxTaskCount: row.max_task_count,
      skills: this.fromSqlValue<string[]>(row.skills) || [],
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  insertAppointment(appointment: Omit<Appointment, 'id' | 'createdAt' | 'updatedAt'>): Appointment {
    const id = this.generateId();
    const now = this.now();
    const stmt = this.db.prepare(`
      INSERT INTO appointments (
        id, appointment_no, patient_name, patient_id, patient_phone,
        department, exam_type, exam_location, scheduled_time,
        estimated_duration, status, notes, source, import_batch_id,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      id,
      appointment.appointmentNo,
      appointment.patientName,
      appointment.patientId,
      appointment.patientPhone,
      appointment.department,
      appointment.examType,
      appointment.examLocation,
      appointment.scheduledTime,
      appointment.estimatedDuration,
      appointment.status,
      appointment.notes,
      appointment.source,
      appointment.importBatchId || null,
      now,
      now
    );
    return { ...appointment, id, createdAt: now, updatedAt: now };
  }

  updateAppointment(id: string, updates: Partial<Omit<Appointment, 'id' | 'createdAt' | 'updatedAt'>>): Appointment | null {
    const existing = this.getAppointmentById(id);
    if (!existing) return null;

    const updated = { ...existing, ...updates, updatedAt: this.now() };
    const fields: string[] = [];
    const values: any[] = [];

    Object.entries(updates).forEach(([key, value]) => {
      const dbField = key.replace(/([A-Z])/g, '_$1').toLowerCase();
      fields.push(`${dbField} = ?`);
      values.push(value);
    });

    fields.push('updated_at = ?');
    values.push(updated.updatedAt);
    values.push(id);

    const stmt = this.db.prepare(`
      UPDATE appointments SET ${fields.join(', ')} WHERE id = ?
    `);
    stmt.run(...values);

    return updated;
  }

  getAppointmentById(id: string): Appointment | null {
    const stmt = this.db.prepare('SELECT * FROM appointments WHERE id = ?');
    const row = stmt.get(id) as any;
    return row ? this.mapAppointment(row) : null;
  }

  getAppointmentByNo(appointmentNo: string): Appointment | null {
    const stmt = this.db.prepare('SELECT * FROM appointments WHERE appointment_no = ?');
    const row = stmt.get(appointmentNo) as any;
    return row ? this.mapAppointment(row) : null;
  }

  getAppointmentsByDate(startTime: number, endTime: number): Appointment[] {
    const stmt = this.db.prepare(`
      SELECT * FROM appointments 
      WHERE scheduled_time >= ? AND scheduled_time <= ?
      ORDER BY scheduled_time ASC
    `);
    const rows = stmt.all(startTime, endTime) as any[];
    return rows.map(row => this.mapAppointment(row));
  }

  private mapAppointment(row: any): Appointment {
    return {
      id: row.id,
      appointmentNo: row.appointment_no,
      patientName: row.patient_name,
      patientId: row.patient_id,
      patientPhone: row.patient_phone,
      department: row.department,
      examType: row.exam_type,
      examLocation: row.exam_location,
      scheduledTime: row.scheduled_time,
      estimatedDuration: row.estimated_duration,
      status: row.status,
      notes: row.notes || '',
      source: row.source,
      importBatchId: row.import_batch_id,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  insertTask(task: Omit<EscortTask, 'id' | 'createdAt' | 'updatedAt'>): EscortTask {
    const id = this.generateId();
    const now = this.now();
    const stmt = this.db.prepare(`
      INSERT INTO escort_tasks (
        id, task_no, appointment_id, escort_id, status, priority,
        patient_name, patient_id, exam_type, exam_location, scheduled_time,
        assigned_at, accepted_at, started_at, completed_at, cancelled_at,
        timeout_at, wait_duration, actual_duration, is_inserted,
        insert_reason, cancel_reason, timeout_reason, created_by,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      id,
      task.taskNo,
      task.appointmentId,
      task.escortId || null,
      task.status,
      task.priority,
      task.patientName,
      task.patientId,
      task.examType,
      task.examLocation,
      task.scheduledTime,
      task.assignedAt || null,
      task.acceptedAt || null,
      task.startedAt || null,
      task.completedAt || null,
      task.cancelledAt || null,
      task.timeoutAt || null,
      task.waitDuration || null,
      task.actualDuration || null,
      task.isInserted ? 1 : 0,
      task.insertReason || null,
      task.cancelReason || null,
      task.timeoutReason || null,
      task.createdBy,
      now,
      now
    );
    return { ...task, id, createdAt: now, updatedAt: now };
  }

  updateTask(id: string, updates: Partial<Omit<EscortTask, 'id' | 'createdAt' | 'updatedAt'>>): EscortTask | null {
    const existing = this.getTaskById(id);
    if (!existing) return null;

    const updated = { ...existing, ...updates, updatedAt: this.now() };
    const fields: string[] = [];
    const values: any[] = [];

    Object.entries(updates).forEach(([key, value]) => {
      const dbField = key.replace(/([A-Z])/g, '_$1').toLowerCase();
      fields.push(`${dbField} = ?`);
      values.push(key === 'isInserted' ? (value ? 1 : 0) : value);
    });

    fields.push('updated_at = ?');
    values.push(updated.updatedAt);
    values.push(id);

    const stmt = this.db.prepare(`
      UPDATE escort_tasks SET ${fields.join(', ')} WHERE id = ?
    `);
    stmt.run(...values);

    return updated;
  }

  getTaskById(id: string): EscortTask | null {
    const stmt = this.db.prepare('SELECT * FROM escort_tasks WHERE id = ?');
    const row = stmt.get(id) as any;
    return row ? this.mapTask(row) : null;
  }

  getTaskByNo(taskNo: string): EscortTask | null {
    const stmt = this.db.prepare('SELECT * FROM escort_tasks WHERE task_no = ?');
    const row = stmt.get(taskNo) as any;
    return row ? this.mapTask(row) : null;
  }

  getTasksByStatus(status: string): EscortTask[] {
    const stmt = this.db.prepare('SELECT * FROM escort_tasks WHERE status = ? ORDER BY scheduled_time ASC');
    const rows = stmt.all(status) as any[];
    return rows.map(row => this.mapTask(row));
  }

  getTasksByEscort(escortId: string): EscortTask[] {
    const stmt = this.db.prepare('SELECT * FROM escort_tasks WHERE escort_id = ? ORDER BY created_at DESC');
    const rows = stmt.all(escortId) as any[];
    return rows.map(row => this.mapTask(row));
  }

  getTasksByDateRange(startTime: number, endTime: number): EscortTask[] {
    const stmt = this.db.prepare(`
      SELECT * FROM escort_tasks 
      WHERE scheduled_time >= ? AND scheduled_time <= ?
      ORDER BY scheduled_time ASC, priority DESC
    `);
    const rows = stmt.all(startTime, endTime) as any[];
    return rows.map(row => this.mapTask(row));
  }

  private mapTask(row: any): EscortTask {
    return {
      id: row.id,
      taskNo: row.task_no,
      appointmentId: row.appointment_id,
      escortId: row.escort_id,
      status: row.status,
      priority: row.priority,
      patientName: row.patient_name,
      patientId: row.patient_id,
      examType: row.exam_type,
      examLocation: row.exam_location,
      scheduledTime: row.scheduled_time,
      assignedAt: row.assigned_at,
      acceptedAt: row.accepted_at,
      startedAt: row.started_at,
      completedAt: row.completed_at,
      cancelledAt: row.cancelled_at,
      timeoutAt: row.timeout_at,
      waitDuration: row.wait_duration,
      actualDuration: row.actual_duration,
      isInserted: row.is_inserted === 1,
      insertReason: row.insert_reason,
      cancelReason: row.cancel_reason,
      timeoutReason: row.timeout_reason,
      createdBy: row.created_by,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  insertImportRecord(record: Omit<ImportRecord, 'id' | 'importedAt'>): ImportRecord {
    const id = this.generateId();
    const now = this.now();
    const stmt = this.db.prepare(`
      INSERT INTO import_records (
        id, batch_id, source_type, file_name, record_type,
        original_index, raw_data, status, errors, record_id, imported_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      id,
      record.batchId,
      record.sourceType,
      record.fileName,
      record.recordType,
      record.originalIndex,
      record.rawData,
      record.status,
      JSON.stringify(record.errors),
      record.recordId || null,
      now
    );
    return { ...record, id, importedAt: now };
  }

  getImportRecordsByBatch(batchId: string): ImportRecord[] {
    const stmt = this.db.prepare('SELECT * FROM import_records WHERE batch_id = ? ORDER BY original_index ASC');
    const rows = stmt.all(batchId) as any[];
    return rows.map(row => this.mapImportRecord(row));
  }

  getImportRecordsByStatus(status: string): ImportRecord[] {
    const stmt = this.db.prepare('SELECT * FROM import_records WHERE status = ? ORDER BY imported_at DESC');
    const rows = stmt.all(status) as any[];
    return rows.map(row => this.mapImportRecord(row));
  }

  private mapImportRecord(row: any): ImportRecord {
    return {
      id: row.id,
      batchId: row.batch_id,
      sourceType: row.source_type,
      fileName: row.file_name,
      recordType: row.record_type,
      originalIndex: row.original_index,
      rawData: row.raw_data,
      status: row.status,
      errors: this.fromSqlValue(row.errors) || [],
      recordId: row.record_id,
      importedAt: row.imported_at,
    };
  }

  insertHistoryRecord(record: Omit<HistoryRecord, 'id' | 'timestamp'>): HistoryRecord {
    const id = this.generateId();
    const now = this.now();
    const stmt = this.db.prepare(`
      INSERT INTO history_records (
        id, entity_type, entity_id, action, old_value, new_value,
        operator, operator_level, ip_address, reason, timestamp
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      id,
      record.entityType,
      record.entityId,
      record.action,
      record.oldValue !== undefined ? JSON.stringify(record.oldValue) : null,
      record.newValue !== undefined ? JSON.stringify(record.newValue) : null,
      record.operator,
      record.operatorLevel,
      record.ipAddress || null,
      record.reason || null,
      now
    );
    return { ...record, id, timestamp: now };
  }

  getHistoryByEntity(entityType: string, entityId: string): HistoryRecord[] {
    const stmt = this.db.prepare(`
      SELECT * FROM history_records 
      WHERE entity_type = ? AND entity_id = ?
      ORDER BY timestamp DESC
    `);
    const rows = stmt.all(entityType, entityId) as any[];
    return rows.map(row => this.mapHistoryRecord(row));
  }

  getHistoryByOperator(operator: string, limit: number = 100): HistoryRecord[] {
    const stmt = this.db.prepare(`
      SELECT * FROM history_records 
      WHERE operator = ?
      ORDER BY timestamp DESC
      LIMIT ?
    `);
    const rows = stmt.all(operator, limit) as any[];
    return rows.map(row => this.mapHistoryRecord(row));
  }

  private mapHistoryRecord(row: any): HistoryRecord {
    return {
      id: row.id,
      entityType: row.entity_type,
      entityId: row.entity_id,
      action: row.action,
      oldValue: this.fromSqlValue(row.old_value),
      newValue: this.fromSqlValue(row.new_value),
      operator: row.operator,
      operatorLevel: row.operator_level,
      ipAddress: row.ip_address,
      reason: row.reason,
      timestamp: row.timestamp,
    };
  }

  insertErrorLog(log: Omit<ErrorLog, 'id' | 'createdAt'>): ErrorLog {
    const id = this.generateId();
    const now = this.now();
    const stmt = this.db.prepare(`
      INSERT INTO error_logs (
        id, error_type, error_code, message, stack, context,
        resolved, resolved_at, resolved_by, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      id,
      log.errorType,
      log.errorCode,
      log.message,
      log.stack || null,
      JSON.stringify(log.context),
      0,
      null,
      null,
      now
    );
    return { ...log, id, resolved: false, createdAt: now };
  }

  resolveErrorLog(id: string, resolvedBy: string): ErrorLog | null {
    const stmt = this.db.prepare(`
      UPDATE error_logs 
      SET resolved = 1, resolved_at = ?, resolved_by = ?
      WHERE id = ?
    `);
    const result = stmt.run(this.now(), resolvedBy, id);
    if (result.changes === 0) return null;
    return this.getErrorLogById(id);
  }

  getErrorLogById(id: string): ErrorLog | null {
    const stmt = this.db.prepare('SELECT * FROM error_logs WHERE id = ?');
    const row = stmt.get(id) as any;
    return row ? this.mapErrorLog(row) : null;
  }

  getUnresolvedErrors(): ErrorLog[] {
    const stmt = this.db.prepare('SELECT * FROM error_logs WHERE resolved = 0 ORDER BY created_at DESC');
    const rows = stmt.all() as any[];
    return rows.map(row => this.mapErrorLog(row));
  }

  private mapErrorLog(row: any): ErrorLog {
    return {
      id: row.id,
      errorType: row.error_type,
      errorCode: row.error_code,
      message: row.message,
      stack: row.stack,
      context: this.fromSqlValue(row.context) || {},
      resolved: row.resolved === 1,
      resolvedAt: row.resolved_at,
      resolvedBy: row.resolved_by,
      createdAt: row.created_at,
    };
  }

  transaction<T>(fn: () => T): T {
    this.db.exec('BEGIN TRANSACTION');
    try {
      const result = fn();
      this.db.exec('COMMIT');
      return result;
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
  }

  close(): void {
    this.db.close();
  }
}

export const db = new LedgerDatabase();

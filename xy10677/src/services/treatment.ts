import { DatabaseService } from './database';
import {
  Patient,
  AlignerBatch,
  Appointment,
  TreatmentTodo,
  ExceptionRecord,
  TimelineEvent,
  ModificationHistory,
  TreatmentPhase,
  AlignerStatus,
  AppointmentStatus,
  TodoStatus,
  TodoPriority,
  ExceptionType,
  ExceptionStatus
} from '../types';

export class TreatmentService {
  private db: DatabaseService;

  constructor(dbService: DatabaseService) {
    this.db = dbService;
  }

  private async addTimelineEvent(
    patientId: string,
    eventType: string,
    title: string,
    description: string,
    reason?: string,
    operatorId?: string,
    operatorName?: string,
    relatedEntityId?: string,
    relatedEntityType?: string,
    oldValues?: Record<string, any>,
    newValues?: Record<string, any>
  ): Promise<void> {
    const event: TimelineEvent = {
      id: this.db.generateId(),
      patientId,
      eventType,
      title,
      description,
      reason,
      operatorId,
      operatorName,
      relatedEntityId,
      relatedEntityType,
      oldValues: oldValues ? JSON.stringify(oldValues) : undefined,
      newValues: newValues ? JSON.stringify(newValues) : undefined,
      createdAt: this.db.now()
    };

    await this.db.run(
      `INSERT INTO timeline_events 
       (id, patientId, eventType, title, description, reason, operatorId, operatorName, 
        relatedEntityId, relatedEntityType, oldValues, newValues, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        event.id,
        event.patientId,
        event.eventType,
        event.title,
        event.description,
        event.reason || null,
        event.operatorId || null,
        event.operatorName || null,
        event.relatedEntityId || null,
        event.relatedEntityType || null,
        event.oldValues || null,
        event.newValues || null,
        event.createdAt
      ]
    );
  }

  private async addModificationHistory(
    entityType: string,
    entityId: string,
    fieldName: string,
    oldValue: any,
    newValue: any,
    modifiedBy: string,
    modifiedByName: string,
    reason?: string
  ): Promise<void> {
    const history: ModificationHistory = {
      id: this.db.generateId(),
      entityType,
      entityId,
      fieldName,
      oldValue: JSON.stringify(oldValue),
      newValue: JSON.stringify(newValue),
      modifiedBy,
      modifiedByName,
      modifiedAt: this.db.now(),
      reason
    };

    await this.db.run(
      `INSERT INTO modification_history 
       (id, entityType, entityId, fieldName, oldValue, newValue, modifiedBy, modifiedByName, modifiedAt, reason)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        history.id,
        history.entityType,
        history.entityId,
        history.fieldName,
        history.oldValue,
        history.newValue,
        history.modifiedBy,
        history.modifiedByName,
        history.modifiedAt,
        history.reason || null
      ]
    );
  }

  async createPatient(data: Omit<Patient, 'id' | 'createdAt' | 'updatedAt'>, operatorId: string, operatorName: string): Promise<Patient> {
    const patient: Patient = {
      id: this.db.generateId(),
      ...data,
      createdAt: this.db.now(),
      updatedAt: this.db.now()
    };

    await this.db.run(
      `INSERT INTO patients 
       (id, name, phone, doctorId, doctorName, startDate, currentPhase, totalAligners, currentAligner, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        patient.id,
        patient.name,
        patient.phone,
        patient.doctorId,
        patient.doctorName,
        patient.startDate,
        patient.currentPhase,
        patient.totalAligners,
        patient.currentAligner,
        patient.createdAt,
        patient.updatedAt
      ]
    );

    await this.addTimelineEvent(
      patient.id,
      'PATIENT_CREATED',
      '患者创建',
      `创建患者档案：${patient.name}`,
      '初始建档',
      operatorId,
      operatorName,
      patient.id,
      'patient'
    );

    return patient;
  }

  async createAlignerBatch(data: Omit<AlignerBatch, 'id' | 'createdAt' | 'updatedAt'>, operatorId: string, operatorName: string): Promise<AlignerBatch> {
    const batch: AlignerBatch = {
      id: this.db.generateId(),
      ...data,
      createdAt: this.db.now(),
      updatedAt: this.db.now()
    };

    await this.db.run(
      `INSERT INTO aligner_batches 
       (id, patientId, batchNumber, startAligner, endAligner, status, receivedDate, startDate, expectedEndDate, actualEndDate, notes, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        batch.id,
        batch.patientId,
        batch.batchNumber,
        batch.startAligner,
        batch.endAligner,
        batch.status,
        batch.receivedDate || null,
        batch.startDate || null,
        batch.expectedEndDate || null,
        batch.actualEndDate || null,
        batch.notes || null,
        batch.createdAt,
        batch.updatedAt
      ]
    );

    const patient = await this.getPatient(batch.patientId);
    await this.addTimelineEvent(
      batch.patientId,
      'BATCH_CREATED',
      '牙套批次创建',
      `创建第 ${batch.batchNumber} 批牙套：第 ${batch.startAligner}-${batch.endAligner} 副`,
      '新批次发放',
      operatorId,
      operatorName,
      batch.id,
      'aligner_batch'
    );

    return batch;
  }

  async createAppointment(data: Omit<Appointment, 'id' | 'createdAt' | 'updatedAt'>, operatorId: string, operatorName: string): Promise<Appointment> {
    const appointment: Appointment = {
      id: this.db.generateId(),
      ...data,
      createdAt: this.db.now(),
      updatedAt: this.db.now()
    };

    await this.db.run(
      `INSERT INTO appointments 
       (id, patientId, batchId, scheduledDate, scheduledTime, status, type, doctorId, doctorName, actualDate, notes, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        appointment.id,
        appointment.patientId,
        appointment.batchId || null,
        appointment.scheduledDate,
        appointment.scheduledTime,
        appointment.status,
        appointment.type,
        appointment.doctorId,
        appointment.doctorName,
        appointment.actualDate || null,
        appointment.notes || null,
        appointment.createdAt,
        appointment.updatedAt
      ]
    );

    const patient = await this.getPatient(appointment.patientId);
    await this.addTimelineEvent(
      appointment.patientId,
      'APPOINTMENT_CREATED',
      '复诊预约创建',
      `预约 ${appointment.scheduledDate} ${appointment.scheduledTime} - ${appointment.type}`,
      '医生安排复诊',
      operatorId,
      operatorName,
      appointment.id,
      'appointment'
    );

    await this.createTodo({
      patientId: appointment.patientId,
      patientName: patient!.name,
      type: 'APPOINTMENT',
      description: `处理 ${appointment.scheduledDate} 的${appointment.type}复诊`,
      priority: TodoPriority.MEDIUM,
      status: TodoStatus.PENDING,
      assigneeId: appointment.doctorId,
      assigneeName: appointment.doctorName,
      dueDate: appointment.scheduledDate,
      relatedAppointmentId: appointment.id
    }, operatorId, operatorName);

    return appointment;
  }

  async createTodo(data: Omit<TreatmentTodo, 'id' | 'createdAt' | 'updatedAt'>, operatorId: string, operatorName: string): Promise<TreatmentTodo> {
    const todo: TreatmentTodo = {
      id: this.db.generateId(),
      ...data,
      createdAt: this.db.now(),
      updatedAt: this.db.now()
    };

    await this.db.run(
      `INSERT INTO treatment_todos 
       (id, patientId, patientName, type, description, priority, status, assigneeId, assigneeName, dueDate, completedAt, completedBy, relatedBatchId, relatedAppointmentId, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        todo.id,
        todo.patientId,
        todo.patientName,
        todo.type,
        todo.description,
        todo.priority,
        todo.status,
        todo.assigneeId,
        todo.assigneeName,
        todo.dueDate || null,
        todo.completedAt || null,
        todo.completedBy || null,
        todo.relatedBatchId || null,
        todo.relatedAppointmentId || null,
        todo.createdAt,
        todo.updatedAt
      ]
    );

    return todo;
  }

  async createException(data: Omit<ExceptionRecord, 'id' | 'createdAt' | 'updatedAt'>, operatorId: string, operatorName: string): Promise<ExceptionRecord> {
    const exception: ExceptionRecord = {
      id: this.db.generateId(),
      ...data,
      createdAt: this.db.now(),
      updatedAt: this.db.now()
    };

    await this.db.run(
      `INSERT INTO exception_records 
       (id, patientId, type, title, description, status, relatedBatchId, relatedAppointmentId, assigneeId, assigneeName, resolvedAt, resolution, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        exception.id,
        exception.patientId,
        exception.type,
        exception.title,
        exception.description,
        exception.status,
        exception.relatedBatchId || null,
        exception.relatedAppointmentId || null,
        exception.assigneeId || null,
        exception.assigneeName || null,
        exception.resolvedAt || null,
        exception.resolution || null,
        exception.createdAt,
        exception.updatedAt
      ]
    );

    const patient = await this.getPatient(exception.patientId);
    await this.addTimelineEvent(
      exception.patientId,
      'EXCEPTION_CREATED',
      '异常记录创建',
      `${exception.type}: ${exception.title}`,
      '系统或人工发现异常',
      operatorId,
      operatorName,
      exception.id,
      'exception'
    );

    if (exception.assigneeId && exception.assigneeName) {
      await this.createTodo({
        patientId: exception.patientId,
        patientName: patient!.name,
        type: 'EXCEPTION',
        description: `处理异常：${exception.title}`,
        priority: TodoPriority.HIGH,
        status: TodoStatus.PENDING,
        assigneeId: exception.assigneeId,
        assigneeName: exception.assigneeName,
        relatedBatchId: exception.relatedBatchId,
        relatedAppointmentId: exception.relatedAppointmentId
      }, operatorId, operatorName);
    }

    return exception;
  }

  async getPatient(id: string): Promise<Patient | undefined> {
    return this.db.get<Patient>('SELECT * FROM patients WHERE id = ?', [id]);
  }

  async getPatientBatches(patientId: string): Promise<AlignerBatch[]> {
    return this.db.all<AlignerBatch>('SELECT * FROM aligner_batches WHERE patientId = ? ORDER BY batchNumber', [patientId]);
  }

  async getPatientAppointments(patientId: string): Promise<Appointment[]> {
    return this.db.all<Appointment>('SELECT * FROM appointments WHERE patientId = ? ORDER BY scheduledDate DESC', [patientId]);
  }

  async getPatientTodos(patientId: string): Promise<TreatmentTodo[]> {
    return this.db.all<TreatmentTodo>('SELECT * FROM treatment_todos WHERE patientId = ? ORDER BY createdAt DESC', [patientId]);
  }

  async getPatientExceptions(patientId: string): Promise<ExceptionRecord[]> {
    return this.db.all<ExceptionRecord>('SELECT * FROM exception_records WHERE patientId = ? ORDER BY createdAt DESC', [patientId]);
  }

  async getPatientTimeline(patientId: string): Promise<TimelineEvent[]> {
    const events = await this.db.all<any>('SELECT * FROM timeline_events WHERE patientId = ? ORDER BY createdAt DESC', [patientId]);
    return events.map(e => ({
      ...e,
      oldValues: e.oldValues ? JSON.parse(e.oldValues) : undefined,
      newValues: e.newValues ? JSON.parse(e.newValues) : undefined
    }));
  }

  async getModificationHistory(entityType: string, entityId: string): Promise<ModificationHistory[]> {
    const history = await this.db.all<any>('SELECT * FROM modification_history WHERE entityType = ? AND entityId = ? ORDER BY modifiedAt DESC', [entityType, entityId]);
    return history.map(h => ({
      ...h,
      oldValue: h.oldValue ? JSON.parse(h.oldValue) : undefined,
      newValue: h.newValue ? JSON.parse(h.newValue) : undefined
    }));
  }

  async advanceAlignerBatch(batchId: string, newStatus: AlignerStatus, actualEndDate?: string, operatorId?: string, operatorName?: string, reason?: string): Promise<AlignerBatch | undefined> {
    const batch = await this.db.get<AlignerBatch>('SELECT * FROM aligner_batches WHERE id = ?', [batchId]);
    if (!batch) return undefined;

    const oldStatus = batch.status;
    batch.status = newStatus;
    if (actualEndDate) {
      batch.actualEndDate = actualEndDate;
    }
    batch.updatedAt = this.db.now();

    await this.db.run(
      'UPDATE aligner_batches SET status = ?, actualEndDate = ?, updatedAt = ? WHERE id = ?',
      [batch.status, batch.actualEndDate || null, batch.updatedAt, batch.id]
    );

    await this.addModificationHistory(
      'aligner_batch',
      batchId,
      'status',
      oldStatus,
      newStatus,
      operatorId || 'system',
      operatorName || '系统',
      reason
    );

    await this.addTimelineEvent(
      batch.patientId,
      'BATCH_STATUS_CHANGED',
      '牙套批次状态变更',
      `批次 ${batch.batchNumber} 状态从 ${oldStatus} 变为 ${newStatus}`,
      reason,
      operatorId,
      operatorName,
      batchId,
      'aligner_batch',
      { status: oldStatus },
      { status: newStatus }
    );

    if (newStatus === AlignerStatus.COMPLETED) {
      const patient = await this.getPatient(batch.patientId);
      if (patient && batch.endAligner > patient.currentAligner) {
        await this.updatePatientPhase(
          batch.patientId,
          patient.currentPhase,
          batch.endAligner,
          operatorId || 'system',
          operatorName || '系统',
          '牙套批次完成，更新当前牙套进度'
        );
      }
    }

    return batch;
  }

  async updatePatientPhase(patientId: string, newPhase: TreatmentPhase, newAligner?: number, operatorId?: string, operatorName?: string, reason?: string): Promise<Patient | undefined> {
    const patient = await this.getPatient(patientId);
    if (!patient) return undefined;

    const oldPhase = patient.currentPhase;
    const oldAligner = patient.currentAligner;
    patient.currentPhase = newPhase;
    if (newAligner !== undefined) {
      patient.currentAligner = newAligner;
    }
    patient.updatedAt = this.db.now();

    await this.db.run(
      'UPDATE patients SET currentPhase = ?, currentAligner = ?, updatedAt = ? WHERE id = ?',
      [patient.currentPhase, patient.currentAligner, patient.updatedAt, patientId]
    );

    if (oldPhase !== newPhase) {
      await this.addModificationHistory(
        'patient',
        patientId,
        'currentPhase',
        oldPhase,
        newPhase,
        operatorId || 'system',
        operatorName || '系统',
        reason
      );

      await this.addTimelineEvent(
        patientId,
        'PATIENT_PHASE_CHANGED',
        '治疗阶段变更',
        `治疗阶段从 ${oldPhase} 变为 ${newPhase}`,
        reason,
        operatorId,
        operatorName,
        patientId,
        'patient',
        { currentPhase: oldPhase },
        { currentPhase: newPhase }
      );
    }

    if (oldAligner !== patient.currentAligner) {
      await this.addModificationHistory(
        'patient',
        patientId,
        'currentAligner',
        oldAligner,
        patient.currentAligner,
        operatorId || 'system',
        operatorName || '系统',
        reason
      );
    }

    return patient;
  }

  async updateAppointmentStatus(appointmentId: string, newStatus: AppointmentStatus, actualDate?: string, operatorId?: string, operatorName?: string, reason?: string): Promise<Appointment | undefined> {
    const appointment = await this.db.get<Appointment>('SELECT * FROM appointments WHERE id = ?', [appointmentId]);
    if (!appointment) return undefined;

    const oldStatus = appointment.status;
    appointment.status = newStatus;
    if (actualDate) {
      appointment.actualDate = actualDate;
    }
    appointment.updatedAt = this.db.now();

    await this.db.run(
      'UPDATE appointments SET status = ?, actualDate = ?, updatedAt = ? WHERE id = ?',
      [appointment.status, appointment.actualDate || null, appointment.updatedAt, appointmentId]
    );

    await this.addModificationHistory(
      'appointment',
      appointmentId,
      'status',
      oldStatus,
      newStatus,
      operatorId || 'system',
      operatorName || '系统',
      reason
    );

    await this.addTimelineEvent(
      appointment.patientId,
      'APPOINTMENT_STATUS_CHANGED',
      '复诊状态变更',
      `复诊状态从 ${oldStatus} 变为 ${newStatus}`,
      reason,
      operatorId,
      operatorName,
      appointmentId,
      'appointment',
      { status: oldStatus },
      { status: newStatus }
    );

    if (newStatus === AppointmentStatus.COMPLETED || newStatus === AppointmentStatus.MISSED) {
      await this.db.run(
        'UPDATE treatment_todos SET status = ?, completedAt = ? WHERE relatedAppointmentId = ?',
        [TodoStatus.COMPLETED, this.db.now(), appointmentId]
      );
    }

    return appointment;
  }

  async completeTodo(todoId: string, completedBy: string, completedByName: string, reason?: string): Promise<TreatmentTodo | undefined> {
    const todo = await this.db.get<TreatmentTodo>('SELECT * FROM treatment_todos WHERE id = ?', [todoId]);
    if (!todo) return undefined;

    const oldStatus = todo.status;
    todo.status = TodoStatus.COMPLETED;
    todo.completedAt = this.db.now();
    todo.completedBy = completedBy;
    todo.updatedAt = this.db.now();

    await this.db.run(
      'UPDATE treatment_todos SET status = ?, completedAt = ?, completedBy = ?, updatedAt = ? WHERE id = ?',
      [todo.status, todo.completedAt, todo.completedBy, todo.updatedAt, todoId]
    );

    await this.addModificationHistory(
      'treatment_todo',
      todoId,
      'status',
      oldStatus,
      TodoStatus.COMPLETED,
      completedBy,
      completedByName,
      reason
    );

    return todo;
  }

  async resolveException(exceptionId: string, resolution: string, resolvedBy: string, resolvedByName: string, reason?: string): Promise<ExceptionRecord | undefined> {
    const exception = await this.db.get<ExceptionRecord>('SELECT * FROM exception_records WHERE id = ?', [exceptionId]);
    if (!exception) return undefined;

    const oldStatus = exception.status;
    exception.status = ExceptionStatus.RESOLVED;
    exception.resolvedAt = this.db.now();
    exception.resolution = resolution;
    exception.updatedAt = this.db.now();

    await this.db.run(
      'UPDATE exception_records SET status = ?, resolvedAt = ?, resolution = ?, updatedAt = ? WHERE id = ?',
      [exception.status, exception.resolvedAt, exception.resolution, exception.updatedAt, exceptionId]
    );

    await this.addModificationHistory(
      'exception',
      exceptionId,
      'status',
      oldStatus,
      ExceptionStatus.RESOLVED,
      resolvedBy,
      resolvedByName,
      reason
    );

    await this.addTimelineEvent(
      exception.patientId,
      'EXCEPTION_RESOLVED',
      '异常已解决',
      `异常 ${exception.title} 已解决：${resolution}`,
      reason,
      resolvedBy,
      resolvedByName,
      exceptionId,
      'exception',
      { status: oldStatus },
      { status: ExceptionStatus.RESOLVED, resolution }
    );

    return exception;
  }

  async checkOverdueAppointments(): Promise<Appointment[]> {
    const today = new Date().toISOString().split('T')[0];
    const overdueAppointments = await this.db.all<Appointment>(
      `SELECT * FROM appointments 
       WHERE status = ? AND scheduledDate < ?`,
      [AppointmentStatus.SCHEDULED, today]
    );

    for (const appointment of overdueAppointments) {
      const existingException = await this.db.get(
        'SELECT * FROM exception_records WHERE patientId = ? AND relatedAppointmentId = ? AND type = ?',
        [appointment.patientId, appointment.id, ExceptionType.OVERDUE]
      );

      if (!existingException) {
        await this.createException({
          patientId: appointment.patientId,
          type: ExceptionType.OVERDUE,
          title: '复诊逾期提醒',
          description: `原定于 ${appointment.scheduledDate} 的${appointment.type}复诊已逾期，请联系患者确认情况`,
          status: ExceptionStatus.OPEN,
          relatedAppointmentId: appointment.id,
          assigneeId: appointment.doctorId,
          assigneeName: appointment.doctorName
        }, 'system', '系统');

        await this.updateAppointmentStatus(
          appointment.id,
          AppointmentStatus.MISSED,
          undefined,
          'system',
          '系统',
          '复诊逾期，自动标记为爽约'
        );
      }
    }

    return overdueAppointments;
  }

  async getAllPatients(): Promise<Patient[]> {
    return this.db.all<Patient>('SELECT * FROM patients ORDER BY createdAt DESC');
  }

  async getAllTodos(assigneeId?: string, status?: TodoStatus): Promise<TreatmentTodo[]> {
    let sql = 'SELECT * FROM treatment_todos WHERE 1=1';
    const params: any[] = [];

    if (assigneeId) {
      sql += ' AND assigneeId = ?';
      params.push(assigneeId);
    }
    if (status) {
      sql += ' AND status = ?';
      params.push(status);
    }
    sql += ' ORDER BY createdAt DESC';

    return this.db.all<TreatmentTodo>(sql, params);
  }

  async getAllExceptions(status?: ExceptionStatus): Promise<ExceptionRecord[]> {
    let sql = 'SELECT * FROM exception_records WHERE 1=1';
    const params: any[] = [];

    if (status) {
      sql += ' AND status = ?';
      params.push(status);
    }
    sql += ' ORDER BY createdAt DESC';

    return this.db.all<ExceptionRecord>(sql, params);
  }

  async exportReport(filters: {
    startDate?: string;
    endDate?: string;
    assigneeId?: string;
    assigneeName?: string;
  }): Promise<any[]> {
    let sql = `
      SELECT 
        th.modifiedAt as actionTime,
        th.modifiedBy as operatorId,
        th.modifiedByName as operatorName,
        th.entityType,
        th.entityId,
        th.fieldName,
        th.oldValue,
        th.newValue,
        th.reason,
        p.name as patientName
      FROM modification_history th
      LEFT JOIN patients p ON (
        (th.entityType = 'patient' AND th.entityId = p.id) OR
        (th.entityType = 'aligner_batch' AND th.entityId IN (SELECT id FROM aligner_batches WHERE patientId = p.id)) OR
        (th.entityType = 'appointment' AND th.entityId IN (SELECT id FROM appointments WHERE patientId = p.id)) OR
        (th.entityType = 'exception' AND th.entityId IN (SELECT id FROM exception_records WHERE patientId = p.id))
      )
      WHERE 1=1
    `;
    const params: any[] = [];

    if (filters.startDate) {
      sql += ' AND th.modifiedAt >= ?';
      params.push(filters.startDate);
    }
    if (filters.endDate) {
      sql += ' AND th.modifiedAt <= ?';
      params.push(filters.endDate + 'T23:59:59');
    }
    if (filters.assigneeId) {
      sql += ' AND th.modifiedBy = ?';
      params.push(filters.assigneeId);
    }
    if (filters.assigneeName) {
      sql += ' AND th.modifiedByName LIKE ?';
      params.push(`%${filters.assigneeName}%`);
    }

    sql += ' ORDER BY th.modifiedAt DESC';

    const records = await this.db.all<any>(sql, params);
    return records.map(r => ({
      ...r,
      oldValue: r.oldValue ? JSON.parse(r.oldValue) : null,
      newValue: r.newValue ? JSON.parse(r.newValue) : null
    }));
  }

  async batchImportPatients(patients: Array<Omit<Patient, 'id' | 'createdAt' | 'updatedAt'>>, operatorId: string, operatorName: string): Promise<Patient[]> {
    const results: Patient[] = [];
    for (const patient of patients) {
      const result = await this.createPatient(patient, operatorId, operatorName);
      results.push(result);
    }
    return results;
  }

  async batchImportBatches(batches: Array<Omit<AlignerBatch, 'id' | 'createdAt' | 'updatedAt'>>, operatorId: string, operatorName: string): Promise<AlignerBatch[]> {
    const results: AlignerBatch[] = [];
    for (const batch of batches) {
      const result = await this.createAlignerBatch(batch, operatorId, operatorName);
      results.push(result);
    }
    return results;
  }
}

export default TreatmentService;

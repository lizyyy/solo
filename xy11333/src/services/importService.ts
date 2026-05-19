import * as fs from 'fs';
import * as csv from 'csv-parser';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../storage/database';
import {
  Appointment,
  Escort,
  ImportRecord,
  ImportError,
  RecordSource,
} from '../types';

export interface ImportResult<T> {
  batchId: string;
  successCount: number;
  failedCount: number;
  warningCount: number;
  records: T[];
  importRecords: ImportRecord[];
}

export type ValidatorFn<T> = (data: Record<string, any>, index: number) => {
  valid: boolean;
  errors: ImportError[];
  data?: T;
};

export class ImportService {
  generateBatchId(): string {
    return `BATCH-${Date.now()}-${uuidv4().substring(0, 8).toUpperCase()}`;
  }

  private createImportError(
    field: string,
    errorCode: string,
    message: string,
    suggestion: string,
    severity: 'error' | 'warning' = 'error'
  ): ImportError {
    return { field, errorCode, message, suggestion, severity };
  }

  private validateAppointmentData(raw: Record<string, any>, index: number): {
    valid: boolean;
    errors: ImportError[];
    data?: Omit<Appointment, 'id' | 'createdAt' | 'updatedAt'>;
  } {
    const errors: ImportError[] = [];

    if (!raw.appointmentNo && !raw['预约单号'] && !raw['appointment_no']) {
      errors.push(
        this.createImportError(
          'appointmentNo',
          'MISSING_REQUIRED',
          '预约单号不能为空',
          '请填写有效的预约单号，格式如：YY20240101001'
        )
      );
    }

    if (!raw.patientName && !raw['患者姓名'] && !raw['patient_name']) {
      errors.push(
        this.createImportError(
          'patientName',
          'MISSING_REQUIRED',
          '患者姓名不能为空',
          '请填写患者真实姓名'
        )
      );
    }

    if (!raw.patientId && !raw['患者ID'] && !raw['patient_id']) {
      errors.push(
        this.createImportError(
          'patientId',
          'MISSING_REQUIRED',
          '患者ID不能为空',
          '请填写患者身份证号或院内ID'
        )
      );
    }

    const phone = raw.patientPhone || raw['患者电话'] || raw['patient_phone'];
    if (!phone) {
      errors.push(
        this.createImportError(
          'patientPhone',
          'MISSING_REQUIRED',
          '患者电话不能为空',
          '请填写有效的联系电话'
        )
      );
    } else if (!/^1[3-9]\d{9}$/.test(String(phone))) {
      errors.push(
        this.createImportError(
          'patientPhone',
          'INVALID_FORMAT',
          '电话号码格式不正确',
          '请使用11位手机号码格式，如：13800138000',
          'warning'
        )
      );
    }

    const scheduledTime = raw.scheduledTime || raw['预约时间'] || raw['scheduled_time'];
    let parsedTime: number | null = null;
    if (!scheduledTime) {
      errors.push(
        this.createImportError(
          'scheduledTime',
          'MISSING_REQUIRED',
          '预约时间不能为空',
          '请填写预约时间，格式如：2024-01-01 09:00:00 或时间戳'
        )
      );
    } else {
      if (!isNaN(Number(scheduledTime))) {
        parsedTime = Number(scheduledTime);
      } else {
        parsedTime = new Date(String(scheduledTime)).getTime();
        if (isNaN(parsedTime)) {
          errors.push(
            this.createImportError(
              'scheduledTime',
              'INVALID_FORMAT',
              '预约时间格式无法解析',
              '请使用标准日期格式或时间戳'
            )
          );
          parsedTime = null;
        }
      }
    }

    const duration = raw.estimatedDuration || raw['预计时长'] || raw['estimated_duration'];
    let estimatedDuration = 30;
    if (duration) {
      if (isNaN(Number(duration))) {
        errors.push(
          this.createImportError(
            'estimatedDuration',
            'INVALID_FORMAT',
            '预计时长不是有效数字',
            '请填写分钟数，如：30',
            'warning'
          )
        );
      } else {
        estimatedDuration = Number(duration);
      }
    }

    if (errors.some(e => e.severity === 'error')) {
      return { valid: false, errors };
    }

    const appointmentNo = String(
      raw.appointmentNo || raw['预约单号'] || raw['appointment_no'] || ''
    ).trim();

    const existing = db.getAppointmentByNo(appointmentNo);
    if (existing) {
      errors.push(
        this.createImportError(
          'appointmentNo',
          'DUPLICATE',
          `预约单号 ${appointmentNo} 已存在`,
          '请检查是否重复导入或使用其他预约单号',
          'warning'
        )
      );
    }

    const data: Omit<Appointment, 'id' | 'createdAt' | 'updatedAt'> = {
      appointmentNo,
      patientName: String(raw.patientName || raw['患者姓名'] || raw['patient_name'] || '').trim(),
      patientId: String(raw.patientId || raw['患者ID'] || raw['patient_id'] || '').trim(),
      patientPhone: String(phone || '').trim(),
      department: String(raw.department || raw['科室'] || '').trim(),
      examType: String(raw.examType || raw['检查类型'] || raw['exam_type'] || '').trim(),
      examLocation: String(raw.examLocation || raw['检查地点'] || raw['exam_location'] || '').trim(),
      scheduledTime: parsedTime || Date.now(),
      estimatedDuration,
      status: 'scheduled',
      notes: String(raw.notes || raw['备注'] || '').trim(),
      source: 'csv_import',
    };

    return { valid: true, errors, data };
  }

  async importAppointmentsFromCsv(
    filePath: string,
    operator: string
  ): Promise<ImportResult<Appointment>> {
    const batchId = this.generateBatchId();
    const results: Appointment[] = [];
    const importRecords: ImportRecord[] = [];
    let successCount = 0;
    let failedCount = 0;
    let warningCount = 0;

    const rows: Record<string, any>[] = [];
    await new Promise<void>((resolve, reject) => {
      fs.createReadStream(filePath)
        .pipe(csv())
        .on('data', (row) => rows.push(row))
        .on('end', resolve)
        .on('error', reject);
    });

    for (let i = 0; i < rows.length; i++) {
      const raw = rows[i];
      const validation = this.validateAppointmentData(raw, i);
      const rawData = JSON.stringify(raw);

      let status: 'success' | 'failed' | 'warning' = 'success';
      let recordId: string | undefined;

      if (!validation.valid) {
        status = 'failed';
        failedCount++;
      } else if (validation.errors.some(e => e.severity === 'warning')) {
        status = 'warning';
        warningCount++;
      } else {
        successCount++;
      }

      if (validation.data) {
        try {
          const existing = db.getAppointmentByNo(validation.data.appointmentNo);
          if (existing) {
            if (status === 'success') {
              status = 'warning';
              successCount--;
              warningCount++;
            }
            recordId = existing.id;
          } else {
            const record = db.insertAppointment({
              ...validation.data,
              importBatchId: batchId,
            });
            results.push(record);
            recordId = record.id;

            db.insertHistoryRecord({
              entityType: 'appointment',
              entityId: record.id,
              action: 'create',
              newValue: record,
              operator,
              operatorLevel: 'staff',
              reason: 'CSV批量导入',
            });
          }
        } catch (error: any) {
          validation.errors.push(
            this.createImportError(
              'system',
              'DB_ERROR',
              `数据库错误: ${error.message}`,
              '请联系技术支持'
            )
          );
          status = 'failed';
          if (status !== 'failed') {
            successCount--;
          }
          failedCount++;
        }
      }

      const importRecord = db.insertImportRecord({
        batchId,
        sourceType: 'csv',
        fileName: filePath.split('/').pop() || 'unknown.csv',
        recordType: 'appointment',
        originalIndex: i,
        rawData,
        status,
        errors: validation.errors,
        recordId,
      });
      importRecords.push(importRecord);
    }

    return {
      batchId,
      successCount,
      failedCount,
      warningCount,
      records: results,
      importRecords,
    };
  }

  private validateEscortData(raw: Record<string, any>, index: number): {
    valid: boolean;
    errors: ImportError[];
    data?: Omit<Escort, 'id' | 'createdAt' | 'updatedAt'>;
  } {
    const errors: ImportError[] = [];

    if (!raw.employeeId && !raw['工号'] && !raw['employee_id']) {
      errors.push(
        this.createImportError(
          'employeeId',
          'MISSING_REQUIRED',
          '员工工号不能为空',
          '请填写员工工号'
        )
      );
    }

    if (!raw.name && !raw['姓名']) {
      errors.push(
        this.createImportError(
          'name',
          'MISSING_REQUIRED',
          '员工姓名不能为空',
          '请填写员工姓名'
        )
      );
    }

    const phone = raw.phone || raw['电话'];
    if (!phone) {
      errors.push(
        this.createImportError(
          'phone',
          'MISSING_REQUIRED',
          '联系电话不能为空',
          '请填写有效的联系电话'
        )
      );
    } else if (!/^1[3-9]\d{9}$/.test(String(phone))) {
      errors.push(
        this.createImportError(
          'phone',
          'INVALID_FORMAT',
          '电话号码格式不正确',
          '请使用11位手机号码格式',
          'warning'
        )
      );
    }

    const shiftStart = raw.shiftStart || raw['上班时间'] || raw['shift_start'];
    const shiftEnd = raw.shiftEnd || raw['下班时间'] || raw['shift_end'];

    if (!shiftStart) {
      errors.push(
        this.createImportError(
          'shiftStart',
          'MISSING_REQUIRED',
          '上班时间不能为空',
          '请填写上班时间，格式如：08:00'
        )
      );
    } else if (!/^\d{1,2}:\d{2}$/.test(String(shiftStart))) {
      errors.push(
        this.createImportError(
          'shiftStart',
          'INVALID_FORMAT',
          '上班时间格式不正确',
          '请使用HH:mm格式，如：08:00',
          'warning'
        )
      );
    }

    if (!shiftEnd) {
      errors.push(
        this.createImportError(
          'shiftEnd',
          'MISSING_REQUIRED',
          '下班时间不能为空',
          '请填写下班时间，格式如：17:00'
        )
      );
    } else if (!/^\d{1,2}:\d{2}$/.test(String(shiftEnd))) {
      errors.push(
        this.createImportError(
          'shiftEnd',
          'INVALID_FORMAT',
          '下班时间格式不正确',
          '请使用HH:mm格式，如：17:00',
          'warning'
        )
      );
    }

    if (errors.some(e => e.severity === 'error')) {
      return { valid: false, errors };
    }

    const employeeId = String(
      raw.employeeId || raw['工号'] || raw['employee_id'] || ''
    ).trim();

    const existing = db.getEscortByEmployeeId(employeeId);
    if (existing) {
      errors.push(
        this.createImportError(
          'employeeId',
          'DUPLICATE',
          `工号 ${employeeId} 已存在`,
          '请检查是否重复导入',
          'warning'
        )
      );
    }

    const skills = raw.skills || raw['技能'];
    let parsedSkills: string[] = [];
    if (skills) {
      if (Array.isArray(skills)) {
        parsedSkills = skills.map(String);
      } else if (typeof skills === 'string') {
        parsedSkills = skills.split(/[,，、]/).map(s => s.trim()).filter(Boolean);
      }
    }

    const maxTaskCount = raw.maxTaskCount || raw['最大任务数'] || raw['max_task_count'];

    const data: Omit<Escort, 'id' | 'createdAt' | 'updatedAt'> = {
      employeeId,
      name: String(raw.name || raw['姓名'] || '').trim(),
      phone: String(phone || '').trim(),
      department: String(raw.department || raw['部门'] || '').trim(),
      status: 'off_duty',
      shiftStart: String(shiftStart || '08:00').trim(),
      shiftEnd: String(shiftEnd || '17:00').trim(),
      currentTaskCount: 0,
      maxTaskCount: maxTaskCount ? Number(maxTaskCount) : 5,
      skills: parsedSkills,
    };

    return { valid: true, errors, data };
  }

  async importEscortsFromJson(
    filePath: string,
    operator: string
  ): Promise<ImportResult<Escort>> {
    const batchId = this.generateBatchId();
    const results: Escort[] = [];
    const importRecords: ImportRecord[] = [];
    let successCount = 0;
    let failedCount = 0;
    let warningCount = 0;

    const content = fs.readFileSync(filePath, 'utf-8');
    let data: any;
    try {
      data = JSON.parse(content);
    } catch (error: any) {
      throw new Error(`JSON解析失败: ${error.message}`);
    }

    const escorts = Array.isArray(data) ? data : data.escorts || data;

    if (!Array.isArray(escorts)) {
      throw new Error('JSON格式错误：需要数组格式');
    }

    for (let i = 0; i < escorts.length; i++) {
      const raw = escorts[i];
      const validation = this.validateEscortData(raw, i);
      const rawData = JSON.stringify(raw);

      let status: 'success' | 'failed' | 'warning' = 'success';
      let recordId: string | undefined;

      if (!validation.valid) {
        status = 'failed';
        failedCount++;
      } else if (validation.errors.some(e => e.severity === 'warning')) {
        status = 'warning';
        warningCount++;
      } else {
        successCount++;
      }

      if (validation.data) {
        try {
          const existing = db.getEscortByEmployeeId(validation.data.employeeId);
          if (existing) {
            if (status === 'success') {
              status = 'warning';
              successCount--;
              warningCount++;
            }
            recordId = existing.id;
          } else {
            const record = db.insertEscort(validation.data);
            results.push(record);
            recordId = record.id;

            db.insertHistoryRecord({
              entityType: 'escort',
              entityId: record.id,
              action: 'create',
              newValue: record,
              operator,
              operatorLevel: 'staff',
              reason: 'JSON批量导入',
            });
          }
        } catch (error: any) {
          validation.errors.push(
            this.createImportError(
              'system',
              'DB_ERROR',
              `数据库错误: ${error.message}`,
              '请联系技术支持'
            )
          );
          status = 'failed';
          if (status !== 'failed') {
            successCount--;
          }
          failedCount++;
        }
      }

      const importRecord = db.insertImportRecord({
        batchId,
        sourceType: 'json',
        fileName: filePath.split('/').pop() || 'unknown.json',
        recordType: 'escort',
        originalIndex: i,
        rawData,
        status,
        errors: validation.errors,
        recordId,
      });
      importRecords.push(importRecord);
    }

    return {
      batchId,
      successCount,
      failedCount,
      warningCount,
      records: results,
      importRecords,
    };
  }

  getImportReport(batchId: string): {
    summary: {
      total: number;
      success: number;
      failed: number;
      warning: number;
    };
    failedRecords: ImportRecord[];
    warningRecords: ImportRecord[];
  } {
    const records = db.getImportRecordsByBatch(batchId);
    const failedRecords = records.filter(r => r.status === 'failed');
    const warningRecords = records.filter(r => r.status === 'warning');

    return {
      summary: {
        total: records.length,
        success: records.filter(r => r.status === 'success').length,
        failed: failedRecords.length,
        warning: warningRecords.length,
      },
      failedRecords,
      warningRecords,
    };
  }

  retryFailedRecord(importRecordId: string, operator: string): {
    success: boolean;
    recordId?: string;
    errors: ImportError[];
  } {
    const importRecord = db.getImportRecordsByBatch('*').find(r => r.id === importRecordId);
    if (!importRecord) {
      return {
        success: false,
        errors: [this.createImportError('system', 'NOT_FOUND', '导入记录不存在', '请检查记录ID')],
      };
    }

    if (importRecord.status === 'success') {
      return {
        success: true,
        recordId: importRecord.recordId,
        errors: [],
      };
    }

    let rawData: Record<string, any>;
    try {
      rawData = JSON.parse(importRecord.rawData);
    } catch {
      return {
        success: false,
        errors: [this.createImportError('system', 'PARSE_ERROR', '原始数据解析失败', '原始数据格式已损坏')],
      };
    }

    if (importRecord.recordType === 'appointment') {
      const validation = this.validateAppointmentData(rawData, importRecord.originalIndex);
      if (!validation.valid || !validation.data) {
        return { success: false, errors: validation.errors };
      }

      try {
        const existing = db.getAppointmentByNo(validation.data.appointmentNo);
        if (existing) {
          return {
            success: true,
            recordId: existing.id,
            errors: [],
          };
        }

        const record = db.insertAppointment({
          ...validation.data,
          importBatchId: importRecord.batchId,
        });

        db.updateTask(importRecordId, { status: 'success' });

        db.insertHistoryRecord({
          entityType: 'appointment',
          entityId: record.id,
          action: 'create',
          newValue: record,
          operator,
          operatorLevel: 'staff',
          reason: '重试导入',
        });

        return { success: true, recordId: record.id, errors: validation.errors };
      } catch (error: any) {
        return {
          success: false,
          errors: [this.createImportError('system', 'DB_ERROR', error.message, '请联系技术支持')],
        };
      }
    } else if (importRecord.recordType === 'escort') {
      const validation = this.validateEscortData(rawData, importRecord.originalIndex);
      if (!validation.valid || !validation.data) {
        return { success: false, errors: validation.errors };
      }

      try {
        const existing = db.getEscortByEmployeeId(validation.data.employeeId);
        if (existing) {
          return {
            success: true,
            recordId: existing.id,
            errors: [],
          };
        }

        const record = db.insertEscort(validation.data);

        db.insertHistoryRecord({
          entityType: 'escort',
          entityId: record.id,
          action: 'create',
          newValue: record,
          operator,
          operatorLevel: 'staff',
          reason: '重试导入',
        });

        return { success: true, recordId: record.id, errors: validation.errors };
      } catch (error: any) {
        return {
          success: false,
          errors: [this.createImportError('system', 'DB_ERROR', error.message, '请联系技术支持')],
        };
      }
    }

    return {
      success: false,
      errors: [this.createImportError('system', 'UNKNOWN_TYPE', '未知的记录类型', '数据可能已损坏')],
    };
  }
}

export const importService = new ImportService();

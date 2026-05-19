import * as fs from 'fs';
import * as path from 'path';
import { db } from '../storage/database';
import { securityService } from './securityService';
import { EscortTask, Appointment, Escort, PermissionLevel } from '../types';

export type ExportFormat = 'csv' | 'json';

export interface ExportOptions {
  format: ExportFormat;
  startDate?: number;
  endDate?: number;
  status?: string[];
  includeSensitive?: boolean;
  userLevel: PermissionLevel;
}

export class ExportService {
  private escapeCsvValue(value: any): string {
    if (value === null || value === undefined) return '';
    const str = String(value);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  }

  private toCsv(data: any[], headers: string[]): string {
    const headerRow = headers.map(h => this.escapeCsvValue(h)).join(',');
    const dataRows = data.map(row =>
      headers.map(h => this.escapeCsvValue(row[h])).join(',')
    );
    return [headerRow, ...dataRows].join('\n');
  }

  private toJson(data: any[]): string {
    return JSON.stringify(data, null, 2);
  }

  exportTasks(options: ExportOptions): {
    success: boolean;
    data?: string;
    count: number;
    error?: string;
  } {
    try {
      let tasks = db.getTasksByStatus('pending');
      tasks = [
        ...tasks,
        ...db.getTasksByStatus('assigned'),
        ...db.getTasksByStatus('in_progress'),
        ...db.getTasksByStatus('completed'),
        ...db.getTasksByStatus('cancelled'),
        ...db.getTasksByStatus('timeout'),
      ];

      if (options.startDate) {
        tasks = tasks.filter(t => t.scheduledTime >= options.startDate!);
      }
      if (options.endDate) {
        tasks = tasks.filter(t => t.scheduledTime <= options.endDate!);
      }
      if (options.status && options.status.length > 0) {
        tasks = tasks.filter(t => options.status!.includes(t.status));
      }

      let processedTasks = tasks.map(t => ({
        taskNo: t.taskNo,
        patientName: t.patientName,
        patientId: t.patientId,
        examType: t.examType,
        examLocation: t.examLocation,
        scheduledTime: new Date(t.scheduledTime).toLocaleString('zh-CN'),
        status: t.status,
        priority: t.priority,
        isInserted: t.isInserted ? '是' : '否',
        insertReason: t.insertReason || '',
        cancelReason: t.cancelReason || '',
        timeoutReason: t.timeoutReason || '',
        waitDuration: t.waitDuration || 0,
        actualDuration: t.actualDuration || 0,
        createdBy: t.createdBy,
        createdAt: new Date(t.createdAt).toLocaleString('zh-CN'),
      }));

      if (!options.includeSensitive) {
        processedTasks = processedTasks.map(t =>
          securityService.sanitizeLogData(t, options.userLevel)
        );
      }

      const headers = [
        'taskNo', 'patientName', 'patientId', 'examType', 'examLocation',
        'scheduledTime', 'status', 'priority', 'isInserted', 'insertReason',
        'cancelReason', 'timeoutReason', 'waitDuration', 'actualDuration',
        'createdBy', 'createdAt'
      ];

      const data = options.format === 'csv'
        ? this.toCsv(processedTasks, headers)
        : this.toJson(processedTasks);

      return { success: true, data, count: processedTasks.length };
    } catch (error: any) {
      return { success: false, count: 0, error: error.message };
    }
  }

  exportEscorts(options: ExportOptions): {
    success: boolean;
    data?: string;
    count: number;
    error?: string;
  } {
    try {
      let escorts = db.getAllEscorts();

      let processedEscorts = escorts.map(e => ({
        employeeId: e.employeeId,
        name: e.name,
        phone: e.phone,
        department: e.department,
        status: e.status,
        shiftStart: e.shiftStart,
        shiftEnd: e.shiftEnd,
        currentTaskCount: e.currentTaskCount,
        maxTaskCount: e.maxTaskCount,
        skills: e.skills.join('; '),
        createdAt: new Date(e.createdAt).toLocaleString('zh-CN'),
      }));

      if (!options.includeSensitive) {
        processedEscorts = processedEscorts.map(e =>
          securityService.sanitizeLogData(e, options.userLevel)
        );
      }

      const headers = [
        'employeeId', 'name', 'phone', 'department', 'status',
        'shiftStart', 'shiftEnd', 'currentTaskCount', 'maxTaskCount',
        'skills', 'createdAt'
      ];

      const data = options.format === 'csv'
        ? this.toCsv(processedEscorts, headers)
        : this.toJson(processedEscorts);

      return { success: true, data, count: processedEscorts.length };
    } catch (error: any) {
      return { success: false, count: 0, error: error.message };
    }
  }

  exportAppointments(options: ExportOptions): {
    success: boolean;
    data?: string;
    count: number;
    error?: string;
  } {
    try {
      let appointments: Appointment[] = [];
      if (options.startDate && options.endDate) {
        appointments = db.getAppointmentsByDate(options.startDate, options.endDate);
      } else {
        const allTasks = db.getTasksByStatus('pending');
        const appointmentIds = new Set(allTasks.map(t => t.appointmentId));
        for (const id of appointmentIds) {
          const apt = db.getAppointmentById(id);
          if (apt) appointments.push(apt);
        }
      }

      let processedApts = appointments.map(a => ({
        appointmentNo: a.appointmentNo,
        patientName: a.patientName,
        patientId: a.patientId,
        patientPhone: a.patientPhone,
        department: a.department,
        examType: a.examType,
        examLocation: a.examLocation,
        scheduledTime: new Date(a.scheduledTime).toLocaleString('zh-CN'),
        estimatedDuration: a.estimatedDuration,
        status: a.status,
        notes: a.notes || '',
        source: a.source,
        importBatchId: a.importBatchId || '',
        createdAt: new Date(a.createdAt).toLocaleString('zh-CN'),
      }));

      if (!options.includeSensitive) {
        processedApts = processedApts.map(a =>
          securityService.sanitizeLogData(a, options.userLevel)
        );
      }

      const headers = [
        'appointmentNo', 'patientName', 'patientId', 'patientPhone',
        'department', 'examType', 'examLocation', 'scheduledTime',
        'estimatedDuration', 'status', 'notes', 'source', 'importBatchId',
        'createdAt'
      ];

      const data = options.format === 'csv'
        ? this.toCsv(processedApts, headers)
        : this.toJson(processedApts);

      return { success: true, data, count: processedApts.length };
    } catch (error: any) {
      return { success: false, count: 0, error: error.message };
    }
  }

  exportOperationLogs(
    entityType: string,
    entityId: string,
    options: ExportOptions
  ): {
    success: boolean;
    data?: string;
    count: number;
    error?: string;
  } {
    try {
      const logs = db.getHistoryByEntity(entityType, entityId);

      const processedLogs = logs.map(l => ({
        action: l.action,
        operator: l.operator,
        operatorLevel: l.operatorLevel,
        ipAddress: l.ipAddress || '',
        reason: l.reason || '',
        timestamp: new Date(l.timestamp).toLocaleString('zh-CN'),
      }));

      const headers = [
        'action', 'operator', 'operatorLevel', 'ipAddress', 'reason', 'timestamp'
      ];

      const data = options.format === 'csv'
        ? this.toCsv(processedLogs, headers)
        : this.toJson(processedLogs);

      return { success: true, data, count: processedLogs.length };
    } catch (error: any) {
      return { success: false, count: 0, error: error.message };
    }
  }

  saveToFile(data: string, filePath: string): boolean {
    try {
      const dir = path.dirname(filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(filePath, data, 'utf-8');
      return true;
    } catch {
      return false;
    }
  }
}

export const exportService = new ExportService();

import * as fs from 'fs';
import csvParser from 'csv-parser';
import { DataStore } from '../store/DataStore';
import {
  AttendanceRecord,
  LeaveRecord,
  LocationTrace,
  Person,
  ImportResult,
  AttendanceStatus,
  LeaveStatus,
  ObjectLevel,
  LeaveType
} from '../types';

export class ImportService {
  private store: DataStore;

  constructor() {
    this.store = DataStore.getInstance();
  }

  async importAttendanceCSV(filePath: string): Promise<ImportResult<AttendanceRecord>> {
    const results: AttendanceRecord[] = [];
    const errors: string[] = [];
    let rowIndex = 0;

    return new Promise((resolve) => {
      fs.createReadStream(filePath)
        .pipe(csvParser())
        .on('data', (row: any) => {
          rowIndex++;
          try {
            const record = this.parseAttendanceRow(row, rowIndex);
            if (record) {
              results.push(record);
              this.store.addAttendance(record);
            }
          } catch (e: any) {
            errors.push(`第${rowIndex}行: ${e.message}`);
          }
        })
        .on('end', () => {
          resolve({
            success: errors.length === 0,
            totalCount: rowIndex,
            successCount: results.length,
            failedCount: errors.length,
            errors,
            data: results
          });
        });
    });
  }

  private parseAttendanceRow(row: any, rowIndex: number): AttendanceRecord | null {
    if (!row.personId || !row.personName || !row.date) {
      throw new Error(`缺少必要字段: personId, personName, date`);
    }

    let status = AttendanceStatus.NORMAL;
    if (row.status) {
      status = row.status as AttendanceStatus;
    } else if (!row.signInTime && !row.signOutTime) {
      status = AttendanceStatus.ABSENT;
    }

    return {
      id: this.store.generateId(),
      personId: row.personId,
      personName: row.personName,
      date: row.date,
      signInTime: row.signInTime,
      signOutTime: row.signOutTime,
      expectedSignInTime: row.expectedSignInTime || '09:00',
      expectedSignOutTime: row.expectedSignOutTime || '18:00',
      status,
      source: row.source || 'CSV导入',
      location: row.location,
      remark: row.remark,
      createdAt: this.store.now(),
      updatedAt: this.store.now()
    };
  }

  async importLeaveJSON(filePath: string): Promise<ImportResult<LeaveRecord>> {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const data = JSON.parse(content);
      const leaves: LeaveRecord[] = [];
      const errors: string[] = [];

      const leaveArray = Array.isArray(data) ? data : [data];

      leaveArray.forEach((item: any, index: number) => {
        try {
          const leave = this.parseLeaveItem(item);
          leaves.push(leave);
          this.store.addLeave(leave);
        } catch (e: any) {
          errors.push(`第${index + 1}条: ${e.message}`);
        }
      });

      return {
        success: errors.length === 0,
        totalCount: leaveArray.length,
        successCount: leaves.length,
        failedCount: errors.length,
        errors,
        data: leaves
      };
    } catch (e: any) {
      return {
        success: false,
        totalCount: 0,
        successCount: 0,
        failedCount: 1,
        errors: [`JSON解析失败: ${e.message}`],
        data: []
      };
    }
  }

  private parseLeaveItem(item: any): LeaveRecord {
    if (!item.personId || !item.personName || !item.startDate || !item.endDate || !item.reason) {
      throw new Error(`缺少必要字段: personId, personName, startDate, endDate, reason`);
    }

    return {
      id: this.store.generateId(),
      personId: item.personId,
      personName: item.personName,
      leaveType: item.leaveType || LeaveType.OTHER,
      startDate: item.startDate,
      endDate: item.endDate,
      startTime: item.startTime,
      endTime: item.endTime,
      reason: item.reason,
      status: item.status || LeaveStatus.PENDING,
      approver: item.approver,
      approveTime: item.approveTime,
      source: item.source || 'JSON导入',
      createdAt: this.store.now(),
      updatedAt: this.store.now()
    };
  }

  async importLocationTrace(filePath: string): Promise<ImportResult<LocationTrace>> {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const data = JSON.parse(content);
      const traces: LocationTrace[] = [];
      const errors: string[] = [];

      const traceArray = Array.isArray(data) ? data : [data];

      traceArray.forEach((item: any, index: number) => {
        try {
          const trace = this.parseLocationTrace(item);
          traces.push(trace);
          this.store.addLocationTrace(trace);
        } catch (e: any) {
          errors.push(`第${index + 1}条: ${e.message}`);
        }
      });

      return {
        success: errors.length === 0,
        totalCount: traceArray.length,
        successCount: traces.length,
        failedCount: errors.length,
        errors,
        data: traces
      };
    } catch (e: any) {
      return {
        success: false,
        totalCount: 0,
        successCount: 0,
        failedCount: 1,
        errors: [`JSON解析失败: ${e.message}`],
        data: []
      };
    }
  }

  private parseLocationTrace(item: any): LocationTrace {
    if (!item.personId || !item.personName || !item.date || !item.tracePoints) {
      throw new Error(`缺少必要字段: personId, personName, date, tracePoints`);
    }

    return {
      id: this.store.generateId(),
      personId: item.personId,
      personName: item.personName,
      date: item.date,
      tracePoints: item.tracePoints,
      totalDistance: item.totalDistance,
      anomalyCount: item.anomalyCount || item.tracePoints.filter((p: any) => p.isAnomaly).length,
      isComplete: item.isComplete !== false,
      source: item.source || '定位系统',
      createdAt: this.store.now(),
      updatedAt: this.store.now()
    };
  }

  importPersons(persons: Person[]): ImportResult<Person> {
    const errors: string[] = [];
    
    persons.forEach((person, index) => {
      try {
        if (!person.id || !person.name) {
          throw new Error(`缺少id或name`);
        }
        this.store.addPerson(person);
      } catch (e: any) {
        errors.push(`第${index + 1}条: ${e.message}`);
      }
    });

    return {
      success: errors.length === 0,
      totalCount: persons.length,
      successCount: persons.length - errors.length,
      failedCount: errors.length,
      errors,
      data: persons
    };
  }
}

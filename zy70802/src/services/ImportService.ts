import * as fs from 'fs';
import csvParser from 'csv-parser';
import { Readable } from 'stream';
import {
  CriticalValueRecord,
  CallbackRecord,
  DutySchedule,
  ImportResult,
  CriticalValuePriority,
} from '../types';
import { DataStore } from '../store/DataStore';
import dayjs from 'dayjs';

export class ImportService {
  private dataStore: DataStore;

  constructor() {
    this.dataStore = DataStore.getInstance();
  }

  async importCriticalValuesFromCSV(filePath: string): Promise<ImportResult<CriticalValueRecord>> {
    const results: Omit<CriticalValueRecord, 'id'>[] = [];
    const errors: string[] = [];
    let rowNumber = 0;

    return new Promise((resolve) => {
      fs.createReadStream(filePath)
        .pipe(csvParser())
        .on('data', (data: Record<string, string>) => {
          rowNumber++;
          try {
            const record = this.parseCriticalValueRow(data, rowNumber);
            if (record) {
              results.push(record);
            }
          } catch (e) {
            errors.push(`行 ${rowNumber}: ${(e as Error).message}`);
          }
        })
        .on('end', () => {
          const imported = this.dataStore.addCriticalValues(results);
          resolve({
            success: errors.length === 0,
            data: imported,
            errors,
            totalCount: rowNumber,
            importedCount: imported.length,
          });
        })
        .on('error', (err: Error) => {
          errors.push(`文件读取错误: ${err.message}`);
          resolve({
            success: false,
            data: [],
            errors,
            totalCount: rowNumber,
            importedCount: 0,
          });
        });
    });
  }

  async importCriticalValuesFromCSVBuffer(buffer: Buffer): Promise<ImportResult<CriticalValueRecord>> {
    const results: Omit<CriticalValueRecord, 'id'>[] = [];
    const errors: string[] = [];
    let rowNumber = 0;

    return new Promise((resolve) => {
      const stream = Readable.from(buffer.toString());
      stream
        .pipe(csvParser())
        .on('data', (data: Record<string, string>) => {
          rowNumber++;
          try {
            const record = this.parseCriticalValueRow(data, rowNumber);
            if (record) {
              results.push(record);
            }
          } catch (e) {
            errors.push(`行 ${rowNumber}: ${(e as Error).message}`);
          }
        })
        .on('end', () => {
          const imported = this.dataStore.addCriticalValues(results);
          resolve({
            success: errors.length === 0,
            data: imported,
            errors,
            totalCount: rowNumber,
            importedCount: imported.length,
          });
        })
        .on('error', (err: Error) => {
          errors.push(`文件读取错误: ${err.message}`);
          resolve({
            success: false,
            data: [],
            errors,
            totalCount: rowNumber,
            importedCount: 0,
          });
        });
    });
  }

  private parseCriticalValueRow(data: any, rowNumber: number): Omit<CriticalValueRecord, 'id'> | null {
    const patientId = data['患者ID'] || data['patientId'] || data['patient_id'];
    const patientName = data['患者姓名'] || data['patientName'] || data['patient_name'];
    const department = data['科室'] || data['department'];
    const ward = data['病区'] || data['ward'] || '';
    const bedNo = data['床号'] || data['bedNo'] || data['bed_no'] || '';
    const testItem = data['检验项目'] || data['testItem'] || data['test_item'];
    const testResult = data['检验结果'] || data['testResult'] || data['test_result'];
    const referenceRange = data['参考范围'] || data['referenceRange'] || data['reference_range'] || '';
    const priority = (data['优先级'] || data['priority'] || 'normal') as CriticalValuePriority;
    const reportedAtStr = data['报告时间'] || data['reportedAt'] || data['reported_at'];
    const reportedBy = data['报告人'] || data['reportedBy'] || data['reported_by'] || '';
    const smsSentAtStr = data['短信发送时间'] || data['smsSentAt'] || data['sms_sent_at'];

    if (!patientId || !patientName || !testItem || !testResult || !reportedAtStr) {
      throw new Error('缺少必填字段: 患者ID、姓名、检验项目、检验结果、报告时间');
    }

    const reportedAt = this.parseDate(reportedAtStr);
    if (!reportedAt) {
      throw new Error(`报告时间格式错误: ${reportedAtStr}`);
    }

    const smsSentAt = smsSentAtStr ? this.parseDate(smsSentAtStr) : undefined;

    return {
        patientId,
        patientName,
        department,
        ward,
        bedNo,
        testItem,
        testResult,
        referenceRange,
        priority,
        reportedAt,
        reportedBy,
        smsSentAt: smsSentAt || undefined,
        notes: data['备注'] || data['notes'] || '',
      };
  }

  async importCallbacksFromJSON(filePath: string): Promise<ImportResult<CallbackRecord>> {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const data = JSON.parse(content);
      return this.parseCallbacks(data);
    } catch (e) {
      return {
        success: false,
        data: [],
        errors: [`JSON解析错误: ${(e as Error).message}`],
        totalCount: 0,
        importedCount: 0,
      };
    }
  }

  async importCallbacksFromJSONString(jsonString: string): Promise<ImportResult<CallbackRecord>> {
    try {
      const data = JSON.parse(jsonString);
      return this.parseCallbacks(data);
    } catch (e) {
      return {
        success: false,
        data: [],
        errors: [`JSON解析错误: ${(e as Error).message}`],
        totalCount: 0,
        importedCount: 0,
      };
    }
  }

  private parseCallbacks(data: any): ImportResult<CallbackRecord> {
    const errors: string[] = [];
    const results: Omit<CallbackRecord, 'id'>[] = [];

    const records = Array.isArray(data) ? data : (data.callbacks || data.records || data);

    if (!Array.isArray(records)) {
      return {
        success: false,
        data: [],
        errors: ['JSON格式错误: 需要数组格式'],
        totalCount: 0,
        importedCount: 0,
      };
    }

    records.forEach((item, index) => {
      try {
        const record = this.parseCallbackRow(item, index + 1);
        if (record) {
          results.push(record);
        }
      } catch (e) {
        errors.push(`记录 ${index + 1}: ${(e as Error).message}`);
      }
    });

    const imported = this.dataStore.addCallbacks(results);

    return {
      success: errors.length === 0,
      data: imported,
      errors,
      totalCount: records.length,
      importedCount: imported.length,
    };
  }

  private parseCallbackRow(data: any, index: number): Omit<CallbackRecord, 'id'> {
    const patientId = data.patientId || data.patient_id || data['患者ID'];
    const patientName = data.patientName || data.patient_name || data['患者姓名'];
    const calledAtStr = data.calledAt || data.called_at || data['通话时间'];
    const calledBy = data.calledBy || data.called_by || data['拨打人'] || '';
    const calledTo = data.calledTo || data.called_to || data['接听号码'] || '';
    const doctorName = data.doctorName || data.doctor_name || data['医生姓名'] || '';
    const confirmedAtStr = data.confirmedAt || data.confirmed_at || data['确认时间'];
    const confirmationNotes = data.confirmationNotes || data.confirmation_notes || data['确认备注'] || '';
    const callResult = data.callResult || data.call_result || data['通话结果'] || 'connected';
    const criticalValueId = data.criticalValueId || data.critical_value_id || data['危急值ID'];

    if (!patientId || !patientName || !calledAtStr) {
      throw new Error('缺少必填字段: 患者ID、姓名、通话时间');
    }

    const calledAt = this.parseDate(calledAtStr);
    if (!calledAt) {
      throw new Error(`通话时间格式错误: ${calledAtStr}`);
    }

    const confirmedAt = confirmedAtStr ? this.parseDate(confirmedAtStr) : undefined;

    return {
      criticalValueId,
      patientId,
      patientName,
      calledAt,
      calledBy,
      calledTo,
      doctorName,
      confirmedAt: confirmedAt || undefined,
      confirmationNotes,
      callResult: callResult as CallbackRecord['callResult'],
    };
  }

  async importDutySchedulesFromCSV(filePath: string): Promise<ImportResult<DutySchedule>> {
    const results: Omit<DutySchedule, 'id'>[] = [];
    const errors: string[] = [];
    let rowNumber = 0;

    return new Promise((resolve) => {
      fs.createReadStream(filePath)
        .pipe(csvParser())
        .on('data', (data: Record<string, string>) => {
          rowNumber++;
          try {
            const record = this.parseDutyScheduleRow(data, rowNumber);
            if (record) {
              results.push(record);
            }
          } catch (e) {
            errors.push(`行 ${rowNumber}: ${(e as Error).message}`);
          }
        })
        .on('end', () => {
          const imported = this.dataStore.addDutySchedules(results);
          resolve({
            success: errors.length === 0,
            data: imported,
            errors,
            totalCount: rowNumber,
            importedCount: imported.length,
          });
        })
        .on('error', (err: Error) => {
          errors.push(`文件读取错误: ${err.message}`);
          resolve({
            success: false,
            data: [],
            errors,
            totalCount: rowNumber,
            importedCount: 0,
          });
        });
    });
  }

  async importDutySchedulesFromCSVBuffer(buffer: Buffer): Promise<ImportResult<DutySchedule>> {
    const results: Omit<DutySchedule, 'id'>[] = [];
    const errors: string[] = [];
    let rowNumber = 0;

    return new Promise((resolve) => {
      const stream = Readable.from(buffer.toString());
      stream
        .pipe(csvParser())
        .on('data', (data: Record<string, string>) => {
          rowNumber++;
          try {
            const record = this.parseDutyScheduleRow(data, rowNumber);
            if (record) {
              results.push(record);
            }
          } catch (e) {
            errors.push(`行 ${rowNumber}: ${(e as Error).message}`);
          }
        })
        .on('end', () => {
          const imported = this.dataStore.addDutySchedules(results);
          resolve({
            success: errors.length === 0,
            data: imported,
            errors,
            totalCount: rowNumber,
            importedCount: imported.length,
          });
        })
        .on('error', (err: Error) => {
          errors.push(`文件读取错误: ${err.message}`);
          resolve({
            success: false,
            data: [],
            errors,
            totalCount: rowNumber,
            importedCount: 0,
          });
        });
    });
  }

  private parseDutyScheduleRow(data: any, rowNumber: number): Omit<DutySchedule, 'id'> {
    const dateStr = data['日期'] || data['date'];
    const shift = data['班次'] || data['shift'] || 'morning';
    const department = data['科室'] || data['department'];
    const doctorName = data['医生姓名'] || data['doctorName'] || data['doctor_name'];
    const doctorPhone = data['医生电话'] || data['doctorPhone'] || data['doctor_phone'] || '';
    const startTimeStr = data['开始时间'] || data['startTime'] || data['start_time'];
    const endTimeStr = data['结束时间'] || data['endTime'] || data['end_time'];

    if (!dateStr || !department || !doctorName) {
      throw new Error('缺少必填字段: 日期、科室、医生姓名');
    }

    const date = this.parseDate(dateStr);
    if (!date) {
      throw new Error(`日期格式错误: ${dateStr}`);
    }

    let startTime: Date;
    let endTime: Date;

    if (startTimeStr) {
      const parsed = this.parseTime(startTimeStr, date);
      if (parsed) startTime = parsed;
      else throw new Error(`开始时间格式错误: ${startTimeStr}`);
    } else {
      startTime = this.getDefaultStartTime(shift, date);
    }

    if (endTimeStr) {
      const parsed = this.parseTime(endTimeStr, date);
      if (parsed) endTime = parsed;
      else throw new Error(`结束时间格式错误: ${endTimeStr}`);
    } else {
      endTime = this.getDefaultEndTime(shift, date);
    }

    return {
      date,
      shift,
      department,
      doctorName,
      doctorPhone,
      startTime,
      endTime,
    };
  }

  private parseDate(str: string): Date | null {
    const formats = [
      'YYYY-MM-DD HH:mm:ss',
      'YYYY-MM-DD HH:mm',
      'YYYY-MM-DD',
      'YYYY/MM/DD HH:mm:ss',
      'YYYY/MM/DD HH:mm',
      'YYYY/MM/DD',
      'MM/DD/YYYY HH:mm:ss',
      'MM/DD/YYYY',
    ];

    for (const format of formats) {
      const parsed = dayjs(str, format);
      if (parsed.isValid()) {
        return parsed.toDate();
      }
    }

    const timestamp = Date.parse(str);
    if (!isNaN(timestamp)) {
      return new Date(timestamp);
    }

    return null;
  }

  private parseTime(timeStr: string, date: Date): Date | null {
    const dateStr = dayjs(date).format('YYYY-MM-DD');
    const parsed = dayjs(`${dateStr} ${timeStr}`, 'YYYY-MM-DD HH:mm');
    if (parsed.isValid()) {
      return parsed.toDate();
    }
    return null;
  }

  private getDefaultStartTime(shift: string, date: Date): Date {
    const base = dayjs(date);
    switch (shift) {
      case 'morning':
        return base.hour(8).minute(0).second(0).toDate();
      case 'afternoon':
        return base.hour(14).minute(0).second(0).toDate();
      case 'night':
        return base.hour(20).minute(0).second(0).toDate();
      default:
        return base.hour(8).minute(0).second(0).toDate();
    }
  }

  private getDefaultEndTime(shift: string, date: Date): Date {
    const base = dayjs(date);
    switch (shift) {
      case 'morning':
        return base.hour(14).minute(0).second(0).toDate();
      case 'afternoon':
        return base.hour(20).minute(0).second(0).toDate();
      case 'night':
        return base.add(1, 'day').hour(8).minute(0).second(0).toDate();
      default:
        return base.hour(17).minute(0).second(0).toDate();
    }
  }
}

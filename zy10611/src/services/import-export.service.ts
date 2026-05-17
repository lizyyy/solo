import * as fs from 'fs';
import csv from 'csv-parser';
import { Parser } from 'json2csv';
import { Appointment, ImportResult, ErrorCode } from '../types';
import { appointmentService } from './appointment.service';

export class ImportExportService {
  async importFromCSV(filePath: string, createdBy: string): Promise<ImportResult> {
    const results: Record<string, any>[] = [];
    const badRows: ImportResult['badRows'] = [];
    const appointments: Appointment[] = [];

    return new Promise((resolve) => {
      fs.createReadStream(filePath)
        .pipe(csv())
        .on('data', (data: Record<string, any>) => results.push(data))
        .on('end', async () => {
          for (let i = 0; i < results.length; i++) {
            const row = results[i];
            const rowNumber = i + 2;

            try {
              const validation = this.validateImportRow(row);
              if (!validation.valid) {
                badRows.push({
                  row: rowNumber,
                  data: row,
                  reason: validation.reason!
                });
                continue;
              }

              const result = appointmentService.createAppointment({
                indexName: row.indexName,
                dataSize: parseInt(row.dataSize, 10),
                timeWindow: {
                  start: row.startTime,
                  end: row.endTime
                },
                impactScope: row.impactScope.split(';'),
                createdBy,
                remark: row.remark
              });

              if (result.success && result.data) {
                appointments.push(result.data);
              } else if (result.error) {
                badRows.push({
                  row: rowNumber,
                  data: row,
                  reason: result.error.message
                });
              }
            } catch (error) {
              badRows.push({
                row: rowNumber,
                data: row,
                reason: error instanceof Error ? error.message : '未知错误'
              });
            }
          }

          resolve({
            total: results.length,
            success: appointments.length,
            failed: badRows.length,
            badRows,
            appointments
          });
        });
    });
  }

  private validateImportRow(row: any): { valid: boolean; reason?: string } {
    if (!row.indexName || !row.indexName.trim()) {
      return { valid: false, reason: '索引名不能为空' };
    }

    if (!row.dataSize || isNaN(parseInt(row.dataSize, 10)) || parseInt(row.dataSize, 10) <= 0) {
      return { valid: false, reason: '数据量必须是大于0的数字' };
    }

    if (!row.startTime || !row.endTime) {
      return { valid: false, reason: '开始时间和结束时间不能为空' };
    }

    const timePattern = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
    if (!timePattern.test(row.startTime) || !timePattern.test(row.endTime)) {
      return { valid: false, reason: '时间格式错误，应为 HH:MM' };
    }

    if (!row.impactScope) {
      return { valid: false, reason: '影响范围不能为空' };
    }

    return { valid: true };
  }

  exportToCSV(appointments: Appointment[], outputPath: string): void {
    const fields = [
      { label: 'ID', value: 'id' },
      { label: '索引名', value: 'indexName' },
      { label: '数据量', value: 'dataSize' },
      { label: '是否大索引', value: (row: Appointment) => row.isLargeIndex ? '是' : '否' },
      { label: '开始时间', value: (row: Appointment) => row.timeWindow.start },
      { label: '结束时间', value: (row: Appointment) => row.timeWindow.end },
      { label: '影响范围', value: (row: Appointment) => row.impactScope.join(';') },
      { label: '状态', value: 'status' },
      { label: '流程类型', value: 'flowType' },
      { label: '创建人', value: 'createdBy' },
      { label: '驳回原因', value: 'rejectReason' },
      { label: '备注', value: 'remark' },
      { label: '创建时间', value: 'createdAt' },
      { label: '更新时间', value: 'updatedAt' }
    ];

    const json2csvParser = new Parser({ fields });
    const csv = json2csvParser.parse(appointments);

    fs.writeFileSync(outputPath, csv, 'utf-8');
  }

  exportHistoriesToCSV(histories: any[], outputPath: string): void {
    const fields = [
      { label: '历史记录ID', value: 'id' },
      { label: '预约ID', value: 'appointmentId' },
      { label: '原状态', value: 'fromStatus' },
      { label: '新状态', value: 'toStatus' },
      { label: '流程类型', value: 'flowType' },
      { label: '操作人', value: 'operator' },
      { label: '备注', value: 'remark' },
      { label: '操作时间', value: 'createdAt' }
    ];

    const json2csvParser = new Parser({ fields });
    const csv = json2csvParser.parse(histories);

    fs.writeFileSync(outputPath, csv, 'utf-8');
  }
}

export const importExportService = new ImportExportService();

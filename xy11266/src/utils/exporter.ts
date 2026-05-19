import ExcelJS from 'exceljs';
import fs from 'fs';
import path from 'path';
import { CallRecord, AnomalyRecord, QueryFilters } from '../types';

export class Exporter {
  async exportToExcel(
    records: (CallRecord & { anomalies: AnomalyRecord[] })[],
    outputPath: string
  ): Promise<string> {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('质检结果');

    worksheet.columns = [
      { header: '通话ID', key: 'callId', width: 20 },
      { header: '坐席姓名', key: 'agentName', width: 15 },
      { header: '坐席工号', key: 'agentId', width: 15 },
      { header: '通话日期', key: 'callDate', width: 15 },
      { header: '通话时长(秒)', key: 'callDuration', width: 15 },
      { header: '检测状态', key: 'status', width: 12 },
      { header: '异常类型', key: 'anomalyTypes', width: 30 },
      { header: '异常描述', key: 'anomalyDescriptions', width: 50 },
    ];

    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' }
    };

    records.forEach(record => {
      const anomalyTypes = [...new Set(record.anomalies.map(a => this.translateAnomalyType(a.anomalyType)))];
      const anomalyDescriptions = record.anomalies.map(a => a.description).join('; ');

      const row = worksheet.addRow({
        callId: record.callId,
        agentName: record.agentName,
        agentId: record.agentId,
        callDate: record.callDate,
        callDuration: record.callDuration,
        status: this.translateStatus(record.status),
        anomalyTypes: anomalyTypes.join(', ') || '无',
        anomalyDescriptions: anomalyDescriptions || '正常'
      });

      if (record.status === 'abnormal') {
        row.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFFFE0E0' }
        };
      }
    });

    worksheet.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: 1, column: 8 }
    };

    await workbook.xlsx.writeFile(outputPath);
    return outputPath;
  }

  async exportToCSV(
    records: (CallRecord & { anomalies: AnomalyRecord[] })[],
    outputPath: string
  ): Promise<string> {
    const headers = [
      '通话ID', '坐席姓名', '坐席工号', '通话日期', '通话时长(秒)',
      '检测状态', '异常类型', '异常描述'
    ];

    const rows = records.map(record => {
      const anomalyTypes = [...new Set(record.anomalies.map(a => this.translateAnomalyType(a.anomalyType)))];
      const anomalyDescriptions = record.anomalies.map(a => a.description).join('; ');

      return [
        record.callId,
        record.agentName,
        record.agentId,
        record.callDate,
        record.callDuration.toString(),
        this.translateStatus(record.status),
        anomalyTypes.join(', ') || '无',
        anomalyDescriptions || '正常'
      ].map(field => `"${field.replace(/"/g, '""')}"`).join(',');
    });

    const csvContent = [headers.join(','), ...rows].join('\n');
    fs.writeFileSync(outputPath, '\uFEFF' + csvContent, 'utf-8');
    return outputPath;
  }

  private translateStatus(status: string): string {
    const statusMap: Record<string, string> = {
      'normal': '正常',
      'abnormal': '异常',
      'pending': '待检测'
    };
    return statusMap[status] || status;
  }

  private translateAnomalyType(type: string): string {
    const typeMap: Record<string, string> = {
      'apology_missing': '缺少道歉',
      'refund_promise_missing': '缺少退款承诺',
      'sensitive_word': '敏感词',
      'other': '其他'
    };
    return typeMap[type] || type;
  }
}

export const exporter = new Exporter();

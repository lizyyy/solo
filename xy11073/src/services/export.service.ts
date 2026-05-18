import { ImportResult, EquipmentBooking, BadRecord } from '../types';

export class ExportService {
  exportToJSON(result: ImportResult): string {
    return JSON.stringify(result, null, 2);
  }

  exportNormalRecordsToTable(records: EquipmentBooking[]): string {
    const headers = [
      '预约编号', '门店名称', '患者姓名', '患者手机号', 
      '器械名称', '器械强度等级', '预约日期', '预约时间', 
      '治疗师姓名', '预约状态'
    ];

    const rows = records.map(record => [
      record.预约编号,
      record.门店名称,
      record.患者姓名,
      record.患者手机号,
      record.器械名称,
      record.器械强度等级,
      record.预约日期,
      `${record.预约开始时间}-${record.预约结束时间}`,
      record.治疗师姓名,
      record.预约状态
    ]);

    return this.formatAsTable(headers, rows);
  }

  exportBadRecordsToTable(records: BadRecord[]): string {
    const headers = [
      '行号', '错误类型', '错误原因', '后续处理建议', 
      '是否允许继续', '人工备注', '原始预约编号', '患者姓名'
    ];

    const rows = records.map(record => [
      record.行号.toString(),
      record.错误类型,
      record.错误原因,
      record.后续处理建议,
      record.是否允许继续 ? '是' : '否',
      record.人工备注 || '-',
      record.原始数据.预约编号 || '-',
      record.原始数据.患者姓名 || '-'
    ]);

    return this.formatAsTable(headers, rows);
  }

  exportFullReport(result: ImportResult): string {
    const summary = `
========================================
      运动康复器械预约导入报告
========================================
导入批次号: ${result.导入批次号}
导入时间: ${new Date(result.导入时间).toLocaleString('zh-CN')}
总记录数: ${result.总记录数}
正常记录数: ${result.正常记录数}
异常记录数: ${result.异常记录数}
成功率: ${((result.正常记录数 / result.总记录数) * 100).toFixed(2)}%
========================================

【正常记录列表】
${this.exportNormalRecordsToTable(result.正常记录列表)}

【异常记录列表】
${this.exportBadRecordsToTable(result.异常记录列表)}
`;
    return summary;
  }

  private formatAsTable(headers: string[], rows: string[][]): string {
    if (rows.length === 0) {
      return '(无数据)\n';
    }

    const colWidths = headers.map((header, i) => {
      const maxDataWidth = Math.max(...rows.map(row => (row[i] || '').length));
      return Math.max(header.length, maxDataWidth, 8);
    });

    const separator = '+' + colWidths.map(w => '-'.repeat(w + 2)).join('+') + '+';
    
    const formatRow = (cells: string[]) => {
      return '| ' + cells.map((cell, i) => 
        (cell || '').padEnd(colWidths[i])
      ).join(' | ') + ' |';
    };

    const lines = [
      separator,
      formatRow(headers),
      separator,
      ...rows.map(row => formatRow(row)),
      separator
    ];

    return lines.join('\n') + '\n';
  }

  exportToCSV(result: ImportResult): { normalCSV: string; badCSV: string } {
    const normalHeaders = [
      '预约编号', '门店名称', '患者姓名', '患者手机号', '患者身份证号',
      '患者禁忌情况', '器械编号', '器械名称', '器械强度等级',
      '预约日期', '预约开始时间', '预约结束时间', '治疗师姓名',
      '预约状态', '预约备注', '创建时间', '更新时间'
    ];

    const normalRows = result.正常记录列表.map(record => 
      normalHeaders.map(h => this.escapeCSV(record[h as keyof EquipmentBooking]?.toString() || ''))
    );

    const badHeaders = [
      '行号', '错误类型', '错误原因', '后续处理建议',
      '是否允许继续', '人工备注', '原始预约编号', '原始患者姓名',
      '原始器械名称', '原始预约日期'
    ];

    const badRows = result.异常记录列表.map(record => [
      record.行号.toString(),
      record.错误类型,
      this.escapeCSV(record.错误原因),
      this.escapeCSV(record.后续处理建议),
      record.是否允许继续 ? '是' : '否',
      this.escapeCSV(record.人工备注 || ''),
      record.原始数据.预约编号 || '',
      record.原始数据.患者姓名 || '',
      record.原始数据.器械名称 || '',
      record.原始数据.预约日期 || ''
    ]);

    return {
      normalCSV: [normalHeaders.join(','), ...normalRows.map(r => r.join(','))].join('\n'),
      badCSV: [badHeaders.join(','), ...badRows.map(r => r.join(','))].join('\n')
    };
  }

  private escapeCSV(value: string): string {
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  }
}

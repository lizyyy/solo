import type { FinalRecord } from '../../shared/types';
import { dataStore } from '../data/store';
import * as XLSX from 'xlsx';

export class ExportService {
  getExportData(): FinalRecord[] {
    return dataStore.getFinalRecords();
  }

  generateExcelBuffer(): Buffer {
    const records = this.getExportData();
    
    const exportData = records.map(record => ({
      '位置': record.location,
      '数据来源': this.getSourceText(record.source),
      '处理状态': this.getStatusText(record.status),
      '有无障碍坡道': record.rampData?.hasRamp ? '是' : '否',
      '坡道状况': record.rampData?.rampCondition || '-',
      '采样点名称': record.samplingData?.samplingPoint || '-',
      '夜间服务': record.samplingData?.nightService ? '是' : '否',
      '居民意见原文': record.residentOpinionOriginal || '-',
      '居民意见汇总': record.residentOpinionSummary,
      '有意见原文': record.hasOpinionOriginal ? '是' : '否',
      '原始行号(坡道)': record.rampData?.originalRowNumber || '-',
      '原始行号(采样点)': record.samplingData?.originalRowNumber || '-',
      '最后修改人': record.modifiedBy,
      '最后修改时间': this.formatDate(record.lastModified),
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, '施工围挡绕行告示');

    const colWidths = [
      { wch: 20 },
      { wch: 12 },
      { wch: 12 },
      { wch: 12 },
      { wch: 15 },
      { wch: 20 },
      { wch: 10 },
      { wch: 40 },
      { wch: 25 },
      { wch: 12 },
      { wch: 15 },
      { wch: 18 },
      { wch: 12 },
      { wch: 20 },
    ];
    worksheet['!cols'] = colWidths;

    return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
  }

  private getSourceText(source: string): string {
    const map: Record<string, string> = {
      ramp: '无障碍坡道',
      sampling: '夜间采样点',
      merged: '合并数据',
    };
    return map[source] || source;
  }

  private getStatusText(status: string): string {
    const map: Record<string, string> = {
      normal: '正常',
      pending_review: '待复核',
      conflict: '冲突',
      archived: '已归档',
    };
    return map[status] || status;
  }

  private formatDate(isoString: string): string {
    const date = new Date(isoString);
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  }
}

export const exportService = new ExportService();

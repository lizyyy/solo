import { createObjectCsvWriter } from 'csv-writer';
import * as fs from 'fs';
import * as path from 'path';
import { PlaybackRecord, ExportOptions, FailureType } from '../types';
import { mockRecorderService } from './recorder';
import { auditStore } from '../store';

const EXPORT_DIR = path.join(process.cwd(), 'exports');

function ensureExportDir(): void {
  if (!fs.existsSync(EXPORT_DIR)) {
    fs.mkdirSync(EXPORT_DIR, { recursive: true });
  }
}

export class ExportService {
  exportFailedRecords(options: ExportOptions, operator: string): {
    filePath: string;
    recordCount: number;
    failureTypes: FailureType[];
  } {
    ensureExportDir();
    
    const { groupedByFailure } = mockRecorderService.getAllFailedRecords();
    
    let recordsToExport: PlaybackRecord[] = [];
    const failureTypes: FailureType[] = [];

    if (options.filterByFailureType) {
      if (groupedByFailure[options.filterByFailureType]) {
        recordsToExport = groupedByFailure[options.filterByFailureType];
        failureTypes.push(options.filterByFailureType);
      }
    } else {
      for (const [type, records] of Object.entries(groupedByFailure)) {
        recordsToExport.push(...records);
        failureTypes.push(type as FailureType);
      }
    }

    auditStore.add({
      recordHash: '',
      recordId: '',
      action: 'export',
      operator,
      details: `导出了 ${recordsToExport.length} 条失败记录，格式: ${options.format}`,
      needsConfirmation: false,
      confirmed: false
    });

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `failed-records-${timestamp}.${options.format}`;
    const filePath = path.join(EXPORT_DIR, fileName);

    if (options.format === 'json') {
      const exportData = recordsToExport.map(record => ({
        ...record.originalRecord,
        errors: record.errors,
        status: record.status
      }));
      fs.writeFileSync(filePath, JSON.stringify(exportData, null, 2), 'utf-8');
    } else {
      const csvRecords = recordsToExport.map(record => ({
        keyword: record.originalRecord.keyword,
        searchVolume: record.originalRecord.searchVolume,
        clickRate: record.originalRecord.clickRate,
        conversionRate: record.originalRecord.conversionRate,
        avgPosition: record.originalRecord.avgPosition,
        competition: record.originalRecord.competition,
        category: record.originalRecord.category,
        region: record.originalRecord.region,
        downloadUrl: record.originalRecord.downloadUrl,
        reportDate: record.originalRecord.reportDate,
        department: record.originalRecord.department,
        submittedBy: record.originalRecord.submittedBy,
        errorFields: record.errors?.map(e => e.field).join(', ') || '',
        errorMessages: record.errors?.map(e => `${e.field}: ${e.message}`).join('; ') || '',
        failureTypes: record.errors?.map(e => e.failureType).join(', ') || ''
      }));

      const csvWriter = createObjectCsvWriter({
        path: filePath,
        header: [
          { id: 'keyword', title: '搜索词' },
          { id: 'searchVolume', title: '搜索量' },
          { id: 'clickRate', title: '点击率(%)' },
          { id: 'conversionRate', title: '转化率(%)' },
          { id: 'avgPosition', title: '平均排名' },
          { id: 'competition', title: '竞争程度' },
          { id: 'category', title: '分类' },
          { id: 'region', title: '地区' },
          { id: 'downloadUrl', title: '下载链接' },
          { id: 'reportDate', title: '报告日期' },
          { id: 'department', title: '部门' },
          { id: 'submittedBy', title: '提交人' },
          { id: 'errorFields', title: '错误字段' },
          { id: 'errorMessages', title: '错误信息' },
          { id: 'failureTypes', title: '失败类型' }
        ]
      });

      csvWriter.writeRecords(csvRecords);
    }

    return {
      filePath,
      recordCount: recordsToExport.length,
      failureTypes
    };
  }

  getExportFiles(): string[] {
    ensureExportDir();
    return fs.readdirSync(EXPORT_DIR).map(file => path.join(EXPORT_DIR, file));
  }
}

export const exportService = new ExportService();

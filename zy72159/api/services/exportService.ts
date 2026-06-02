import { recordService } from './recordService';
import type { ExportData, ExportRecord, ExportFormat, RecordStatus } from '../../shared/types';

const STATUS_TEXT_MAP: Record<RecordStatus, string> = {
  pending: '待处理',
  processed: '已处理',
  verify: '待核实',
  onsite: '需要现场复看',
};

const SOURCE_TYPE_TEXT: Record<string, string> = {
  inspection: '巡查记录',
  complaint: '投诉记录',
  meeting: '会议纪要',
  old_caliber: '旧口径补入',
};

function mapToExportRecord(record: Parameters<typeof buildExportRecord>[0]): ExportRecord {
  return buildExportRecord(record);
}

function buildExportRecord(record: {
  id: string;
  stationName: string;
  exitNo: string;
  lat: number;
  lng: number;
  timeSlot: string;
  bikeCount: number;
  capacity: number;
  reason: string;
  status: RecordStatus;
  notes: string;
  sources: Array<{ id: string; type: string; name: string; date: string; importTime: string; rawContent: string }>;
  conflicts: Array<{ type: string; humanMessage: string }>;
  mergedFrom: string[];
  reviewTime?: string;
  createTime: string;
  updateTime: string;
  isOldCaliber: boolean;
}): ExportRecord {
  const sourceSummary = record.sources
    .map(s => `${SOURCE_TYPE_TEXT[s.type as keyof typeof SOURCE_TYPE_TEXT] || s.type}：${s.name}（${s.date}，导入于${new Date(s.importTime).toLocaleString('zh-CN')}）`)
    .join('；');

  const conflictSummary = record.conflicts.length > 0
    ? record.conflicts.map(c => c.humanMessage).join('；')
    : '无异常';

  const statusText = STATUS_TEXT_MAP[record.status];
  const oldCaliberNote = record.isOldCaliber ? '【旧口径补入】' : '';
  const mergedNote = record.mergedFrom.length > 0 ? `【合并自${record.mergedFrom.length}条记录】` : '';

  return {
    ...record,
    sources: record.sources as ExportRecord['sources'],
    conflicts: record.conflicts as ExportRecord['conflicts'],
    statusText: `${oldCaliberNote}${mergedNote}${statusText}`,
    sourceSummary,
    conflictSummary,
  };
}

export class ExportService {
  getExportData(): ExportData {
    const records = recordService.getAllRecords();
    const exportRecords = records.map(mapToExportRecord);

    return {
      processed: exportRecords.filter(r => r.status === 'processed'),
      verify: exportRecords.filter(r => r.status === 'verify'),
      onsite: exportRecords.filter(r => r.status === 'onsite'),
      exportTime: new Date().toISOString(),
      operator: '交通工程师何工',
    };
  }

  exportCSV(): string {
    const data = this.getExportData();
    const allRecords = [...data.processed, ...data.verify, ...data.onsite];

    const headers = [
      '分类',
      '状态',
      '站点名称',
      '出口',
      '时段',
      '单车数量',
      '设计容量',
      '疏导原因',
      '经度',
      '纬度',
      '来源追溯',
      '异常说明',
      '备注',
      '复核时间',
      '创建时间',
      '是否旧口径',
      'ID',
    ];

    const lines: string[] = [headers.join(',')];

    function addCategoryRecords(records: ExportRecord[], category: string) {
      for (const r of records) {
        const escape = (v: string) => `"${v.replace(/"/g, '""').replace(/\n/g, ' ')}"`;
        const line = [
          escape(category),
          escape(r.statusText),
          escape(r.stationName),
          escape(r.exitNo),
          escape(r.timeSlot),
          String(r.bikeCount),
          String(r.capacity),
          escape(r.reason),
          String(r.lng),
          String(r.lat),
          escape(r.sourceSummary),
          escape(r.conflictSummary),
          escape(r.notes),
          r.reviewTime ? escape(new Date(r.reviewTime).toLocaleString('zh-CN')) : '',
          escape(new Date(r.createTime).toLocaleString('zh-CN')),
          r.isOldCaliber ? '是' : '否',
          r.id,
        ];
        lines.push(line.join(','));
      }
    }

    addCategoryRecords(data.processed, '已处理');
    addCategoryRecords(data.verify, '待核实');
    addCategoryRecords(data.onsite, '需要现场复看');

    const bom = '\uFEFF';
    return bom + lines.join('\n');
  }

  exportJSON(): string {
    const data = this.getExportData();

    const result = {
      title: '轨道站口共享单车疏导公示清单',
      exportTime: new Date(data.exportTime).toLocaleString('zh-CN'),
      operator: data.operator,
      statistics: {
        processed: data.processed.length,
        verify: data.verify.length,
        onsite: data.onsite.length,
        total: data.processed.length + data.verify.length + data.onsite.length,
      },
      categories: {
        processed: {
          name: '已处理',
          description: '疏导方案已确认并执行完成的站点',
          records: data.processed,
        },
        verify: {
          name: '待核实',
          description: '存在数据冲突或异常，需要进一步核实的站点',
          records: data.verify,
        },
        onsite: {
          name: '需要现场复看',
          description: '坐标存疑或旧口径数据，需要现场确认的站点',
          records: data.onsite,
        },
      },
    };

    return JSON.stringify(result, null, 2);
  }

  download(format: ExportFormat): { content: string; filename: string; mimeType: string } {
    const dateStr = new Date().toISOString().split('T')[0];

    if (format === 'csv') {
      return {
        content: this.exportCSV(),
        filename: `轨道站口共享单车疏导清单_${dateStr}.csv`,
        mimeType: 'text/csv; charset=utf-8',
      };
    } else {
      return {
        content: this.exportJSON(),
        filename: `轨道站口共享单车疏导清单_${dateStr}.json`,
        mimeType: 'application/json; charset=utf-8',
      };
    }
  }
}

export const exportService = new ExportService();

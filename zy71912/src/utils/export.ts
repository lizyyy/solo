import type {
  TimelineRecord,
  Anomaly,
  Correction,
  ExportItem,
  ExportManifest,
  RecordStatus,
} from '@/types';
import { generateId } from './time';

const HANDLING_NOTES: Record<RecordStatus, string> = {
  confirmed: '【已确认】素材完整、时间准确、审核通过，可直接上线',
  pending: '【待补】存在未解决问题，需补充素材或确认信息后再上线',
  manual: '【人工更正】经过人工修改，记录了原值和新值的变更轨迹，已复核',
};

function getHandlingNote(status: RecordStatus, unresolvedAnomalies: Anomaly[]): string {
  const base = HANDLING_NOTES[status];
  if (unresolvedAnomalies.length > 0) {
    const anomalyTypes = [...new Set(unresolvedAnomalies.map(a => a.type))].join('、');
    return `${base}；未解决异常：${anomalyTypes}`;
  }
  return base;
}

function groupByStatus(records: TimelineRecord[]): {
  confirmed: TimelineRecord[];
  pending: TimelineRecord[];
  manual: TimelineRecord[];
} {
  return {
    confirmed: records.filter(r => r.status === 'confirmed'),
    pending: records.filter(r => r.status === 'pending'),
    manual: records.filter(r => r.status === 'manual'),
  };
}

function toExportItem(
  record: TimelineRecord,
  allAnomalies: Anomaly[],
  allCorrections: Correction[]
): ExportItem {
  const recordAnomalies = allAnomalies.filter(a => a.recordId === record.id);
  const recordCorrections = allCorrections.filter(c => c.recordId === record.id);
  const unresolvedAnomalies = recordAnomalies.filter(a => !a.resolved);

  return {
    record,
    anomalies: recordAnomalies,
    corrections: recordCorrections,
    handlingNote: getHandlingNote(record.status, unresolvedAnomalies),
  };
}

export function buildExportManifest(
  records: TimelineRecord[],
  anomalies: Anomaly[],
  corrections: Correction[],
  operator: string = '系统'
): ExportManifest {
  const grouped = groupByStatus(records);
  const unresolvedCount = anomalies.filter(a => !a.resolved).length;
  const totalDuration = records.reduce((sum, r) => sum + r.duration, 0);

  return {
    exportTime: new Date().toISOString(),
    operator,
    confirmed: grouped.confirmed.map(r => toExportItem(r, anomalies, corrections)),
    pending: grouped.pending.map(r => toExportItem(r, anomalies, corrections)),
    manual: grouped.manual.map(r => toExportItem(r, anomalies, corrections)),
    summary: {
      total: records.length,
      confirmedCount: grouped.confirmed.length,
      pendingCount: grouped.pending.length,
      manualCount: grouped.manual.length,
      unresolvedAnomalies: unresolvedCount,
      totalDuration,
    },
  };
}

export function exportToJSON(manifest: ExportManifest): string {
  return JSON.stringify(manifest, null, 2);
}

export function exportToCSV(manifest: ExportManifest): string {
  const headers = [
    '分类',
    'ID',
    '类型',
    '开始时间',
    '时长(秒)',
    '标题',
    '状态',
    '处理口径',
    '异常数',
    '更正次数',
    '创建时间',
  ];

  const rows: string[][] = [];

  const pushRows = (items: ExportItem[], category: string) => {
    items.forEach(item => {
      rows.push([
        category,
        item.record.id,
        item.record.type,
        item.record.startTime.toString(),
        item.record.duration.toString(),
        `"${item.record.title.replace(/"/g, '""')}"`,
        item.record.status,
        `"${item.handlingNote.replace(/"/g, '""')}"`,
        item.anomalies.length.toString(),
        item.corrections.length.toString(),
        item.record.createdAt,
      ]);
    });
  };

  pushRows(manifest.confirmed, '已确认');
  pushRows(manifest.pending, '待补');
  pushRows(manifest.manual, '人工更正');

  const summaryRow = [
    '汇总',
    '',
    '',
    '',
    manifest.summary.totalDuration.toString(),
    `共${manifest.summary.total}条`,
    '',
    `未解决异常:${manifest.summary.unresolvedAnomalies}`,
    '',
    '',
    '',
  ];

  return [headers.join(','), ...rows.map(r => r.join(',')), summaryRow.join(',')].join('\n');
}

export function validateBeforeExport(
  records: TimelineRecord[],
  anomalies: Anomaly[]
): {
  valid: boolean;
  issues: string[];
} {
  const issues: string[] = [];
  const unresolvedAnomalies = anomalies.filter(a => !a.resolved);

  if (unresolvedAnomalies.length > 0) {
    issues.push(`存在 ${unresolvedAnomalies.length} 条未解决的异常记录`);
  }

  const pendingRecords = records.filter(r => r.status === 'pending');
  if (pendingRecords.length > 0) {
    issues.push(`存在 ${pendingRecords.length} 条待补记录，上线前请确认是否排除`);
  }

  const zeroDuration = records.filter(r => r.duration <= 0);
  if (zeroDuration.length > 0) {
    issues.push(`${zeroDuration.length} 条记录时长为0或负数`);
  }

  const missingTitles = records.filter(r => !r.title || r.title.trim() === '');
  if (missingTitles.length > 0) {
    issues.push(`${missingTitles.length} 条记录标题为空`);
  }

  return {
    valid: issues.length === 0,
    issues,
  };
}

export function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function generateExportFilename(format: 'json' | 'csv'): string {
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
  const timeStr = now.toTimeString().slice(0, 5).replace(/:/g, '');
  return `播客上线清单_${dateStr}_${timeStr}.${format}`;
}

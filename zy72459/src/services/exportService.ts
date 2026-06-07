import * as XLSX from 'xlsx';
import { InspectionRecord, ExportData } from '@/types';
import { getStatusText, getConflictTypeText } from '@/utils/helpers';
import dayjs from 'dayjs';

export function exportToExcel(records: InspectionRecord[], operator: string): void {
  const exportData: ExportData = {
    records,
    exportTime: dayjs().toISOString(),
    operator,
    checksum: generateExportChecksum(records)
  };

  const worksheetData = records.map(record => ({
    '点位编号': record.pointCode,
    '位置': record.location,
    '当前评分': record.score,
    '原始评分': record.originalScore,
    '状态': getStatusText(record.status),
    '有无坡道补录': record.rampSupplementTime ? '是' : '否',
    '坡道补录后评分未变': record.rampScoreUnchanged ? '是' : '否',
    '关联投诉数': record.complaints.length,
    '待处理冲突数': record.conflictEvidence.filter(c => !c.resolved).length,
    '冲突类型': record.conflictEvidence.map(c => getConflictTypeText(c.type)).join('; '),
    '整改建议': record.rectificationSuggestion,
    '创建时间': dayjs(record.createTime).format('YYYY-MM-DD HH:mm:ss'),
    '更新时间': dayjs(record.updateTime).format('YYYY-MM-DD HH:mm:ss')
  }));

  const worksheet = XLSX.utils.json_to_sheet(worksheetData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, '照明暗区排查明细');

  const fileName = `街角照明暗区排查_${dayjs().format('YYYYMMDD_HHmmss')}.xlsx`;
  XLSX.writeFile(workbook, fileName);
}

function generateExportChecksum(records: InspectionRecord[]): string {
  const data = JSON.stringify(records.map(r => ({
    pointCode: r.pointCode,
    score: r.score,
    rampScoreUnchanged: r.rampScoreUnchanged,
    status: r.status,
    conflictCount: r.conflictEvidence.length
  })));
  
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    const char = data.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16);
}

export function validateExportConsistency(
  displayRecords: InspectionRecord[],
  exportRecords: InspectionRecord[]
): boolean {
  const displayChecksum = generateExportChecksum(displayRecords);
  const exportChecksum = generateExportChecksum(exportRecords);
  return displayChecksum === exportChecksum;
}

import type { InspectionRecord, ExportRecord } from '../../../shared/types';
import { formatDateTime, getStatusLabel } from './format';

export function generateMockExportContent(exportId: string, storeState: any): string {
  const exportRecord = storeState.exportRecords.find((r: ExportRecord) => r.id === exportId);
  if (!exportRecord) return '';

  const inspections = exportRecord.inspectionIds
    .map((id: string) => storeState.inspections.find((i: InspectionRecord) => i.id === id))
    .filter(Boolean) as InspectionRecord[];

  const lines: string[] = [];
  lines.push('=== 停车楼坡道巡检单（标准模板）===');
  lines.push(`导出时间：${formatDateTime(exportRecord.exportedAt)}`);
  lines.push(`导出人：${exportRecord.exportedBy}`);
  lines.push(`文件哈希：${exportRecord.fileHash}`);
  lines.push('');
  lines.push('----------------------------------------');
  lines.push('');

  inspections.forEach((inspection, idx) => {
    lines.push(`${idx + 1}. ${inspection.name}`);
    lines.push(`   坡道编号：${inspection.rampNumber}`);
    lines.push(`   状态：${getStatusLabel(inspection.status)}`);
    lines.push(`   点位数：${inspection.coordinates.points.length}`);
    lines.push(`   变更次数：${inspection.changeHistory.length}`);
    lines.push(`   创建时间：${formatDateTime(inspection.createdAt)}`);
    lines.push('');
  });

  if (exportRecord.consistencyCheck.issues.length > 0) {
    lines.push('----------------------------------------');
    lines.push('一致性校验问题：');
    exportRecord.consistencyCheck.issues.forEach((issue) => {
      lines.push(`  [${issue.severity === 'error' ? '错误' : '警告'}] ${issue.message}`);
    });
  }

  return lines.join('\n');
}

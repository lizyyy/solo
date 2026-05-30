import jsPDF from 'jspdf';
import * as XLSX from 'xlsx';
import type {
  BandRequirement,
  FilterCriteria,
  ExportMetadata,
  ExportRecord
} from '@/types';
import {
  generateId,
  generateDataHash,
  formatDateForDisplay,
  getChannelTypeLabel,
  getMonitorPositionLabel,
  getStatusLabel,
  getConflictTypeLabel
} from './helpers';

export function generateExportMetadata(
  filters: FilterCriteria,
  recordCount: number
): ExportMetadata {
  return {
    exportVersion: '1.0.0',
    exportedAt: new Date().toISOString(),
    filterCriteria: filters,
    recordCount,
    dataHash: generateDataHash(filters, recordCount),
    reproducibilityNote: '使用相同筛选条件可复现此报告'
  };
}

export async function exportToJSON(
  requirements: BandRequirement[],
  filters: FilterCriteria
): Promise<{ blob: Blob; record: ExportRecord }> {
  const metadata = generateExportMetadata(filters, requirements.length);
  const exportData = {
    metadata,
    data: requirements
  };

  const jsonStr = JSON.stringify(exportData, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });

  const record: ExportRecord = {
    id: generateId(),
    filterCriteria: filters,
    format: 'json',
    fileHash: metadata.dataHash,
    recordCount: requirements.length,
    createdAt: new Date().toISOString()
  };

  return { blob, record };
}

export async function exportToExcel(
  requirements: BandRequirement[],
  filters: FilterCriteria
): Promise<{ blob: Blob; record: ExportRecord }> {
  const metadata = generateExportMetadata(filters, requirements.length);

  const wb = XLSX.utils.book_new();

  const summaryData = requirements.map((req) => ({
    乐队名称: req.bandName,
    演出日期: formatDateForDisplay(req.performanceDate),
    开始时间: req.startTime,
    结束时间: req.endTime,
    换场时间: `${req.changeOverTime}分钟`,
    通道数: req.channels.length,
    返听数: req.monitors.length,
    状态: getStatusLabel(req.status),
    冲突数: req.conflicts.filter((c) => !c.resolved).length,
    当前版本: `v${req.currentVersion}`
  }));

  const summaryWs = XLSX.utils.json_to_sheet(summaryData);
  XLSX.utils.book_append_sheet(wb, summaryWs, '需求清单');

  const channelData: Record<string, unknown>[] = [];
  requirements.forEach((req) => {
    req.channels.forEach((ch) => {
      channelData.push({
        乐队名称: req.bandName,
        通道名称: ch.name,
        通道类型: getChannelTypeLabel(ch.type),
        分配给: ch.assignedTo,
        排序: ch.order,
        备注: ch.notes || ''
      });
    });
  });

  if (channelData.length > 0) {
    const channelWs = XLSX.utils.json_to_sheet(channelData);
    XLSX.utils.book_append_sheet(wb, channelWs, '通道明细');
  }

  const conflictData: Record<string, unknown>[] = [];
  requirements.forEach((req) => {
    req.conflicts.forEach((c) => {
      conflictData.push({
        乐队名称: req.bandName,
        冲突类型: getConflictTypeLabel(c.type),
        严重程度: c.severity === 'error' ? '错误' : '警告',
        描述: c.description,
        是否已解决: c.resolved ? '是' : '否'
      });
    });
  });

  if (conflictData.length > 0) {
    const conflictWs = XLSX.utils.json_to_sheet(conflictData);
    XLSX.utils.book_append_sheet(wb, conflictWs, '冲突列表');
  }

  const metadataData = [
    { 项目: '导出版本', 值: metadata.exportVersion },
    { 项目: '导出时间', 值: new Date(metadata.exportedAt).toLocaleString('zh-CN') },
    { 项目: '记录数量', 值: metadata.recordCount },
    { 项目: '数据哈希', 值: metadata.dataHash },
    { 项目: '可复现说明', 值: metadata.reproducibilityNote },
    {
      项目: '筛选条件',
      值: JSON.stringify(metadata.filterCriteria)
    }
  ];
  const metadataWs = XLSX.utils.json_to_sheet(metadataData);
  XLSX.utils.book_append_sheet(wb, metadataWs, '导出参数');

  const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([excelBuffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  });

  const record: ExportRecord = {
    id: generateId(),
    filterCriteria: filters,
    format: 'excel',
    fileHash: metadata.dataHash,
    recordCount: requirements.length,
    createdAt: new Date().toISOString()
  };

  return { blob, record };
}

export async function exportToPDF(
  requirements: BandRequirement[],
  filters: FilterCriteria
): Promise<{ blob: Blob; record: ExportRecord }> {
  const metadata = generateExportMetadata(filters, requirements.length);
  const doc = new jsPDF();

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  let yPos = 20;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text('音乐节舞台监听需求清单', pageWidth / 2, yPos, { align: 'center' });
  yPos += 10;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`导出时间: ${new Date().toLocaleString('zh-CN')}`, 14, yPos);
  yPos += 7;
  doc.text(`数据哈希: ${metadata.dataHash}`, 14, yPos);
  yPos += 7;
  doc.text(`记录数量: ${requirements.length}`, 14, yPos);
  yPos += 10;

  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('筛选条件参数快照', 14, yPos);
  yPos += 7;
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  const filterStr = JSON.stringify(filters, null, 2);
  const filterLines = doc.splitTextToSize(filterStr, pageWidth - 28);
  doc.text(filterLines, 14, yPos);
  yPos += filterLines.length * 5 + 8;

  if (yPos > pageHeight - 30) {
    doc.addPage();
    yPos = 20;
  }

  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('需求清单', 14, yPos);
  yPos += 8;

  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  const headers = ['乐队', '日期', '时间', '通道', '返听', '换场', '状态', '冲突'];
  const colWidths = [35, 25, 25, 15, 15, 15, 18, 18];
  let xPos = 14;
  headers.forEach((header, i) => {
    doc.text(header, xPos, yPos);
    xPos += colWidths[i];
  });
  yPos += 6;

  doc.setFont('helvetica', 'normal');
  requirements.forEach((req) => {
    if (yPos > pageHeight - 30) {
      doc.addPage();
      yPos = 20;
    }

    let x = 14;
    doc.text(req.bandName.substring(0, 12), x, yPos);
    x += colWidths[0];
    doc.text(formatDateForDisplay(req.performanceDate), x, yPos);
    x += colWidths[1];
    doc.text(`${req.startTime}-${req.endTime}`, x, yPos);
    x += colWidths[2];
    doc.text(String(req.channels.length), x, yPos);
    x += colWidths[3];
    doc.text(String(req.monitors.length), x, yPos);
    x += colWidths[4];
    doc.text(`${req.changeOverTime}m`, x, yPos);
    x += colWidths[5];
    doc.text(getStatusLabel(req.status), x, yPos);
    x += colWidths[6];
    const unresolvedConflicts = req.conflicts.filter((c) => !c.resolved).length;
    doc.text(unresolvedConflicts > 0 ? String(unresolvedConflicts) : '-', x, yPos);

    yPos += 5;
  });

  if (yPos > pageHeight - 30) {
    doc.addPage();
    yPos = 20;
  }

  yPos += 5;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'italic');
  doc.text(metadata.reproducibilityNote, 14, yPos);
  doc.text(
    `使用相同筛选条件和系统版本 ${metadata.exportVersion} 可复现此报告`,
    14,
    yPos + 5
  );

  const blob = doc.output('blob');

  const record: ExportRecord = {
    id: generateId(),
    filterCriteria: filters,
    format: 'pdf',
    fileHash: metadata.dataHash,
    recordCount: requirements.length,
    createdAt: new Date().toISOString()
  };

  return { blob, record };
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function generateExportFilename(
  format: 'pdf' | 'excel' | 'json',
  filters: FilterCriteria
): string {
  const dateStr = new Date().toISOString().split('T')[0];
  const extension = format === 'excel' ? 'xlsx' : format;
  const filterPrefix =
    filters.dateFrom || filters.dateTo
      ? `${filters.dateFrom || 'all'}_to_${filters.dateTo || 'all'}`
      : 'all';
  return `stage_monitor_report_${filterPrefix}_${dateStr}.${extension}`;
}

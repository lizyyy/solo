import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import type { BattleRecord, ExportFormat, FilterConditions, ExportSnapshot } from '@/types';
import { checkConsistency, generateConsistencyReport } from './consistency';
import { generateDataFingerprint } from './fingerprint';

export interface ExportOptions {
  format: ExportFormat;
  includeConsistencyReport: boolean;
  remark: string;
  operator: string;
  versionId: string;
  filterConditions: FilterConditions;
  filterFingerprint: string;
}

export function exportToCSV(records: BattleRecord[]): string {
  const headers = ['ID', '战报ID', '玩家ID', '玩家名称', '分数', '结算', '状态', '战斗时间', '数据指纹'];
  const rows = records.map(r => [
    r.id,
    r.battleId,
    r.playerId,
    r.playerName,
    r.score.toString(),
    r.settlement.toString(),
    r.status,
    r.battleTime,
    r.dataFingerprint
  ]);
  
  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
  ].join('\n');
  
  return '\uFEFF' + csvContent;
}

export function exportToExcel(records: BattleRecord[], consistencyReport?: string): Blob {
  const wb = XLSX.utils.book_new();
  
  const data = records.map(r => ({
    'ID': r.id,
    '战报ID': r.battleId,
    '玩家ID': r.playerId,
    '玩家名称': r.playerName,
    '分数': r.score,
    '结算': r.settlement,
    '状态': r.status,
    '战斗时间': r.battleTime,
    '数据指纹': r.dataFingerprint
  }));
  
  const ws = XLSX.utils.json_to_sheet(data);
  XLSX.utils.book_append_sheet(wb, ws, '战报数据');
  
  if (consistencyReport) {
    const reportData = consistencyReport.split('\n').map(line => ({ '内容': line }));
    const reportWs = XLSX.utils.json_to_sheet(reportData);
    XLSX.utils.book_append_sheet(wb, reportWs, '一致性校验报告');
  }
  
  const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  return new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

export function exportToPDF(records: BattleRecord[], consistencyReport?: string): Blob {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4'
  });
  
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('城市电网博弈 - 战报数据导出', 14, 15);
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`导出时间: ${new Date().toLocaleString()}`, 14, 22);
  doc.text(`记录总数: ${records.length}`, 14, 28);
  
  const startY = 35;
  const rowHeight = 7;
  const colWidths = [35, 30, 40, 25, 25, 20, 35, 30];
  const headers = ['战报ID', '玩家ID', '玩家名称', '分数', '结算', '状态', '战斗时间', '数据指纹'];
  
  doc.setFillColor(240, 240, 240);
  doc.rect(14, startY - 5, 240, rowHeight, 'F');
  
  doc.setFont('helvetica', 'bold');
  let xPos = 14;
  headers.forEach((header, i) => {
    doc.text(header, xPos + 2, startY);
    xPos += colWidths[i];
  });
  
  doc.setFont('helvetica', 'normal');
  records.slice(0, 30).forEach((record, idx) => {
    const y = startY + (idx + 1) * rowHeight;
    
    if (idx % 2 === 0) {
      doc.setFillColor(250, 250, 250);
      doc.rect(14, y - 5, 240, rowHeight, 'F');
    }
    
    xPos = 14;
    const values = [
      record.battleId,
      record.playerId,
      record.playerName,
      record.score.toString(),
      record.settlement.toString(),
      record.status,
      record.battleTime,
      record.dataFingerprint.substring(0, 12)
    ];
    
    values.forEach((value, i) => {
      doc.text(value.substring(0, Math.floor(colWidths[i] / 2)), xPos + 2, y);
      xPos += colWidths[i];
    });
  });
  
  if (records.length > 30) {
    doc.text(`... 还有 ${records.length - 30} 条记录，详见CSV/Excel版本`, 14, startY + 32 * rowHeight);
  }
  
  if (consistencyReport) {
    doc.addPage();
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text('一致性校验报告', 14, 15);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    
    const lines = consistencyReport.split('\n');
    lines.forEach((line, idx) => {
      doc.text(line, 14, 25 + idx * 6);
    });
  }
  
  return new Blob([doc.output('blob')], { type: 'application/pdf' });
}

export async function exportData(
  screenData: BattleRecord[],
  exportData: BattleRecord[],
  options: ExportOptions
): Promise<{ snapshot: ExportSnapshot; blob: Blob; fileName: string }> {
  const { format, includeConsistencyReport, remark, operator, versionId, filterConditions, filterFingerprint } = options;
  
  const checkResult = checkConsistency(screenData, exportData, filterFingerprint, filterConditions);
  
  if (!checkResult.passed) {
    throw new Error(`一致性校验未通过:\n${generateConsistencyReport(checkResult)}`);
  }
  
  const consistencyReport = includeConsistencyReport ? generateConsistencyReport(checkResult) : undefined;
  
  let blob: Blob;
  let fileName: string;
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
  
  switch (format) {
    case 'csv':
      let csvContent = exportToCSV(exportData);
      if (consistencyReport) {
        csvContent += '\n\n' + consistencyReport.split('\n').map(l => `# ${l}`).join('\n');
      }
      blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      fileName = `战报数据_${timestamp}.csv`;
      break;
    case 'xlsx':
      blob = exportToExcel(exportData, consistencyReport);
      fileName = `战报数据_${timestamp}.xlsx`;
      break;
    case 'pdf':
      blob = exportToPDF(exportData, consistencyReport);
      fileName = `战报数据_${timestamp}.pdf`;
      break;
  }
  
  const snapshot: ExportSnapshot = {
    id: crypto.randomUUID(),
    versionId,
    filterFingerprint,
    filterConditions: JSON.parse(JSON.stringify(filterConditions)),
    format,
    dataFingerprint: generateDataFingerprint(exportData),
    screenDataFingerprint: generateDataFingerprint(screenData),
    consistencyCheckPassed: checkResult.passed,
    consistencyCheckDetails: checkResult.details,
    fileName,
    operator,
    remark,
    exportedAt: new Date().toISOString()
  };
  
  return { snapshot, blob, fileName };
}

export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

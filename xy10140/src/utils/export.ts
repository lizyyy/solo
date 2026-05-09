import JSZip from 'jszip';
import { ExportReport, TableRow } from '../types';

export async function exportAsJSON(report: ExportReport): Promise<void> {
  const json = JSON.stringify(report, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  downloadBlob(blob, `report_${report.commandId}.json`);
}

export async function exportAsCSV(rows: TableRow[], filename: string): Promise<void> {
  if (rows.length === 0) {
    throw new Error('没有数据可导出');
  }

  const headers = Object.keys(rows[0]);
  const csvLines: string[] = [];
  
  csvLines.push(headers.map(h => escapeCSV(h)).join(','));
  
  for (const row of rows) {
    csvLines.push(headers.map(h => escapeCSV(String(row[h] ?? ''))).join(','));
  }

  const csv = '\uFEFF' + csvLines.join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  downloadBlob(blob, `${filename}.csv`);
}

export async function exportAsZip(report: ExportReport, rows: TableRow[]): Promise<void> {
  const zip = new JSZip();
  
  zip.file('report.json', JSON.stringify(report, null, 2));
  
  if (rows.length > 0) {
    const headers = Object.keys(rows[0]);
    const csvLines: string[] = [];
    csvLines.push(headers.map(h => escapeCSV(h)).join(','));
    for (const row of rows) {
      csvLines.push(headers.map(h => escapeCSV(String(row[h] ?? ''))).join(','));
    }
    zip.file('data.csv', '\uFEFF' + csvLines.join('\n'));
  }
  
  zip.file('README.txt', `表格筛选状态回放报告
====================

命令 ID: ${report.commandId}
命令名称: ${report.commandName}
执行时间: ${new Date(report.executedAt).toISOString()}
成功: ${report.result.success ? '是' : '否'}
匹配行数: ${report.result.matchedRows}
版本: ${report.metadata.version}
生成时间: ${new Date(report.metadata.generatedAt).toISOString()}

错误信息:
${report.result.errors.length > 0 ? report.result.errors.map((e, i) => `${i + 1}. ${e}`).join('\n') : '无'}
`);

  const content = await zip.generateAsync({ type: 'blob' });
  downloadBlob(content, `report_${report.commandId}.zip`);
}

function escapeCSV(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function createReport(
  commandId: string,
  commandName: string,
  executedAt: number,
  originalState: ExportReport['originalState'],
  result: ExportReport['result'],
  filteredData: TableRow[]
): ExportReport {
  return {
    commandId,
    commandName,
    executedAt,
    originalState: { ...originalState },
    result: { ...result },
    filteredData: filteredData.map(r => ({ ...r })),
    metadata: {
      version: '1.0.0',
      generatedAt: Date.now(),
    },
  };
}

import * as XLSX from 'xlsx';
import Papa from 'papaparse';
import type { ContractClause } from '@/types';

export function parseCSVFile(file: File): Promise<Partial<ContractClause>[]> {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const rows = results.data as Record<string, string>[];
        const clauses = rows.map((row, i) => ({
          clauseNumber: row['条款编号'] || row['clauseNumber'] || `IMP-${String(i + 1).padStart(3, '0')}`,
          content: row['条款内容'] || row['content'] || '',
          source: row['来源'] || row['source'] || '',
          sourceLink: row['来源链接'] || row['sourceLink'] || '',
        }));
        resolve(clauses);
      },
      error: (error) => reject(error),
    });
  });
}

export function parseExcelFile(file: File): Promise<Partial<ContractClause>[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json<Record<string, string>>(worksheet);
        const clauses = rows.map((row, i) => ({
          clauseNumber: row['条款编号'] || row['clauseNumber'] || `IMP-${String(i + 1).padStart(3, '0')}`,
          content: row['条款内容'] || row['content'] || '',
          source: row['来源'] || row['source'] || '',
          sourceLink: row['来源链接'] || row['sourceLink'] || '',
        }));
        resolve(clauses);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error('文件读取失败'));
    reader.readAsArrayBuffer(file);
  });
}

export function exportToCSV(records: Record<string, unknown>[], filename: string) {
  const csv = Papa.unparse(records);
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  downloadBlob(blob, filename + '.csv');
}

export function exportToExcel(records: Record<string, unknown>[], filename: string) {
  const worksheet = XLSX.utils.json_to_sheet(records);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, '合同条款问答');
  XLSX.writeFile(workbook, filename + '.xlsx');
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function formatDate(dateStr: string): string {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  return d.toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' });
}

export function formatDateTime(dateStr: string): string {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  return d.toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}

export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

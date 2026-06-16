import * as XLSX from 'xlsx';
import { ImportData, SourceType } from '@/types';
import { mapGenericRowToImportData, GenericRow } from '@/utils/csvParser';

export function parseExcelToImportData(
  arrayBuffer: ArrayBuffer,
  sourceType: SourceType,
  sourceName: string
): ImportData[] {
  const workbook = XLSX.read(arrayBuffer, { type: 'array' });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return [];

  const worksheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(worksheet, {
    header: 1,
    defval: '',
    raw: false,
  }) as unknown[][];

  if (rows.length < 2) return [];

  const headers = rows[0].map(h => (h ?? '').toString().trim());
  const result: ImportData[] = [];

  for (let i = 1; i < rows.length; i++) {
    const values = rows[i];
    const row: GenericRow = {};
    headers.forEach((header, idx) => {
      if (header) {
        row[header] = (values[idx] ?? '').toString().trim();
      }
    });
    const mapped = mapGenericRowToImportData(row, sourceType, sourceName);
    if (mapped) result.push(mapped);
  }

  return result;
}

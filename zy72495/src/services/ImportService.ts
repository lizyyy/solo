import * as XLSX from 'xlsx';
import Papa from 'papaparse';
import type { BusTimeSlot } from '@/types';
import { showToast, getErrorMessage } from '@/utils/errorMessageUtils';

export interface ImportResult {
  success: boolean;
  data: BusTimeSlot[];
  duplicateCount: number;
  newCount: number;
  errors: string[];
}

function generateId(): string {
  return 'bt' + Date.now() + Math.random().toString(36).substr(2, 9);
}

function generateBatchId(): string {
  return 'batch-' + Date.now();
}

function isDuplicate(
  slot: Partial<BusTimeSlot>,
  existingSlots: BusTimeSlot[]
): boolean {
  return existingSlots.some(
    (s) =>
      s.routeName === slot.routeName &&
      s.date === slot.date &&
      s.startTime === slot.startTime &&
      s.endTime === slot.endTime
  );
}

function validateRow(row: Record<string, unknown>, index: number): string[] {
  const errors: string[] = [];
  const requiredFields = ['routeName', 'date', 'startTime', 'endTime'];

  for (const field of requiredFields) {
    if (!row[field]) {
      errors.push(getErrorMessage('import/missing-required', { field }));
    }
  }

  if (row.date && typeof row.date === 'string') {
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(row.date)) {
      errors.push(`第${index + 1}行：` + getErrorMessage('validation/invalid-date'));
    }
  }

  const timeRegex = /^\d{2}:\d{2}$/;
  if (row.startTime && typeof row.startTime === 'string') {
    if (!timeRegex.test(row.startTime)) {
      errors.push(`第${index + 1}行：` + getErrorMessage('validation/invalid-time'));
    }
  }
  if (row.endTime && typeof row.endTime === 'string') {
    if (!timeRegex.test(row.endTime)) {
      errors.push(`第${index + 1}行：` + getErrorMessage('validation/invalid-time'));
    }
  }

  return errors;
}

export async function importFromFile(
  file: File,
  existingSlots: BusTimeSlot[]
): Promise<ImportResult> {
  const result: ImportResult = {
    success: false,
    data: [],
    duplicateCount: 0,
    newCount: 0,
    errors: [],
  };

  try {
    const extension = file.name.split('.').pop()?.toLowerCase();
    let rows: Record<string, unknown>[] = [];

    if (extension === 'xlsx' || extension === 'xls') {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer);
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      rows = XLSX.utils.sheet_to_json(sheet) as Record<string, unknown>[];
    } else if (extension === 'csv') {
      const text = await file.text();
      const parseResult = Papa.parse(text, { header: true });
      rows = parseResult.data as Record<string, unknown>[];
    } else {
      result.errors.push(getErrorMessage('import/file-type'));
      return result;
    }

    if (rows.length === 0) {
      result.errors.push(getErrorMessage('import/empty-file'));
      return result;
    }

    const batchId = generateBatchId();
    const now = new Date().toISOString();
    let duplicateCount = 0;
    let newCount = 0;

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const validationErrors = validateRow(row, i);
      if (validationErrors.length > 0) {
        result.errors.push(...validationErrors);
        continue;
      }

      const slot: Partial<BusTimeSlot> = {
        routeName: String(row.routeName || ''),
        date: String(row.date || ''),
        startTime: String(row.startTime || ''),
        endTime: String(row.endTime || ''),
        passengerCount: Number(row.passengerCount) || 0,
        relatedPointIds: [],
        importBatchId: batchId,
        createdAt: now,
        updatedAt: now,
      };

      if (isDuplicate(slot, existingSlots)) {
        duplicateCount++;
      } else {
        slot.id = generateId();
        result.data.push(slot as BusTimeSlot);
        newCount++;
      }
    }

    result.success = result.errors.length === 0 || newCount > 0;
    result.duplicateCount = duplicateCount;
    result.newCount = newCount;

    if (duplicateCount > 0) {
      showToast(
        `导入完成：新增${newCount}条，跳过${duplicateCount}条重复数据`,
        'warning'
      );
    } else if (newCount > 0) {
      showToast(`成功导入${newCount}条数据`, 'success');
    }
  } catch (error) {
    result.errors.push(getErrorMessage('import/invalid-format'));
    showToast(getErrorMessage('import/invalid-format'), 'error');
  }

  return result;
}

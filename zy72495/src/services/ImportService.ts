import * as XLSX from 'xlsx';
import Papa from 'papaparse';
import type { BusTimeSlot } from '@/types';
import { showToast, getErrorMessage } from '@/utils/errorMessageUtils';

export interface DuplicateSlotInfo {
  slot: BusTimeSlot;
  existingSlot: BusTimeSlot;
  changedFields: string[];
}

export interface ImportResult {
  success: boolean;
  data: BusTimeSlot[];
  duplicateCount: number;
  newCount: number;
  updateCount: number;
  duplicates: DuplicateSlotInfo[];
  errors: string[];
}

function generateId(): string {
  return 'bt' + Date.now() + Math.random().toString(36).substr(2, 9);
}

function generateBatchId(): string {
  return 'batch-' + Date.now();
}

function findExisting(
  slot: Partial<BusTimeSlot>,
  existingSlots: BusTimeSlot[]
): BusTimeSlot | undefined {
  return existingSlots.find(
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
    updateCount: 0,
    duplicates: [],
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
    let updateCount = 0;

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const validationErrors = validateRow(row, i);
      if (validationErrors.length > 0) {
        result.errors.push(...validationErrors);
        continue;
      }

      const slot: BusTimeSlot = {
        id: generateId(),
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

      const existing = findExisting(slot, existingSlots);
      if (existing) {
        duplicateCount++;
        const changedFields: string[] = [];
        if (existing.passengerCount !== slot.passengerCount) {
          changedFields.push('passengerCount');
        }
        result.duplicates.push({
          slot,
          existingSlot: existing,
          changedFields,
        });
        result.data.push(slot);
        updateCount++;
      } else {
        result.data.push(slot);
        newCount++;
      }
    }

    result.success = newCount > 0 || updateCount > 0;
    result.duplicateCount = duplicateCount;
    result.newCount = newCount;
    result.updateCount = updateCount;

    if (updateCount > 0 && newCount > 0) {
      showToast(
        `解析完成：新增${newCount}条，更新${updateCount}条`,
        'info'
      );
    } else if (updateCount > 0) {
      showToast(
        `解析完成：更新${updateCount}条历史记录`,
        'info'
      );
    } else if (newCount > 0) {
      showToast(`解析完成：新增${newCount}条数据`, 'success');
    }
  } catch (error) {
    result.errors.push(getErrorMessage('import/invalid-format'));
    showToast(getErrorMessage('import/invalid-format'), 'error');
  }

  return result;
}

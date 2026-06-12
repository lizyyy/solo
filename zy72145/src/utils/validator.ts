import { TrackRecord, ValidationError, ValidationStatus } from '../types';
import { validateTimecodeRange } from './timecode';

function normalizeText(str: string): string {
  if (!str) return '';
  return str
    .trim()
    .toLowerCase()
    .replace(
      /[\s\-_/\\.，。、；：""''（）()【】[\]《》<>〈〉「」『』]/g,
      ''
    )
    .replace(/[ａ-ｚＡ-Ｚ０-９]/g, function (s) {
      return String.fromCharCode(s.charCodeAt(0) - 0xfee0);
    });
}

function generateDuplicateKey(teacherName: string, trackName: string): string {
  return `${normalizeText(teacherName)}|${normalizeText(trackName)}`;
}

export function isValidDate(dateStr: string): boolean {
  if (!dateStr) return false;
  const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return false;

  const year = parseInt(match[1], 10);
  const month = parseInt(match[2], 10);
  const day = parseInt(match[3], 10);

  if (month < 1 || month > 12) return false;
  if (day < 1 || day > 31) return false;

  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year &&
         date.getMonth() === month - 1 &&
         date.getDate() === day;
}

export function isDateExpired(dateStr: string): boolean {
  if (!isValidDate(dateStr)) return false;
  const authEnd = new Date(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  authEnd.setHours(0, 0, 0, 0);
  return authEnd < today;
}

export function detectDuplicates(records: TrackRecord[]): Map<string, string[]> {
  const groups = new Map<string, string[]>();

  records.forEach(record => {
    const key = generateDuplicateKey(record.teacherName, record.trackName);
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)!.push(record.id);
  });

  const duplicates = new Map<string, string[]>();
  groups.forEach((ids, key) => {
    if (ids.length > 1) {
      duplicates.set(key, ids);
    }
  });

  return duplicates;
}

export function validateSingleRecord(record: TrackRecord): {
  status: ValidationStatus;
  errors: ValidationError[];
} {
  const errors: ValidationError[] = [];
  let isDirty = false;

  if (!record.teacherName) {
    errors.push({ type: 'dirty_data', message: '教师姓名为空', field: 'teacherName' });
    isDirty = true;
  }

  if (!record.trackName) {
    errors.push({ type: 'dirty_data', message: '曲目名称为空', field: 'trackName' });
    isDirty = true;
  }

  if (record.authStart && !isValidDate(record.authStart)) {
    errors.push({ type: 'dirty_data', message: `授权开始日期格式错误: ${record.authStart}`, field: 'authStart' });
    isDirty = true;
  }

  if (record.authEnd && !isValidDate(record.authEnd)) {
    errors.push({ type: 'dirty_data', message: `授权结束日期格式错误: ${record.authEnd}`, field: 'authEnd' });
    isDirty = true;
  }

  if (record.authStart && record.authEnd && isValidDate(record.authStart) && isValidDate(record.authEnd)) {
    const start = new Date(record.authStart);
    const end = new Date(record.authEnd);
    if (start > end) {
      errors.push({ type: 'dirty_data', message: '授权开始日期晚于结束日期', field: 'authStart' });
      isDirty = true;
    }
  }

  if (isDirty) {
    return { status: 'dirty_data', errors };
  }

  if (record.authEnd && isDateExpired(record.authEnd)) {
    errors.push({ type: 'auth_expired', message: `授权已于 ${record.authEnd} 过期`, field: 'authEnd' });
  }

  if (record.tcIn || record.tcOut) {
    const tcValidation = validateTimecodeRange(record.tcIn, record.tcOut);
    if (!tcValidation.valid) {
      errors.push({ type: 'tc_mismatch', message: tcValidation.error!, field: 'tcIn' });
    }
  }

  const hasExpired = errors.some(e => e.type === 'auth_expired');
  const hasTcMismatch = errors.some(e => e.type === 'tc_mismatch');

  let status: ValidationStatus = 'normal';
  if (hasTcMismatch) {
    status = 'tc_mismatch';
  } else if (hasExpired) {
    status = 'auth_expired';
  }

  return { status, errors };
}

export function validateAllRecords(records: TrackRecord[]): TrackRecord[] {
  const duplicates = detectDuplicates(records);

  return records.map(record => {
    const { status, errors } = validateSingleRecord(record);
    let finalStatus = status;
    const finalErrors = [...errors];
    let duplicateGroupId: string | undefined;

    duplicates.forEach((ids, key) => {
      if (ids.includes(record.id)) {
        duplicateGroupId = key;
        if (finalStatus === 'normal' || finalStatus === 'auth_expired') {
          finalStatus = 'duplicate';
        }
        const duplicateCount = ids.length;
        const groupIndex = ids.indexOf(record.id) + 1;
        finalErrors.push({
          type: 'duplicate',
          message: `曲目重复 (${groupIndex}/${duplicateCount})，同教师同曲目出现 ${duplicateCount} 次`,
          field: 'trackName',
        });
      }
    });

    return {
      ...record,
      validationStatus: finalStatus,
      validationErrors: finalErrors,
      duplicateGroupId,
    };
  });
}

export function getImportStats(records: TrackRecord[]): {
  total: number;
  success: number;
  warnings: number;
  errors: number;
  dirtyRecords: TrackRecord[];
} {
  const total = records.length;
  const success = records.filter(r => r.validationStatus === 'normal').length;
  const warnings = records.filter(r =>
    r.validationStatus === 'auth_expired' || r.validationStatus === 'duplicate'
  ).length;
  const errors = records.filter(r =>
    r.validationStatus === 'tc_mismatch' || r.validationStatus === 'dirty_data'
  ).length;
  const dirtyRecords = records.filter(r => r.validationStatus === 'dirty_data');

  return { total, success, warnings, errors, dirtyRecords };
}

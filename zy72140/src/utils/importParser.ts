import type { ImportFailure } from '@/types';
import { parseCSV } from './csv';

const REQUIRED_FIELDS = ['volunteerName', 'role', 'timeSlot', 'date'] as const;

const FIELD_LABELS: Record<string, string> = {
  volunteerName: '志愿者姓名',
  role: '岗位',
  timeSlot: '时段',
  date: '日期',
};

const CSV_FIELD_MAP: Record<string, string> = {
  志愿者姓名: 'volunteerName',
  岗位: 'role',
  时段: 'timeSlot',
  日期: 'date',
  状态: 'status',
  备注: 'remark',
};

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('文件读取失败'));
    reader.readAsText(file, 'utf-8');
  });
}

function isCSVFile(file: File): boolean {
  const name = file.name.toLowerCase();
  return name.endsWith('.csv') || file.type === 'text/csv';
}

function mapCSVRow(
  headers: string[],
  row: string[]
): Record<string, string> | null {
  if (row.length === 0 || row.every((cell) => cell.trim() === '')) {
    return null;
  }
  const record: Record<string, string> = {};
  headers.forEach((header, idx) => {
    const field = CSV_FIELD_MAP[header.trim()] || header.trim();
    record[field] = idx < row.length ? row[idx].trim() : '';
  });
  return record;
}

function validateRow(
  rowIndex: number,
  record: Record<string, string>
): ImportFailure[] {
  const errors: ImportFailure[] = [];

  for (const field of REQUIRED_FIELDS) {
    const value = record[field];
    if (!value || value.trim() === '') {
      errors.push({
        rowIndex,
        rawData: JSON.stringify(record),
        errorType: 'missing_field',
        errorMessage: `第${rowIndex}行缺少'${FIELD_LABELS[field]}'`,
        suggestion: `第${rowIndex}行缺少'${FIELD_LABELS[field]}'，请检查该行是否有空单元格`,
      });
    }
  }

  if (
    record.date &&
    record.date.trim() !== '' &&
    !DATE_PATTERN.test(record.date.trim())
  ) {
    errors.push({
      rowIndex,
      rawData: JSON.stringify(record),
      errorType: 'invalid_value',
      errorMessage: `第${rowIndex}行日期格式不正确`,
      suggestion: `第${rowIndex}行日期格式不正确，应为YYYY-MM-DD格式，如2026-06-15`,
    });
  }

  return errors;
}

function parseCSVContent(text: string): {
  data: string[][];
  errors: ImportFailure[];
} {
  const rows = parseCSV(text);
  const errors: ImportFailure[] = [];
  const data: string[][] = [];

  if (rows.length < 2) {
    return { data, errors };
  }

  const headers = rows[0];
  const validHeaders = headers.every(
    (h) => CSV_FIELD_MAP[h.trim()] || h.trim()
  );

  for (let i = 1; i < rows.length; i++) {
    const rowIndex = i + 1;
    const row = rows[i];

    if (row.every((cell) => cell.trim() === '')) continue;

    const record = mapCSVRow(headers, row);
    if (!record) continue;

    const rowErrors = validateRow(rowIndex, record);
    if (rowErrors.length > 0) {
      errors.push(...rowErrors);
    } else {
      data.push(row);
    }
  }

  return { data, errors };
}

function parseJSONContent(text: string): {
  data: string[][];
  errors: ImportFailure[];
} {
  const errors: ImportFailure[] = [];
  const data: string[][] = [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    errors.push({
      rowIndex: 0,
      rawData: text.slice(0, 200),
      errorType: 'format_error',
      errorMessage: 'JSON格式错误，无法解析',
      suggestion: '请检查JSON文件格式是否正确，确保是有效的JSON数组',
    });
    return { data, errors };
  }

  if (!Array.isArray(parsed)) {
    errors.push({
      rowIndex: 0,
      rawData: text.slice(0, 200),
      errorType: 'format_error',
      errorMessage: 'JSON内容不是数组',
      suggestion: 'JSON文件应包含一个数组，每个元素为一个排班记录对象',
    });
    return { data, errors };
  }

  const fieldOrder = [
    'volunteerName',
    'role',
    'timeSlot',
    'date',
    'status',
    'remark',
  ];

  for (let i = 0; i < parsed.length; i++) {
    const rowIndex = i + 2;
    const item = parsed[i];

    if (typeof item !== 'object' || item === null) {
      errors.push({
        rowIndex,
        rawData: JSON.stringify(item),
        errorType: 'format_error',
        errorMessage: `第${rowIndex}行不是有效的对象`,
        suggestion: `第${rowIndex}行数据格式不正确，应为包含volunteerName、role、timeSlot、date字段的对象`,
      });
      continue;
    }

    const record = item as Record<string, string>;
    const rowErrors = validateRow(rowIndex, record);

    if (rowErrors.length > 0) {
      errors.push(...rowErrors);
    } else {
      const row = fieldOrder.map((field) => String(record[field] ?? ''));
      data.push(row);
    }
  }

  return { data, errors };
}

export async function parseImportFile(file: File): Promise<{
  data: string[][];
  errors: ImportFailure[];
}> {
  const text = await readFileAsText(file);

  if (isCSVFile(file)) {
    return parseCSVContent(text);
  }

  return parseJSONContent(text);
}

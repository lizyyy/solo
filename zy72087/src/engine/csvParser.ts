import type { HistoricalSample } from '@/types';

export const FIELD_MAPPING: Record<string, (keyof HistoricalSample)[]> = {
  '样本ID': ['id'],
  '线路ID': ['lineId'],
  '线路名称': ['lineName'],
  '线路': ['lineName'],
  '日期': ['date'],
  '时段': ['timePeriod'],
  '实际间隔': ['actualInterval'],
  '发车间隔': ['actualInterval'],
  '间隔': ['actualInterval'],
  '间隔单位': ['actualIntervalUnit'],
  '单位': ['actualIntervalUnit'],
  '客流量': ['passengerCount'],
  '客流': ['passengerCount'],
  '载客量': ['passengerCount'],
  '单趟成本': ['costPerTrip'],
  '成本': ['costPerTrip'],
  '准点率': ['onTimeRate'],
  '准点': ['onTimeRate'],
  '来源': ['source'],
  '数据来源': ['source'],
  '备注': ['remarks'],
  '说明': ['remarks'],
  '口径': ['caliberTag'],
  '口径标签': ['caliberTag'],
  '是否越界': ['isOutlier'],
  '越界': ['isOutlier'],
};

export const STANDARD_FIELDS: (keyof HistoricalSample)[] = [
  'id', 'lineId', 'lineName', 'date', 'timePeriod',
  'actualInterval', 'actualIntervalUnit', 'passengerCount',
  'costPerTrip', 'onTimeRate', 'source', 'remarks',
  'caliberTag', 'isOutlier',
];

export interface ColumnMap {
  [csvColumn: string]: keyof HistoricalSample | null;
}

export interface ImportResult {
  samples: HistoricalSample[];
  warnings: string[];
  rowCount: number;
  validCount: number;
}

export interface ParseOptions {
  encoding?: 'utf-8' | 'gbk';
  delimiter?: ',' | '\t' | ';';
}

function autoDetectDelimiter(text: string): ',' | '\t' | ';' {
  const firstLine = text.split('\n')[0] || '';
  const counts = {
    ',': (firstLine.match(/,/g) || []).length,
    '\t': (firstLine.match(/\t/g) || []).length,
    ';': (firstLine.match(/;/g) || []).length,
  };
  const max = Math.max(counts[','], counts['\t'], counts[';']);
  if (max === 0) return ',';
  if (counts[','] === max) return ',';
  if (counts['\t'] === max) return '\t';
  return ';';
}

function parseCSV(text: string, delimiter: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentCell = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (inQuotes) {
      if (char === '"' && nextChar === '"') {
        currentCell += '"';
        i++;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        currentCell += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === delimiter) {
        currentRow.push(currentCell.trim());
        currentCell = '';
      } else if (char === '\n' || (char === '\r' && nextChar === '\n')) {
        currentRow.push(currentCell.trim());
        if (currentRow.some((cell) => cell !== '')) {
          rows.push(currentRow);
        }
        currentRow = [];
        currentCell = '';
        if (char === '\r') i++;
      } else if (char === '\r') {
        currentRow.push(currentCell.trim());
        if (currentRow.some((cell) => cell !== '')) {
          rows.push(currentRow);
        }
        currentRow = [];
        currentCell = '';
      } else {
        currentCell += char;
      }
    }
  }

  if (currentCell !== '' || currentRow.length > 0) {
    currentRow.push(currentCell.trim());
    if (currentRow.some((cell) => cell !== '')) {
      rows.push(currentRow);
    }
  }

  return rows;
}

function normalizeColumnName(name: string): string {
  return name
    .replace(/[\s_（）()]/g, '')
    .replace(/[，,]/g, '')
    .toLowerCase();
}

export function suggestColumnMapping(csvHeaders: string[]): ColumnMap {
  const mapping: ColumnMap = {};
  const normalizedMappings: Record<string, keyof HistoricalSample> = {};

  for (const [key, fields] of Object.entries(FIELD_MAPPING)) {
    const normalizedKey = normalizeColumnName(key);
    normalizedMappings[normalizedKey] = fields[0];
  }

  for (const header of csvHeaders) {
    const normalized = normalizeColumnName(header);
    const matched = normalizedMappings[normalized];
    mapping[header] = matched || null;
  }

  return mapping;
}

function parseNumber(value: string): number | null {
  if (!value || value.trim() === '') return null;
  const cleaned = value.replace(/[^\d.-]/g, '');
  if (cleaned === '') return null;
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

function parseBoolean(value: string): boolean {
  if (!value) return false;
  const v = value.trim().toLowerCase();
  return v === '是' || v === 'true' || v === '1' || v === 'yes' || v === 'y';
}

function parseIntervalUnit(value: string): 'sec' | 'min' {
  if (!value) return 'sec';
  const v = value.trim().toLowerCase();
  if (v === '分' || v === '分钟' || v === 'min' || v === 'minute' || v === 'minutes') return 'min';
  return 'sec';
}

function parseOnTimeRate(value: string): number | null {
  if (!value || value.trim() === '') return null;
  const cleaned = value.replace(/[%％]/g, '').trim();
  const num = parseFloat(cleaned);
  if (isNaN(num)) return null;
  if (num > 1) return num / 100;
  return num;
}

function generateId(index: number): string {
  return `IMP_${Date.now().toString(36).toUpperCase()}_${String(index).padStart(3, '0')}`;
}

export function applyColumnMapping(
  rows: string[][],
  columnMap: ColumnMap,
  sourceTag: string
): ImportResult {
  const warnings: string[] = [];
  const samples: HistoricalSample[] = [];

  const headers = rows[0] || [];
  const dataRows = rows.slice(1);

  for (let rowIdx = 0; rowIdx < dataRows.length; rowIdx++) {
    const row = dataRows[rowIdx];
    const raw: Record<string, string> = {};
    for (let colIdx = 0; colIdx < headers.length; colIdx++) {
      raw[headers[colIdx]] = row[colIdx] || '';
    }

    const sample: Partial<HistoricalSample> = {
      id: generateId(rowIdx + 1),
      source: sourceTag,
      caliberTag: 'V2-2025',
      actualIntervalUnit: 'sec',
      isOutlier: false,
      remarks: '',
      actualInterval: null,
      passengerCount: null,
      costPerTrip: null,
      onTimeRate: null,
    };

    let hasAnyField = false;
    for (const [csvCol, targetField] of Object.entries(columnMap)) {
      if (!targetField) continue;
      const value = raw[csvCol] || '';
      if (value === '') continue;
      hasAnyField = true;

      switch (targetField) {
        case 'id':
          sample.id = value || sample.id;
          break;
        case 'lineId':
          sample.lineId = value;
          break;
        case 'lineName':
          sample.lineName = value;
          break;
        case 'date':
          sample.date = value;
          break;
        case 'timePeriod':
          sample.timePeriod = value;
          break;
        case 'actualInterval':
          sample.actualInterval = parseNumber(value);
          break;
        case 'actualIntervalUnit':
          sample.actualIntervalUnit = parseIntervalUnit(value);
          break;
        case 'passengerCount':
          sample.passengerCount = parseNumber(value);
          break;
        case 'costPerTrip':
          sample.costPerTrip = parseNumber(value);
          break;
        case 'onTimeRate':
          sample.onTimeRate = parseOnTimeRate(value);
          break;
        case 'source':
          sample.source = value || sourceTag;
          break;
        case 'remarks':
          sample.remarks = value;
          break;
        case 'caliberTag':
          sample.caliberTag = value || 'V2-2025';
          break;
        case 'isOutlier':
          sample.isOutlier = parseBoolean(value);
          break;
      }
    }

    if (!hasAnyField) {
      warnings.push(`第 ${rowIdx + 2} 行：所有映射字段均为空，已跳过`);
      continue;
    }

    if (!sample.lineName && sample.lineId) {
      sample.lineName = sample.lineId;
    }
    if (!sample.lineId && sample.lineName) {
      sample.lineId = `L_${sample.lineName}`;
    }
    if (!sample.date) {
      sample.date = new Date().toISOString().split('T')[0];
      warnings.push(`第 ${rowIdx + 2} 行：日期为空，已默认填充为今日`);
    }
    if (!sample.timePeriod) {
      sample.timePeriod = '平峰';
      warnings.push(`第 ${rowIdx + 2} 行：时段为空，已默认填充为"平峰"`);
    }

    samples.push(sample as HistoricalSample);
  }

  return {
    samples,
    warnings,
    rowCount: dataRows.length,
    validCount: samples.length,
  };
}

export async function parseCSVFile(
  file: File,
  options: ParseOptions = {}
): Promise<string[][]> {
  const buffer = await file.arrayBuffer();
  const decoder = new TextDecoder(options.encoding || 'utf-8');
  const text = decoder.decode(buffer);
  const delimiter = options.delimiter || autoDetectDelimiter(text);
  return parseCSV(text, delimiter);
}

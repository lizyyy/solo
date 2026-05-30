import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import type { RawSample, SampleSource } from '../types';

export interface ParsedData {
  samples: Omit<RawSample, 'id' | 'batchId' | 'importId' | 'source' | 'rawLineNumber' | 'createdAt'>[];
  deviceId: string;
  fileName: string;
}

export interface ParseOptions {
  deviceId?: string;
  source?: SampleSource;
  hasHeader?: boolean;
  delimiter?: string;
}

const COLUMN_MAPPINGS: Record<string, string[]> = {
  timestamp: ['timestamp', 'time', '时间', '时间戳', 'ts'],
  speed: ['speed', '转速', 'rpm', 'n'],
  torqueRaw: ['torque', '扭矩', 'tq', 'torque_raw', '原始扭矩'],
  temperature: ['temperature', 'temp', '温度', 't'],
  loadLevel: ['load', '负载', '档位', 'load_level', 'loadlevel']
};

function normalizeColumnName(name: string): string {
  return name.toLowerCase().trim().replace(/[_\s-]/g, '');
}

function findColumnIndex(headers: string[], targetKeys: string[]): number {
  for (let i = 0; i < headers.length; i++) {
    const normalized = normalizeColumnName(headers[i]);
    if (targetKeys.some(key => normalizeColumnName(key) === normalized || normalized.includes(normalizeColumnName(key)))) {
      return i;
    }
  }
  return -1;
}

function parseValue(value: unknown): number | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  const num = typeof value === 'number' ? value : parseFloat(String(value));
  return isNaN(num) ? undefined : num;
}

function parseTimestamp(value: unknown): number {
  if (value === undefined || value === null) return Date.now();
  
  if (typeof value === 'number') {
    return value > 1e12 ? value : value * 1000;
  }
  
  const str = String(value).trim();
  
  if (/^\d+$/.test(str)) {
    const num = parseInt(str, 10);
    return num > 1e12 ? num : num * 1000;
  }
  
  const parsed = Date.parse(str);
  return isNaN(parsed) ? Date.now() : parsed;
}

export function parseCSV(
  content: string,
  options: ParseOptions = {}
): ParsedData {
  const { hasHeader = true, delimiter } = options;
  
  const result = Papa.parse(content, {
    header: hasHeader,
    delimiter: delimiter,
    skipEmptyLines: true,
    dynamicTyping: true
  });
  
  if (result.errors.length > 0) {
    console.warn('CSV parsing warnings:', result.errors);
  }
  
  const data = result.data as Array<Record<string, unknown> | unknown[]>;
  
  if (data.length === 0) {
    throw new Error('CSV 文件为空');
  }
  
  let headers: string[];
  let dataRows: unknown[][];
  
  if (hasHeader && Array.isArray(data[0]) === false) {
    headers = Object.keys(data[0] as Record<string, unknown>);
    dataRows = data.map(row => Object.values(row as Record<string, unknown>));
  } else {
    const firstRow = data[0] as unknown[];
    headers = hasHeader ? (firstRow as string[]) : firstRow.map((_, i) => `col_${i}`);
    dataRows = hasHeader ? data.slice(1) as unknown[][] : data as unknown[][];
  }
  
  const colIndices = {
    timestamp: findColumnIndex(headers, COLUMN_MAPPINGS.timestamp),
    speed: findColumnIndex(headers, COLUMN_MAPPINGS.speed),
    torqueRaw: findColumnIndex(headers, COLUMN_MAPPINGS.torqueRaw),
    temperature: findColumnIndex(headers, COLUMN_MAPPINGS.temperature),
    loadLevel: findColumnIndex(headers, COLUMN_MAPPINGS.loadLevel)
  };
  
  if (colIndices.timestamp === -1 || colIndices.speed === -1 || 
      colIndices.torqueRaw === -1 || colIndices.temperature === -1) {
    throw new Error(`无法识别必要的列。请确保包含：时间戳、转速、扭矩、温度。当前表头：${headers.join(', ')}`);
  }
  
  const samples = dataRows.map((row, idx) => {
    const timestamp = parseTimestamp(row[colIndices.timestamp]);
    const speed = parseValue(row[colIndices.speed]) ?? 0;
    const torqueRaw = parseValue(row[colIndices.torqueRaw]) ?? 0;
    const temperature = parseValue(row[colIndices.temperature]) ?? 25;
    const loadLevel = colIndices.loadLevel >= 0 ? parseValue(row[colIndices.loadLevel]) : undefined;
    
    return {
      timestamp,
      deviceId: options.deviceId ?? 'UNKNOWN',
      speed,
      torqueRaw,
      temperature,
      loadLevel
    };
  });
  
  return {
    samples,
    deviceId: options.deviceId ?? samples[0]?.deviceId ?? 'UNKNOWN',
    fileName: 'imported.csv'
  };
}

export function parseExcel(
  buffer: ArrayBuffer,
  options: ParseOptions = {}
): ParsedData {
  const workbook = XLSX.read(buffer, { type: 'array' });
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  
  const jsonData = XLSX.utils.sheet_to_json(worksheet, { 
    header: options.hasHeader !== false ? 1 : 0,
    raw: true 
  }) as Array<Record<string, unknown> | unknown[]>;
  
  if (jsonData.length === 0) {
    throw new Error('Excel 文件为空');
  }
  
  let headers: string[];
  let dataRows: unknown[][];
  
  if (options.hasHeader !== false && !Array.isArray(jsonData[0])) {
    headers = Object.keys(jsonData[0] as Record<string, unknown>);
    dataRows = jsonData.map(row => Object.values(row as Record<string, unknown>));
  } else {
    const firstRow = jsonData[0] as unknown[];
    headers = options.hasHeader !== false 
      ? (firstRow as string[]) 
      : firstRow.map((_, i) => `col_${i}`);
    dataRows = options.hasHeader !== false 
      ? jsonData.slice(1) as unknown[][] 
      : jsonData as unknown[][];
  }
  
  const colIndices = {
    timestamp: findColumnIndex(headers, COLUMN_MAPPINGS.timestamp),
    speed: findColumnIndex(headers, COLUMN_MAPPINGS.speed),
    torqueRaw: findColumnIndex(headers, COLUMN_MAPPINGS.torqueRaw),
    temperature: findColumnIndex(headers, COLUMN_MAPPINGS.temperature),
    loadLevel: findColumnIndex(headers, COLUMN_MAPPINGS.loadLevel)
  };
  
  if (colIndices.timestamp === -1 || colIndices.speed === -1 || 
      colIndices.torqueRaw === -1 || colIndices.temperature === -1) {
    throw new Error(`无法识别必要的列。请确保包含：时间戳、转速、扭矩、温度。当前表头：${headers.join(', ')}`);
  }
  
  const samples = dataRows.map((row) => {
    const timestamp = parseTimestamp(row[colIndices.timestamp]);
    const speed = parseValue(row[colIndices.speed]) ?? 0;
    const torqueRaw = parseValue(row[colIndices.torqueRaw]) ?? 0;
    const temperature = parseValue(row[colIndices.temperature]) ?? 25;
    const loadLevel = colIndices.loadLevel >= 0 ? parseValue(row[colIndices.loadLevel]) : undefined;
    
    return {
      timestamp,
      deviceId: options.deviceId ?? 'UNKNOWN',
      speed,
      torqueRaw,
      temperature,
      loadLevel
    };
  });
  
  return {
    samples,
    deviceId: options.deviceId ?? samples[0]?.deviceId ?? 'UNKNOWN',
    fileName: sheetName
  };
}

export async function parseFile(
  file: File,
  options: ParseOptions = {}
): Promise<ParsedData> {
  const fileName = file.name.toLowerCase();
  
  if (fileName.endsWith('.csv')) {
    const content = await file.text();
    const result = parseCSV(content, options);
    return { ...result, fileName: file.name };
  } else if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
    const buffer = await file.arrayBuffer();
    const result = parseExcel(buffer, options);
    return { ...result, fileName: file.name };
  } else if (fileName.endsWith('.json')) {
    const content = await file.text();
    const data = JSON.parse(content);
    
    if (Array.isArray(data)) {
      const samples = data.map((item, idx) => ({
        timestamp: parseTimestamp(item.timestamp),
        deviceId: options.deviceId ?? item.deviceId ?? 'UNKNOWN',
        speed: parseValue(item.speed) ?? 0,
        torqueRaw: parseValue(item.torqueRaw) ?? parseValue(item.torque) ?? 0,
        temperature: parseValue(item.temperature) ?? 25,
        loadLevel: parseValue(item.loadLevel)
      }));
      
      return {
        samples,
        deviceId: options.deviceId ?? samples[0]?.deviceId ?? 'UNKNOWN',
        fileName: file.name
      };
    }
  }
  
  throw new Error(`不支持的文件格式：${fileName}。请使用 CSV、Excel 或 JSON 格式。`);
}

import * as fs from 'fs';
import * as path from 'path';
import { DataRecord, ProcessingResult } from '../types';
import { generateId } from '../utils/id';

const DATA_FILE = path.join(process.cwd(), 'data', 'records.json');
const DATA_DIR = path.join(process.cwd(), 'data');

interface StoredRecord {
  id: string;
  originalRowNumber: number;
  sourceFile: string;
  importTimestamp: number;
  importedBy: string;
  rawValues: Array<[string, { original: string; numericValue: number; format: string }]>;
  normalizedValues: Array<[string, number]>;
  status: string;
  currentStep: string;
  formatDetected: string;
  hasMixedFormat: boolean;
  changeHistory: unknown[];
  annotations: unknown[];
  reviewAssignee?: string;
  reviewDecision?: string;
  reviewTimestamp?: number;
  completedBy?: string;
  completedTimestamp?: number;
}

function ensureDataDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function serializeRecord(record: DataRecord): StoredRecord {
  return {
    id: record.id,
    originalRowNumber: record.originalRowNumber,
    sourceFile: record.sourceFile,
    importTimestamp: record.importTimestamp,
    importedBy: record.importedBy,
    rawValues: Array.from(record.rawValues.entries()).map(([k, v]) => [
      k,
      { original: v.original, numericValue: v.numericValue, format: v.format },
    ]),
    normalizedValues: Array.from(record.normalizedValues.entries()),
    status: record.status,
    currentStep: record.currentStep,
    formatDetected: record.formatDetected,
    hasMixedFormat: record.hasMixedFormat,
    changeHistory: record.changeHistory,
    annotations: record.annotations,
    reviewAssignee: record.reviewAssignee,
    reviewDecision: record.reviewDecision as string | undefined,
    reviewTimestamp: record.reviewTimestamp,
    completedBy: record.completedBy,
    completedTimestamp: record.completedTimestamp,
  };
}

function deserializeRecord(stored: StoredRecord): DataRecord {
  const rawValues = new Map<string, { original: string; numericValue: number; format: string }>();
  stored.rawValues.forEach(([k, v]) => rawValues.set(k, v));

  const normalizedValues = new Map<string, number>();
  stored.normalizedValues.forEach(([k, v]) => normalizedValues.set(k, v));

  return {
    id: stored.id,
    originalRowNumber: stored.originalRowNumber,
    sourceFile: stored.sourceFile,
    importTimestamp: stored.importTimestamp,
    importedBy: stored.importedBy,
    rawValues: rawValues as Map<string, { original: string; numericValue: number; format: import('../types').ValueFormat }>,
    normalizedValues,
    status: stored.status as import('../types').ProcessingStatus,
    currentStep: stored.currentStep as import('../types').WorkflowStep,
    formatDetected: stored.formatDetected as import('../types').ValueFormat,
    hasMixedFormat: stored.hasMixedFormat,
    changeHistory: stored.changeHistory as import('../types').ChangeRecord[],
    annotations: stored.annotations as import('../types').AnnotationRecord[],
    reviewAssignee: stored.reviewAssignee,
    reviewDecision: stored.reviewDecision as 'approve' | 'reject' | 'rollback' | undefined,
    reviewTimestamp: stored.reviewTimestamp,
    completedBy: stored.completedBy,
    completedTimestamp: stored.completedTimestamp,
  };
}

function loadRecords(): DataRecord[] {
  ensureDataDir();
  if (!fs.existsSync(DATA_FILE)) {
    return [];
  }
  try {
    const content = fs.readFileSync(DATA_FILE, 'utf-8');
    const stored: StoredRecord[] = JSON.parse(content);
    return stored.map(deserializeRecord);
  } catch {
    return [];
  }
}

function saveRecords(records: DataRecord[]): void {
  ensureDataDir();
  const stored = records.map(serializeRecord);
  fs.writeFileSync(DATA_FILE, JSON.stringify(stored, null, 2), 'utf-8');
}

export function saveRecord(record: DataRecord): ProcessingResult<DataRecord> {
  const records = loadRecords();
  const existingIndex = records.findIndex((r) => r.id === record.id);
  if (existingIndex >= 0) {
    records[existingIndex] = record;
  } else {
    records.push(record);
  }
  saveRecords(records);
  return { success: true, data: record, errors: [], warnings: [] };
}

export function getRecord(id: string): ProcessingResult<DataRecord> {
  const records = loadRecords();
  const record = records.find((r) => r.id === id);
  if (!record) {
    return { success: false, errors: [`未找到记录 ${id}`], warnings: [] };
  }
  return { success: true, data: record, errors: [], warnings: [] };
}

export function getAllRecords(): DataRecord[] {
  return loadRecords();
}

export function getRecordsByStatus(status: string): DataRecord[] {
  return loadRecords().filter((r) => r.status === status);
}

export function getRecordsWithMixedFormat(): DataRecord[] {
  return loadRecords().filter((r) => r.hasMixedFormat);
}

export function clearAllRecords(): ProcessingResult<void> {
  saveRecords([]);
  return { success: true, errors: [], warnings: [] };
}

export function createNewRecord(
  originalRowNumber: number,
  sourceFile: string,
  importedBy: string
): DataRecord {
  return {
    id: generateId('rec'),
    originalRowNumber,
    sourceFile,
    importTimestamp: Date.now(),
    importedBy,
    rawValues: new Map(),
    normalizedValues: new Map(),
    status: 'imported',
    currentStep: 'import',
    formatDetected: 'unknown',
    hasMixedFormat: false,
    changeHistory: [],
    annotations: [],
  };
}

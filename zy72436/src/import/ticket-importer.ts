import * as crypto from 'crypto';
import { parse } from 'csv-parse/sync';
import { dataStore } from '../store/data-store';
import { TicketRow, ImportBatch, ProcessingStatus } from '../types';

export interface ImportResult {
  batchId: string;
  totalRows: number;
  importedRows: number;
  duplicateRows: number;
  importedIds: string[];
  duplicateDetails: { rowNumber: number; studentName: string; existingId: string }[];
}

function computeFileHash(content: string): string {
  return crypto.createHash('md5').update(content).digest('hex');
}

function extractField(raw: Record<string, string>, possibleNames: string[]): string {
  for (const name of possibleNames) {
    if (raw[name] !== undefined && raw[name] !== null && raw[name].trim() !== '') {
      return raw[name].trim();
    }
  }
  return '';
}

export function parseTicketCsv(csvContent: string): { rowNumber: number; rawData: Record<string, string> }[] {
  const records = parse(csvContent, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  });
  
  return records.map((r: any, idx: number) => ({
    rowNumber: idx + 2,
    rawData: r as Record<string, string>,
  }));
}

export function importTicketCsv(
  csvContent: string,
  fileName: string,
  importedBy: string,
  forceReimport: boolean = false
): ImportResult {
  const fileHash = computeFileHash(csvContent);
  
  if (!forceReimport && dataStore.hasFileHash(fileHash)) {
    const existingBatch = dataStore.getAllImportBatches().find(b => b.fileHash === fileHash);
    throw new Error(`该文件已导入过，批次ID: ${existingBatch?.id}，请使用 forceReimport=true 强制重新导入`);
  }
  
  const parsedRows = parseTicketCsv(csvContent);
  const batchId = dataStore.generateId();
  const importedIds: string[] = [];
  const duplicateDetails: { rowNumber: number; studentName: string; existingId: string }[] = [];
  
  for (const parsed of parsedRows) {
    const { rowNumber, rawData } = parsed;
    
    const studentName = extractField(rawData, ['学生姓名', '姓名', 'student_name', 'name']);
    const instrument = extractField(rawData, ['乐器', '专业', 'instrument', 'major']);
    const trackId = extractField(rawData, ['轨道编号', '轨道', 'track_id', 'track']);
    
    if (!studentName || !instrument || !trackId) {
      continue;
    }
    
    const existing = dataStore.findDuplicateRow(studentName, instrument, trackId);
    if (existing) {
      duplicateDetails.push({ rowNumber, studentName, existingId: existing.id });
      continue;
    }
    
    const now = new Date().toISOString();
    const row: TicketRow = {
      id: dataStore.generateId(),
      importBatchId: batchId,
      originalRowNumber: rowNumber,
      rawData,
      manualChanges: [],
      processingStatus: 'imported',
      studentName,
      instrument,
      trackId,
      trackRemarks: [],
      rehearsalChanges: [],
      importedAt: now,
      importedBy,
      lastUpdatedAt: now,
      lastUpdatedBy: importedBy,
    };
    
    dataStore.addTicketRow(row);
    importedIds.push(row.id);
  }
  
  const batch: ImportBatch = {
    id: batchId,
    fileName,
    importedAt: new Date().toISOString(),
    importedBy,
    rowCount: parsedRows.length,
    duplicateCount: duplicateDetails.length,
    fileHash,
  };
  
  dataStore.addImportBatch(batch);
  
  return {
    batchId,
    totalRows: parsedRows.length,
    importedRows: importedIds.length,
    duplicateRows: duplicateDetails.length,
    importedIds,
    duplicateDetails,
  };
}

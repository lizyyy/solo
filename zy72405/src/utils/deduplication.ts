import { ShortageRecord, ContractSnapshot, ParsedContractLine } from '@/types';
import { computeContentFingerprint } from './hash';

export interface DuplicateCheckResult {
  isDuplicate: boolean;
  existingRecordId?: string;
  existingSnapshotId?: string;
  matchType?: 'file_hash' | 'content_fingerprint' | 'line_number' | 'line_content';
}

export type ImportLineCategory = 'reused' | 'modified' | 'added';

export interface ClassifiedImportLine {
  line: ParsedContractLine;
  category: ImportLineCategory;
  existingRecordId?: string;
  changedFields?: Array<{ field: string; oldValue: string; newValue: string }>;
}

export interface ClassifiedImportResult {
  reused: ClassifiedImportLine[];
  modified: ClassifiedImportLine[];
  added: ClassifiedImportLine[];
}

export function checkFileDuplicate(
  fileHash: string,
  existingSnapshots: ContractSnapshot[]
): DuplicateCheckResult {
  const existing = existingSnapshots.find(s => s.fileHash === fileHash);
  if (existing) {
    return {
      isDuplicate: true,
      existingSnapshotId: existing.id,
      matchType: 'file_hash'
    };
  }
  return { isDuplicate: false };
}

export function checkContentDuplicate(
  parsedLines: ParsedContractLine[],
  existingSnapshots: ContractSnapshot[]
): DuplicateCheckResult {
  const fingerprint = computeContentFingerprint(parsedLines);
  const existing = existingSnapshots.find(s => s.contentFingerprint === fingerprint);
  if (existing) {
    return {
      isDuplicate: true,
      existingSnapshotId: existing.id,
      matchType: 'content_fingerprint'
    };
  }
  return { isDuplicate: false };
}

export function checkLineByNumberAndContent(
  line: ParsedContractLine,
  existingRecords: ShortageRecord[],
  snapshotFileName?: string
): { matchType: 'exact' | 'line_only' | 'none'; record?: ShortageRecord } {
  const byLineNumber = existingRecords.find(
    r => r.originalLineNumber === line.lineNumber
  );

  if (byLineNumber) {
    const contentMatches = byLineNumber.originalContent.trim() === line.content.trim();
    if (contentMatches) {
      return { matchType: 'exact', record: byLineNumber };
    } else {
      return { matchType: 'line_only', record: byLineNumber };
    }
  }

  const byContent = existingRecords.find(
    r => r.originalContent.trim() === line.content.trim()
  );
  if (byContent) {
    return { matchType: 'exact', record: byContent };
  }

  return { matchType: 'none' };
}

function diffLineAgainstRecord(
  line: ParsedContractLine,
  record: ShortageRecord
): Array<{ field: string; oldValue: string; newValue: string }> {
  const changes: Array<{ field: string; oldValue: string; newValue: string }> = [];

  if (record.originalContent.trim() !== line.content.trim()) {
    changes.push({
      field: 'originalContent',
      oldValue: record.originalContent,
      newValue: line.content
    });
  }

  if (record.trackName !== line.trackName) {
    changes.push({
      field: 'trackName',
      oldValue: record.trackName,
      newValue: line.trackName
    });
  }

  if (record.shortageQuantity !== line.quantity) {
    changes.push({
      field: 'shortageQuantity',
      oldValue: String(record.shortageQuantity),
      newValue: String(line.quantity)
    });
  }

  return changes;
}

export function classifyImportLines(
  parsedLines: ParsedContractLine[],
  existingRecords: ShortageRecord[]
): ClassifiedImportResult {
  const result: ClassifiedImportResult = {
    reused: [],
    modified: [],
    added: []
  };

  for (const line of parsedLines) {
    const check = checkLineByNumberAndContent(line, existingRecords);

    if (check.matchType === 'exact') {
      result.reused.push({
        line,
        category: 'reused',
        existingRecordId: check.record!.id
      });
    } else if (check.matchType === 'line_only' && check.record) {
      const changedFields = diffLineAgainstRecord(line, check.record);
      result.modified.push({
        line,
        category: 'modified',
        existingRecordId: check.record.id,
        changedFields
      });
    } else {
      result.added.push({
        line,
        category: 'added'
      });
    }
  }

  return result;
}

export function filterDuplicateLines(
  parsedLines: ParsedContractLine[],
  existingRecords: ShortageRecord[]
): { newLines: ParsedContractLine[]; duplicates: Array<{ line: ParsedContractLine; existingRecordId: string }> } {
  const newLines: ParsedContractLine[] = [];
  const duplicates: Array<{ line: ParsedContractLine; existingRecordId: string }> = [];

  for (const line of parsedLines) {
    const check = checkLineByNumberAndContent(line, existingRecords);
    if ((check.matchType === 'exact' || check.matchType === 'line_only') && check.record) {
      duplicates.push({ line, existingRecordId: check.record.id });
    } else {
      newLines.push(line);
    }
  }

  return { newLines, duplicates };
}

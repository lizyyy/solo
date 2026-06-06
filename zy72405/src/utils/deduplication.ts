import { ShortageRecord, ContractSnapshot, ParsedContractLine } from '@/types';
import { computeContentFingerprint } from './hash';

export interface DuplicateCheckResult {
  isDuplicate: boolean;
  existingRecordId?: string;
  existingSnapshotId?: string;
  matchType?: 'file_hash' | 'content_fingerprint' | 'line_content';
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

export function checkLineDuplicate(
  line: ParsedContractLine,
  existingRecords: ShortageRecord[]
): DuplicateCheckResult {
  const existing = existingRecords.find(
    r => r.originalLineNumber === line.lineNumber &&
         r.originalContent.trim() === line.content.trim()
  );
  if (existing) {
    return {
      isDuplicate: true,
      existingRecordId: existing.id,
      matchType: 'line_content'
    };
  }
  return { isDuplicate: false };
}

export function filterDuplicateLines(
  parsedLines: ParsedContractLine[],
  existingRecords: ShortageRecord[]
): { newLines: ParsedContractLine[]; duplicates: Array<{ line: ParsedContractLine; existingRecordId: string }> } {
  const newLines: ParsedContractLine[] = [];
  const duplicates: Array<{ line: ParsedContractLine; existingRecordId: string }> = [];

  for (const line of parsedLines) {
    const check = checkLineDuplicate(line, existingRecords);
    if (check.isDuplicate && check.existingRecordId) {
      duplicates.push({ line, existingRecordId: check.existingRecordId });
    } else {
      newLines.push(line);
    }
  }

  return { newLines, duplicates };
}

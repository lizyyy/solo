import Papa from 'papaparse';
import type { SongRecord, ImportPreviewRow } from '@/types';
import { findNameMappingCandidates } from './nameMatcher';

export interface ParsedCSVRow {
  originalRowNumber: number;
  现场名?: string;
  版权名?: string;
  情绪标签?: string;
  liveName?: string;
  copyrightName?: string;
  emotionTag?: string;
  [key: string]: unknown;
}

export const parseCSVFile = (file: File): Promise<ParsedCSVRow[]> => {
  return new Promise((resolve, reject) => {
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const parsedRows: ParsedCSVRow[] = results.data.map((row, index) => ({
          originalRowNumber: index + 2,
          ...row,
        }));
        resolve(parsedRows);
      },
      error: (error) => {
        reject(error);
      },
    });
  });
};

export const generatePreview = (rows: ParsedCSVRow[], existingRecords: SongRecord[]): ImportPreviewRow[] => {
  const previewRows: ImportPreviewRow[] = rows.slice(0, 20).map((row) => {
    const liveName = row['现场名'] || row['liveName'] || '';
    const copyrightName = row['版权名'] || row['copyrightName'] || '';

    const isDuplicate = existingRecords.some(
      (r) =>
        r.liveName === liveName &&
        r.copyrightName === copyrightName
    );

    return {
      originalRowNumber: row.originalRowNumber,
      liveName,
      copyrightName,
      isDuplicate,
      isNameMapping: false,
    };
  });

  const tempRecords: SongRecord[] = previewRows.map((row, idx) => ({
    id: `temp_${idx}`,
    originalRowNumber: row.originalRowNumber,
    liveName: row.liveName,
    copyrightName: row.copyrightName,
    emotionTag: '',
    emotionConfidence: 0,
    emotionUpdatedAt: 0,
    status: 'pending',
    audioNote: '',
    manualChanges: [],
    importVersion: '',
    createdAt: 0,
    updatedAt: 0,
  }));

  const nameMappingGroups = findNameMappingCandidates(tempRecords);
  const nameMappingIds = new Set<string>();
  nameMappingGroups.forEach((members) => {
    members.forEach((id) => nameMappingIds.add(id));
  });

  return previewRows.map((row, idx) => ({
    ...row,
    isNameMapping: nameMappingIds.has(`temp_${idx}`),
  }));
};

export const convertToRecords = (
  rows: ParsedCSVRow[],
  importVersion: string,
  operator: string
): SongRecord[] => {
  const now = Date.now();

  return rows.map((row) => {
    const liveName = row['现场名'] || row['liveName'] || '';
    const copyrightName = row['版权名'] || row['copyrightName'] || '';
    const initialEmotionTag = row['情绪标签'] || row['emotionTag'] || '';

    return {
      id: `record_${now}_${row.originalRowNumber}_${Math.random().toString(36).slice(2, 8)}`,
      originalRowNumber: row.originalRowNumber,
      liveName,
      copyrightName,
      emotionTag: initialEmotionTag || '未标注',
      emotionConfidence: initialEmotionTag ? 0.8 : 0.3,
      emotionUpdatedAt: now,
      status: 'pending',
      audioNote: '',
      manualChanges: [],
      importVersion,
      createdAt: now,
      updatedAt: now,
    };
  });
};

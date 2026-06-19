import * as fs from 'fs';
import { parse } from 'csv-parse/sync';
import * as XLSX from 'xlsx';
import { v4 as uuidv4 } from 'uuid';
import { DataSource } from '../types';
import { ReconciliationStore } from '../store';

export interface ParsedGroupSignupRow {
  originalRowNumber: number;
  rawContent: string;
  performerName?: string;
  songName?: string;
  isTemporarySubstitute?: boolean;
  substituteNote?: string;
  importBatchId: string;
}

export function parseGroupSignupFile(filePath: string, batchId: string): ParsedGroupSignupRow[] {
  const ext = filePath.toLowerCase().split('.').pop();
  let rows: string[][] = [];

  if (ext === 'csv') {
    const content = fs.readFileSync(filePath, 'utf-8');
    rows = parse(content, { skip_empty_lines: true });
  } else if (ext === 'xlsx' || ext === 'xls') {
    const workbook = XLSX.readFile(filePath);
    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
    rows = XLSX.utils.sheet_to_json(firstSheet, { header: 1 }) as string[][];
  } else if (ext === 'txt') {
    const content = fs.readFileSync(filePath, 'utf-8');
    rows = content.split('\n').filter((l) => l.trim()).map((l) => [l]);
  } else {
    throw new Error(`不支持的文件格式: ${ext}，支持 CSV/XLSX/TXT`);
  }

  return rows.map((row, idx) => {
    const rawContent = row.join(' | ');
    const rowNumber = idx + 1;

    let performerName: string | undefined;
    let songName: string | undefined;
    let isTemporarySubstitute = false;
    let substituteNote: string | undefined;

    const line = rawContent;

    const tempMatch = line.match(/(替补|代班|临时|替上)/i);
    if (tempMatch) {
      isTemporarySubstitute = true;
    }

    const performerMatch = line.match(/(?:表演者|演员|歌手|演奏者|学员)[:：\s]+([^\s,，|]+)/i);
    if (performerMatch) {
      performerName = performerMatch[1].trim();
    } else {
      const nameMatch = line.match(/^\s*(\d+[.、)\s]+)?([^\s,，|：:（(]+)/);
      if (nameMatch && nameMatch[2] && !nameMatch[2].match(/^\d+$/)) {
        performerName = nameMatch[2].trim();
      }
    }
    if (performerName) {
      performerName = performerName.replace(/[（(].*?[）)]/g, '').trim();
    }

    const parts = line.split(/[-—~]/).map((p) => p.trim()).filter((p) => p);
    const partsAfterName = parts.slice(1);

    const songMatch = line.match(/(?:曲目|歌曲|演奏|演唱)[:：\s]+([^\s,，|]+)/i);
    if (songMatch) {
      songName = songMatch[1].trim();
    } else if (partsAfterName.length === 1) {
      songName = partsAfterName[0].split(/[,，|]/)[0].trim();
    } else if (partsAfterName.length >= 2) {
      const firstPart = partsAfterName[0];
      const lastPart = partsAfterName[partsAfterName.length - 1];
      if (isTemporarySubstitute && tempMatch) {
        if (firstPart.match(/(替补|代班|临时|替上)/i)) {
          substituteNote = firstPart;
          songName = lastPart.split(/[,，|]/)[0].trim();
        } else if (lastPart.match(/(替补|代班|临时|替上)/i)) {
          substituteNote = lastPart;
          songName = firstPart.split(/[,，|]/)[0].trim();
        } else {
          songName = lastPart.split(/[,，|]/)[0].trim();
        }
      } else {
        songName = lastPart.split(/[,，|]/)[0].trim();
      }
    }

    if (isTemporarySubstitute && !substituteNote) {
      const noteMatch = line.match(/([^-—~,，|]*?(?:替补|代班|临时|替上)[^-—~,，|]*)/i);
      if (noteMatch) {
        substituteNote = noteMatch[1].trim();
      }
    }

    return {
      originalRowNumber: rowNumber,
      rawContent,
      performerName,
      songName,
      isTemporarySubstitute,
      substituteNote,
      importBatchId: batchId
    };
  });
}

export function importGroupSignupFile(
  store: ReconciliationStore,
  filePath: string,
  operator: string
): { batchId: string; recordCount: number } {
  const batch = store.addBatch({
    source: DataSource.GROUP_SIGNUP,
    fileName: filePath,
    recordCount: 0,
    operator
  });

  const parsedRows = parseGroupSignupFile(filePath, batch.id);
  const records = store.addGroupRecords(parsedRows, batch.id, operator);

  return {
    batchId: batch.id,
    recordCount: records.length
  };
}

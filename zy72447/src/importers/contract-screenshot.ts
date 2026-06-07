import * as fs from 'fs';
import { parse } from 'csv-parse/sync';
import * as XLSX from 'xlsx';
import { DataSource } from '../types';
import { ReconciliationStore } from '../store';

export interface ParsedContractRow {
  rawContent: string;
  performerName?: string;
  songName?: string;
  contractReference?: string;
  performanceDate?: string;
  importBatchId: string;
  sourceFileName?: string;
}

export function parseContractFile(
  filePath: string,
  batchId: string,
  sourceFileName?: string
): ParsedContractRow[] {
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

  return rows.map((row) => {
    const rawContent = row.join(' | ');
    const line = rawContent;

    let performerName: string | undefined;
    let songName: string | undefined;
    let contractReference: string | undefined;
    let performanceDate: string | undefined;

    const performerMatch = line.match(/(?:表演者|演员|歌手|演奏者|学员|乙方)[:：\s]+([^\s,，|]+)/i);
    if (performerMatch) {
      performerName = performerMatch[1].trim();
    } else {
      const nameMatch = line.match(/^\s*(\d+[.、)\s]+)?([^\s,，|：:]+)/);
      if (nameMatch && nameMatch[2] && !nameMatch[2].match(/^\d+$/) && !nameMatch[2].match(/合同|编号|日期|曲目/)) {
        performerName = nameMatch[2].trim();
      }
    }

    const songMatch = line.match(/(?:曲目|歌曲|演奏|演唱|节目)[:：\s]+([^\s,，|]+)/i);
    if (songMatch) {
      songName = songMatch[1].trim();
    }

    const contractMatch = line.match(/(?:合同编号|合同号|编号|NO)[:：\s]+([^\s,，|]+)/i);
    if (contractMatch) {
      contractReference = contractMatch[1].trim();
    }

    const dateMatch = line.match(/(\d{4}[-/年]\d{1,2}[-/月]\d{1,2}日?)/);
    if (dateMatch) {
      performanceDate = dateMatch[1].replace(/年|月/g, '-').replace(/日/g, '');
    }

    return {
      rawContent,
      performerName,
      songName,
      contractReference,
      performanceDate,
      importBatchId: batchId,
      sourceFileName: sourceFileName || filePath
    };
  });
}

export function importContractFile(
  store: ReconciliationStore,
  filePath: string,
  operator: string,
  isLateRefresh: boolean = false
): { batchId: string; recordCount: number; isLateRefresh: boolean } {
  const batch = store.addBatch({
    source: DataSource.CONTRACT_SCREENSHOT,
    fileName: filePath,
    recordCount: 0,
    operator
  });

  const parsedRows = parseContractFile(filePath, batch.id, filePath);
  const records = store.addContractRecords(parsedRows, batch.id, operator);

  return {
    batchId: batch.id,
    recordCount: records.length,
    isLateRefresh
  };
}

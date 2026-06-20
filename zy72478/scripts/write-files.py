
import os
import sys

os.chdir('/Users/lzy/pro/solo/workspaces/zy72478')

store_utils_content = r'''import * as XLSX from 'xlsx';
import type {
  BusSwipeRecord,
  RedlineNote,
  FieldChange,
  DataSource,
  ExportResult,
} from '../../shared/types';
import { LOCATION_TO_AREA } from '../data/mockData';

export function makeBusDedupKey(r: Partial<BusSwipeRecord>): string {
  return r.cardId + '|' + r.swipeTime + '|' + r.route + '|' + r.location;
}

export function diffRedline(before: RedlineNote, after: Partial<RedlineNote>): FieldChange[] {
  const labelMap: Record<string, string> = {
    areaName: '区域名称',
    remark: '备注信息',
    boundaryCoords: '边界坐标',
    recordDate: '记录日期',
    source: '数据口径',
  };
  const changes: FieldChange[] = [];
  for (const key of Object.keys(after) as (keyof RedlineNote)[]) {
    const beforeVal = String(before[key] ?? '');
    const afterVal = String(after[key] ?? '');
    if (beforeVal !== afterVal) {
      changes.push({
        field: key,
        fieldLabel: labelMap[key] || key,
        before: beforeVal,
        after: afterVal,
      });
    }
  }
  return changes;
}

export function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(String(e.target?.result || ''));
    reader.onerror = reject;
    reader.readAsText(file);
  });
}

export function readFileAsArrayBuffer(file: File): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target?.result as ArrayBuffer));
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

export function parseCsvText(text: string): Partial<BusSwipeRecord>[] {
  const lines = text.trim().split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return [];
  const header = lines[0].split(/[,，\t]/).map((h) => h.trim());
  const idx = (name: string) => header.findIndex((h) => h.includes(name));
  const iCard = idx('卡号');
  let iTime = idx('时间');
  if (iTime === -1) iTime = idx('刷卡时间');
  const iRoute = idx('线路');
  let iLoc = idx('站点');
  if (iLoc === -1) iLoc = idx('站点');
  const iArea = idx('区域');
  const iSource = idx('口径');
  const result: Partial<BusSwipeRecord>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(/[,，\t]/).map((c) => c.trim());
    const cardId = cols[iCard >= 0 ? iCard : 0] || '';
    const swipeTime = cols[iTime >= 0 ? iTime : 1] || '';
    const route = cols[iRoute >= 0 ? iRoute : 2] || '';
    const location = cols[iLoc >= 0 ? iLoc : 3] || '';
    const areaName = iArea >= 0 ? cols[iArea] : LOCATION_TO_AREA[location] || '';
    const sourceRaw = iSource >= 0 ? cols[iSource] : 'normal';
    const source: DataSource = sourceRaw.includes('补录') ? 'supplement' : sourceRaw.includes('错') ? 'wrong' : 'normal';
    if (cardId && swipeTime) {
      result.push({ cardId, swipeTime, route, location, areaName, source });
    }
  }
  return result;
}

export function parseExcelData(jsonData: any[]): Partial<BusSwipeRecord>[] {
  return jsonData.map((row: any) => {
    const cardId = String(row['卡号'] || row['cardId'] || '');
    const swipeTime = String(row['刷卡时间'] || row['时间'] || row['swipeTime'] || '');
    const route = String(row['线路'] || row['route'] || '');
    const location = String(row['站点'] || row['location'] || '');
    const areaName = String(row['区域'] || row['areaName'] || LOCATION_TO_AREA[location] || '');
    const sourceRaw = String(row['数据口径'] || row['口径'] || row['source'] || 'normal');
    const source: DataSource = sourceRaw.includes('补录') ? 'supplement' : sourceRaw.includes('错') ? 'wrong' : 'normal';
    return { cardId, swipeTime, route, location, areaName, source };
  }).filter((r) => r.cardId && r.swipeTime);
}

export async function parseCsvFile(file: File): Promise<Partial<BusSwipeRecord>[]> {
  const text = await readFileAsText(file);
  return parseCsvText(text);
}

export async function parseExcelFile(file: File): Promise<Partial<BusSwipeRecord>[]> {
  const buffer = await readFileAsArrayBuffer(file);
  const workbook = XLSX.read(buffer, { type: 'array' });
  const firstSheet = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[firstSheet];
  const jsonData = XLSX.utils.sheet_to_json(worksheet);
  return parseExcelData(jsonData);
}

export function buildExportFile(rows: any[], fileName: string, sheetName: string): ExportResult {
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  const csvContent = XLSX.utils.sheet_to_csv(ws);
  const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const preview = rows.slice(0, 3).map((r) => Object.values(r).join(' | ')).join('\n');
  return {
    success: true,
    fileName: fileName + '_' + new Date().toISOString().slice(0, 10) + '.csv',
    rowCount: rows.length,
    contentPreview: preview,
    downloadUrl: url,
  };
}
'''

with open('src/store/storeUtils.ts', 'w') as f:
    f.write(store_utils_content)

print('storeUtils.ts written successfully')
print(f'Lines: {len(store_utils_content.splitlines())}')

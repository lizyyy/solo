import * as XLSX from 'xlsx';
import { TrackRecord } from '../types';
import { v4 as uuidv4 } from '../utils/uuid';

const FIELD_KEYWORDS: Record<keyof Omit<TrackRecord, 'id' | 'importedAt' | 'lastModifiedAt' | 'validationStatus' | 'validationErrors' | 'modifyHistory' | 'rawData' | 'duplicateGroupId'>, string[]> = {
  teacherName: ['教师姓名', 'teacher', '老师', '姓名', 'instructor'],
  trackName: ['曲目名称', '曲目', 'title', 'song', 'track', '歌曲名称', '作品'],
  authStart: ['授权开始日期', 'start date', '开始时间', 'start', '开始日期', '生效日期'],
  authEnd: ['授权结束日期', 'end date', '结束时间', 'end', '结束日期', '到期日期'],
  tcIn: ['开始时码', '入点', 'start tc', 'tc in', 'start timecode', '开始码', 'in'],
  tcOut: ['结束时码', '出点', 'end tc', 'tc out', 'end timecode', '结束码', 'out'],
  duration: ['课时', '时长', 'duration', 'minutes', '分钟', '时间'],
  remark: ['备注', 'remark', 'note', '说明', '注释'],
  sourceFile: [],
};

function normalizeHeader(header: string): string {
  return header
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[_\-/]/g, '')
    .replace(/（/g, '(')
    .replace(/）/g, ')');
}

function calculateMatchScore(header: string, keywords: string[]): number {
  const normalizedHeader = normalizeHeader(header);
  let maxScore = 0;

  for (const keyword of keywords) {
    const normalizedKeyword = normalizeHeader(keyword);
    if (normalizedHeader === normalizedKeyword) {
      return 1.0;
    }
    if (normalizedHeader.includes(normalizedKeyword) || normalizedKeyword.includes(normalizedHeader)) {
      const overlap = Math.min(normalizedHeader.length, normalizedKeyword.length) / Math.max(normalizedHeader.length, normalizedKeyword.length);
      maxScore = Math.max(maxScore, overlap * 0.8);
    }
  }

  return maxScore;
}

export function mapHeaders(headers: string[]): Map<string, number> {
  const mapping = new Map<string, number>();
  const usedIndices = new Set<number>();

  const fields = Object.keys(FIELD_KEYWORDS) as Array<keyof typeof FIELD_KEYWORDS>;

  for (const field of fields) {
    let bestIndex = -1;
    let bestScore = 0;

    for (let i = 0; i < headers.length; i++) {
      if (usedIndices.has(i)) continue;

      const score = calculateMatchScore(headers[i], FIELD_KEYWORDS[field]);
      if (score > bestScore && score > 0.3) {
        bestScore = score;
        bestIndex = i;
      }
    }

    if (bestIndex >= 0) {
      mapping.set(field, bestIndex);
      usedIndices.add(bestIndex);
    }
  }

  return mapping;
}

function parseDate(value: any): string {
  if (!value) return '';

  if (typeof value === 'number') {
    try {
      const date = XLSX.SSF.parse_date_code(value);
      return `${date.y}-${String(date.m).padStart(2, '0')}-${String(date.d).padStart(2, '0')}`;
    } catch {
      return String(value);
    }
  }

  const strValue = String(value).trim();

  const isoMatch = strValue.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (isoMatch) {
    return `${isoMatch[1]}-${String(isoMatch[2]).padStart(2, '0')}-${String(isoMatch[3]).padStart(2, '0')}`;
  }

  const cnMatch = strValue.match(/^(\d{4})年(\d{1,2})月(\d{1,2})日/);
  if (cnMatch) {
    return `${cnMatch[1]}-${String(cnMatch[2]).padStart(2, '0')}-${String(cnMatch[3]).padStart(2, '0')}`;
  }

  const dotMatch = strValue.match(/^(\d{4})\.(\d{1,2})\.(\d{1,2})/);
  if (dotMatch) {
    return `${dotMatch[1]}-${String(dotMatch[2]).padStart(2, '0')}-${String(dotMatch[3]).padStart(2, '0')}`;
  }

  return strValue;
}

function parseTimecode(value: any): string {
  if (!value) return '';
  const str = String(value).trim();

  const match = str.match(/(\d{1,2})[:\.](\d{2})[:\.](\d{2})/);
  if (match) {
    return `${String(match[1]).padStart(2, '0')}:${match[2]}:${match[3]}`;
  }

  const simpleMatch = str.match(/^(\d+)$/);
  if (simpleMatch && simpleMatch[1].length >= 5) {
    const padded = simpleMatch[1].padStart(6, '0');
    return `${padded.slice(0, 2)}:${padded.slice(2, 4)}:${padded.slice(4, 6)}`;
  }

  return str;
}

function parseDuration(value: any): number {
  if (!value) return 0;
  if (typeof value === 'number') return Math.round(value);
  const str = String(value).trim();
  const num = parseFloat(str);
  return isNaN(num) ? 0 : Math.round(num);
}

export function parseExcelFile(file: File): Promise<{ records: TrackRecord[]; headers: string[] }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' }) as any[][];

        if (jsonData.length === 0) {
          reject(new Error('Excel文件为空'));
          return;
        }

        const headers = (jsonData[0] as string[]).map(h => String(h || ''));
        const headerMapping = mapHeaders(headers);

        const now = Date.now();
        const records: TrackRecord[] = [];

        for (let rowIndex = 1; rowIndex < jsonData.length; rowIndex++) {
          const row = jsonData[rowIndex];
          if (!row || row.every(cell => !cell || String(cell).trim() === '')) continue;

          const rawData: Record<string, any> = {};
          headers.forEach((h, i) => {
            rawData[h] = row[i];
          });

          const getValue = (field: string): any => {
            const idx = headerMapping.get(field);
            return idx !== undefined ? row[idx] : '';
          };

          const record: TrackRecord = {
            id: uuidv4(),
            teacherName: String(getValue('teacherName') || '').trim(),
            trackName: String(getValue('trackName') || '').trim(),
            authStart: parseDate(getValue('authStart')),
            authEnd: parseDate(getValue('authEnd')),
            tcIn: parseTimecode(getValue('tcIn')),
            tcOut: parseTimecode(getValue('tcOut')),
            duration: parseDuration(getValue('duration')),
            remark: String(getValue('remark') || '').trim(),
            sourceFile: file.name,
            importedAt: now,
            lastModifiedAt: now,
            validationStatus: 'normal',
            validationErrors: [],
            modifyHistory: [],
            rawData,
          };

          records.push(record);
        }

        resolve({ records, headers });
      } catch (error) {
        reject(error);
      }
    };

    reader.onerror = () => reject(new Error('文件读取失败'));
    reader.readAsArrayBuffer(file);
  });
}

export function exportToExcel(records: TrackRecord[], filename: string): void {
  const exportData = records.map(r => ({
    '教师姓名': r.teacherName,
    '曲目名称': r.trackName,
    '授权开始日期': r.authStart,
    '授权结束日期': r.authEnd,
    '开始时码': r.tcIn,
    '结束时码': r.tcOut,
    '课时(分钟)': r.duration,
    '备注': r.remark,
    '校验状态': r.validationStatus === 'normal' ? '正常' :
              r.validationStatus === 'auth_expired' ? '授权过期' :
              r.validationStatus === 'tc_mismatch' ? '时码错位' :
              r.validationStatus === 'duplicate' ? '重复曲目' : '脏数据',
    '错误说明': r.validationErrors.map(e => e.message).join('; '),
    '原始文件': r.sourceFile,
    '导入时间': new Date(r.importedAt).toLocaleString('zh-CN'),
    '最后修改': new Date(r.lastModifiedAt).toLocaleString('zh-CN'),
  }));

  const worksheet = XLSX.utils.json_to_sheet(exportData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, '核销结果');

  const colWidths = [
    { wch: 12 },
    { wch: 20 },
    { wch: 14 },
    { wch: 14 },
    { wch: 12 },
    { wch: 12 },
    { wch: 10 },
    { wch: 30 },
    { wch: 10 },
    { wch: 30 },
    { wch: 20 },
    { wch: 20 },
  ];
  worksheet['!cols'] = colWidths;

  XLSX.writeFile(workbook, filename);
}

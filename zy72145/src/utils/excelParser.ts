import * as XLSX from 'xlsx';
import { TrackRecord, FilterState, STATUS_LABELS } from '../types';
import { v4 as uuidv4 } from '../utils/uuid';

type MappedField =
  | 'teacherName'
  | 'trackName'
  | 'authStart'
  | 'authEnd'
  | 'tcIn'
  | 'tcOut'
  | 'duration'
  | 'remark'
  | 'sourceFile';

const FIELD_KEYWORDS: Record<MappedField, string[]> = {
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
      const maxLen = Math.max(normalizedHeader.length, normalizedKeyword.length);
      if (maxLen === 0) continue;
      const overlap = Math.min(normalizedHeader.length, normalizedKeyword.length) / maxLen;
      maxScore = Math.max(maxScore, overlap * 0.8);
    }
  }

  return maxScore;
}

export function mapHeaders(headers: string[]): Map<string, number> {
  const mapping = new Map<string, number>();
  const usedIndices = new Set<number>();

  const fields = Object.keys(FIELD_KEYWORDS) as MappedField[];

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

function parseDate(value: unknown): string {
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

function parseTimecode(value: unknown): string {
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

function parseDuration(value: unknown): number {
  if (!value) return 0;
  if (typeof value === 'number') return Math.round(value);
  const str = String(value).trim();
  const num = parseFloat(str);
  return Number.isNaN(num) ? 0 : Math.round(num);
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
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' }) as unknown[][];

        if (jsonData.length === 0) {
          reject(new Error('Excel文件为空'));
          return;
        }

        const headers = (jsonData[0] as string[]).map((h) => String(h || ''));
        const headerMapping = mapHeaders(headers);

        const now = Date.now();
        const records: TrackRecord[] = [];

        for (let rowIndex = 1; rowIndex < jsonData.length; rowIndex++) {
          const row = jsonData[rowIndex];
          if (!row || row.every((cell) => !cell || String(cell).trim() === '')) continue;

          const rawData: Record<string, unknown> = {};
          headers.forEach((h, i) => {
            rawData[h] = row[i];
          });

          const getValue = (field: string): unknown => {
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

function statusToText(status: TrackRecord['validationStatus']): string {
  return STATUS_LABELS[status] || status;
}

function formatTimestamp(ts: number): string {
  return new Date(ts).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export interface ExportContext {
  filters: FilterState;
  exportedAt: number;
  totalRecordsCount: number;
  filteredRecordsCount: number;
  sourceFiles: string[];
}

function describeFilters(filters: FilterState): string {
  const parts: string[] = [];
  if (filters.status !== 'all') {
    parts.push(`状态: ${STATUS_LABELS[filters.status]}`);
  }
  if (filters.teacherName) {
    parts.push(`教师包含: "${filters.teacherName}"`);
  }
  if (filters.trackName) {
    parts.push(`曲目包含: "${filters.trackName}"`);
  }
  if (filters.dateFrom) {
    parts.push(`授权开始≥: ${filters.dateFrom}`);
  }
  if (filters.dateTo) {
    parts.push(`授权结束≤: ${filters.dateTo}`);
  }
  return parts.length > 0 ? parts.join('； ') : '未设置筛选条件（导出全部数据）';
}

function buildMainSheetData(records: TrackRecord[]) {
  return records.map((r, idx) => ({
    '序号': idx + 1,
    '教师姓名': r.teacherName,
    '曲目名称': r.trackName,
    '授权开始日期': r.authStart,
    '授权结束日期': r.authEnd,
    '开始时码': r.tcIn,
    '结束时码': r.tcOut,
    '课时(分钟)': r.duration,
    '当前备注': r.remark,
    '备注修改次数': r.modifyHistory.length,
    '最近一次备注修改':
      r.modifyHistory.length > 0
        ? formatTimestamp(r.modifyHistory[r.modifyHistory.length - 1].timestamp)
        : '',
    '校验状态': statusToText(r.validationStatus),
    '问题详情': r.validationErrors.map((e) => e.message).join('； '),
    '原始来源文件': r.sourceFile,
    '导入时间': formatTimestamp(r.importedAt),
    '数据最后修改时间': formatTimestamp(r.lastModifiedAt),
    '记录唯一ID': r.id,
  }));
}

function buildRemarkHistorySheetData(records: TrackRecord[]) {
  const rows: Record<string, unknown>[] = [];
  records.forEach((r) => {
    if (r.modifyHistory.length === 0) {
      rows.push({
        '记录ID': r.id,
        '教师姓名': r.teacherName,
        '曲目名称': r.trackName,
        '修改序号': '-',
        '修改时间': '-',
        '修改前文本': '',
        '修改后文本': r.remark,
        '变更差异说明': '初始备注' in r.rawData ? '导入时已有备注' : '无修改历史',
      });
    } else {
      r.modifyHistory.forEach((entry, idx) => {
        rows.push({
          '记录ID': r.id,
          '教师姓名': r.teacherName,
          '曲目名称': r.trackName,
          '修改序号': idx + 1,
          '修改时间': formatTimestamp(entry.timestamp),
          '修改前文本': entry.oldRemark || '(空)',
          '修改后文本': entry.newRemark || '(空)',
          '变更差异说明': entry.diff,
        });
      });
    }
  });
  return rows;
}

function buildReportSheetData(ctx: ExportContext): Array<Array<Record<string, unknown>>> {
  const rows: Array<Array<Record<string, unknown>>> = [];
  rows.push([{ '核销导出报告': '音乐教师课时核销 — 导出报告' }]);
  rows.push([{ '项目': '值' }]);
  rows.push([{ '导出时间': formatTimestamp(ctx.exportedAt) }]);
  rows.push([{ '导出记录数': ctx.filteredRecordsCount }]);
  rows.push([{ '总记录数(含未筛选)': ctx.totalRecordsCount }]);
  rows.push([{ '筛选条件说明': describeFilters(ctx.filters) }]);
  rows.push([{ '状态筛选': STATUS_LABELS[ctx.filters.status] }]);
  rows.push([{ '教师姓名搜索': ctx.filters.teacherName || '(未设置)' }]);
  rows.push([{ '曲目名称搜索': ctx.filters.trackName || '(未设置)' }]);
  rows.push([{ '授权开始日期从': ctx.filters.dateFrom || '(未设置)' }]);
  rows.push([{ '授权结束日期至': ctx.filters.dateTo || '(未设置)' }]);
  rows.push([{ '涉及原始文件': ctx.sourceFiles.join('； ') }]);
  rows.push([{ '备注': '本Excel包含三个工作表：【核销结果】当前筛选清单、【备注修改历史】逐条改前改后差异、【导出报告】触发导出时的筛选条件与统计信息，便于后续复核与交接。' }]);

  return rows;
}

export function exportToExcel(
  records: TrackRecord[],
  filename: string,
  context: ExportContext
): void {
  const mainData = buildMainSheetData(records);
  const historyData = buildRemarkHistorySheetData(records);
  const reportData = buildReportSheetData(context);

  const mainWs = XLSX.utils.json_to_sheet(mainData);
  const historyWs = XLSX.utils.json_to_sheet(historyData);
  const reportWs = XLSX.utils.aoa_to_sheet(reportData);

  mainWs['!cols'] = [
    { wch: 6 },
    { wch: 14 },
    { wch: 22 },
    { wch: 14 },
    { wch: 14 },
    { wch: 12 },
    { wch: 12 },
    { wch: 10 },
    { wch: 36 },
    { wch: 12 },
    { wch: 22 },
    { wch: 12 },
    { wch: 48 },
    { wch: 28 },
    { wch: 22 },
    { wch: 22 },
    { wch: 38 },
  ];

  historyWs['!cols'] = [
    { wch: 38 },
    { wch: 14 },
    { wch: 22 },
    { wch: 10 },
    { wch: 22 },
    { wch: 36 },
    { wch: 36 },
    { wch: 40 },
  ];

  reportWs['!cols'] = [{ wch: 30 }, { wch: 100 }];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, mainWs, '核销结果');
  XLSX.utils.book_append_sheet(workbook, historyWs, '备注修改历史');
  XLSX.utils.book_append_sheet(workbook, reportWs, '导出报告');

  XLSX.writeFile(workbook, filename);
}

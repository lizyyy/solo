import * as XLSX from 'xlsx';
import type { SourceType, EmotionTag } from '../types';

export interface ParsedRow {
  fileName: string;
  trackName: string;
  emotionTag: EmotionTag;
  source: SourceType;
  remark: string;
  originalSource: string;
  authorizationDate?: string;
  timecode?: string;
}

const COLUMN_MAPS: Record<string, string[]> = {
  fileName: ['文件名', '文件名称', 'filename', 'file_name', '音频文件', '音频文件名'],
  trackName: ['曲目名称', '曲目名', '曲名', 'trackname', 'track_name', '名称', '标题'],
  emotionTag: ['情绪标签', '情绪', '标签', 'emotion', 'emotion_tag'],
  remark: ['备注', '说明', '批注', 'remark', 'note', '描述'],
  authorizationDate: ['授权日期', '到期日期', '有效期', 'auth_date', 'expire', 'expiry_date'],
  timecode: ['时码', '时间码', '时长', 'timecode', 'duration', '时间'],
};

const normalizeHeader = (h: string): string => {
  const trimmed = h.trim();
  for (const [key, aliases] of Object.entries(COLUMN_MAPS)) {
    if (aliases.includes(trimmed.toLowerCase()) || aliases.includes(trimmed)) {
      return key;
    }
  }
  return trimmed;
};

const isValidEmotionTag = (val: string): val is EmotionTag => {
  return ['欢快', '舒缓', '紧张', '悲伤', '激昂', '温馨', '神秘', '其他'].includes(val);
};

const normalizeDateValue = (val: string): string => {
  if (!val) return '';
  if (/^\d{4}-\d{2}-\d{2}/.test(val)) return val.substring(0, 10);
  const num = Number(val);
  if (!isNaN(num) && num > 30000 && num < 60000) {
    const epoch = new Date((num - 25569) * 86400 * 1000);
    const y = epoch.getFullYear();
    const m = String(epoch.getMonth() + 1).padStart(2, '0');
    const d = String(epoch.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  return val;
};

const guessSourceByFileName = (name: string): SourceType => {
  const ext = name.split('.').pop()?.toLowerCase() || '';
  if (['wav', 'mp3', 'aiff', 'flac', 'ogg', 'aac', 'm4a', 'wma'].includes(ext)) return '音频文件';
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'heic'].includes(ext)) return '合同截图';
  return '曲目表';
};

const isImageFile = (file: File): boolean => {
  if (file.type && file.type.startsWith('image/')) return true;
  const ext = file.name.split('.').pop()?.toLowerCase() || '';
  return ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'heic'].includes(ext);
};

const isSpreadsheetFile = (file: File): boolean => {
  const ext = file.name.split('.').pop()?.toLowerCase() || '';
  return ['xlsx', 'xls', 'csv'].includes(ext);
};

const isTextFile = (file: File): boolean => {
  const ext = file.name.split('.').pop()?.toLowerCase() || '';
  return ['txt', 'text', 'lst', 'md'].includes(ext);
};

export const parseExcelOrCsv = (file: File): Promise<ParsedRow[]> => {
  const ext = file.name.split('.').pop()?.toLowerCase() || '';
  const isCsv = ext === 'csv';

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        let workbook: XLSX.WorkBook;

        if (isCsv) {
          const text = e.target?.result as string;
          workbook = XLSX.read(text, { type: 'string' });
        } else {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          workbook = XLSX.read(data, { type: 'array' });
        }

        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json<Record<string, string>>(sheet, { defval: '' });

        if (jsonData.length === 0) {
          reject(new Error('文件内容为空'));
          return;
        }

        const headers = Object.keys(jsonData[0]);
        const mappedHeaders = headers.map(normalizeHeader);

        const rows = jsonData.flatMap((row, idx): ParsedRow[] => {
          const mapped: Record<string, string> = {};
          headers.forEach((h, i) => {
            mapped[mappedHeaders[i]] = String(row[h] || '').trim();
          });

          const fileName = mapped.fileName || '';
          const trackName = mapped.trackName || '';

          if (!fileName && !trackName) return [];

          return [{
            fileName: fileName || `未知文件_${idx + 1}`,
            trackName: trackName || fileName || `未知曲目_${idx + 1}`,
            emotionTag: isValidEmotionTag(mapped.emotionTag || '') ? (mapped.emotionTag as EmotionTag) : '',
            source: '曲目表' as SourceType,
            remark: mapped.remark || '',
            originalSource: `导入自文件：${file.name}，第${idx + 2}行`,
            authorizationDate: normalizeDateValue(mapped.authorizationDate) || undefined,
            timecode: mapped.timecode || undefined,
          }];
        });

        resolve(rows);
      } catch (err) {
        reject(new Error(`解析文件出错：${err instanceof Error ? err.message : String(err)}`));
      }
    };
    reader.onerror = () => reject(new Error('读取文件失败'));

    if (isCsv) {
      reader.readAsText(file, 'utf-8');
    } else {
      reader.readAsArrayBuffer(file);
    }
  });
};

export const parseTextFileList = (file: File): Promise<ParsedRow[]> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const lines = text.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0 && !l.startsWith('#'));

        if (lines.length === 0) {
          reject(new Error('文件内容为空'));
          return;
        }

        const rows = lines.flatMap((line, idx): ParsedRow[] => {
          const parts = line.split(/[,\t;|]/).map((p) => p.trim());
          const fileName = parts[0] || '';
          const trackName = parts[1] || '';

          if (!fileName) return [];

          return [{
            fileName,
            trackName: trackName || fileName.replace(/\.[^.]+$/, ''),
            emotionTag: '',
            source: guessSourceByFileName(fileName),
            remark: '',
            originalSource: `导入自文件清单：${file.name}，第${idx + 1}行`,
          }];
        });

        resolve(rows);
      } catch (err) {
        reject(new Error(`解析文件出错：${err instanceof Error ? err.message : String(err)}`));
      }
    };
    reader.onerror = () => reject(new Error('读取文件失败'));
    reader.readAsText(file);
  });
};

export const parseFile = (file: File): Promise<ParsedRow[]> => {
  const ext = file.name.split('.').pop()?.toLowerCase() || '';
  const excelExts = ['xlsx', 'xls'];
  const csvExts = ['csv'];
  const textExts = ['txt', 'text', 'lst', 'md'];

  if (excelExts.includes(ext) || csvExts.includes(ext)) {
    return parseExcelOrCsv(file);
  }

  if (textExts.includes(ext)) {
    return parseTextFileList(file);
  }

  if (isImageFile(file)) {
    return parseImageFile(file);
  }

  return parseTextFileList(file);
};

export const parseImageFile = (file: File): Promise<ParsedRow[]> => {
  return new Promise((resolve) => {
    const trackName = file.name.replace(/\.[^.]+$/, '') || '未命名截图';
    resolve([{
      fileName: file.name,
      trackName,
      emotionTag: '',
      source: '合同截图',
      remark: '图片附件：请人工复核截图内容',
      originalSource: `合同截图导入：${file.name}（截图解析仅保留附件记录，异常与标签需人工核对）`,
    }]);
  });
};

export interface ParsedFileResult {
  file: File;
  rows: ParsedRow[];
  error?: string;
}

export const parseFiles = async (files: FileList | File[]): Promise<ParsedFileResult[]> => {
  const fileArray = Array.from(files);
  const results: ParsedFileResult[] = [];

  for (const file of fileArray) {
    try {
      if (isSpreadsheetFile(file) || isTextFile(file)) {
        const rows = await parseFile(file);
        results.push({ file, rows });
      } else if (isImageFile(file)) {
        const rows = await parseImageFile(file);
        results.push({ file, rows });
      } else {
        results.push({
          file,
          rows: [],
          error: `不支持的文件类型 "${file.name.split('.').pop() || ''}"，当前支持 CSV/Excel/TXT/图片`,
        });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : '未知错误';
      results.push({ file, rows: [], error: msg });
    }
  }

  return results;
};

export const flattenParsedResults = (results: ParsedFileResult[]): ParsedRow[] => {
  return results.flatMap((r) => r.rows);
};

export const getAcceptedExtensions = (): string => {
  return '.csv,.xlsx,.xls,.txt,.text,.lst,.md,.png,.jpg,.jpeg,.gif,.webp,.bmp,.heic';
};

export const getAcceptedMimeTypes = (): string => {
  return '.csv,.xlsx,.xls,.txt,.text,.lst,.md,image/*';
};

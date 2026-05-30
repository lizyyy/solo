import Papa from 'papaparse';
import fs from 'fs';
import path from 'path';
import type { RawTrack, ParseWarning } from './models.js';

const FIELD_ALIASES: Record<string, string[]> = {
  title: ['title', 'track', 'song', 'name', 'track_title', 'song_name'],
  artist: ['artist', 'artist_name', 'performer', 'dj'],
  bpm: ['bpm', 'tempo', 'beats_per_minute', 'bpm_analyzed'],
  key: ['key', 'tonality', 'musical_key', 'key_signature', 'harmonic_key', 'camelot'],
  energy: ['energy', 'energy_level', 'intensity', 'e_level'],
  album: ['album', 'release', 'album_title'],
  genre: ['genre', 'style', 'category'],
  year: ['year', 'date', 'release_year'],
  source: ['source', 'software', 'origin', 'from'],
};

function normalizeFieldName(header: string): string | null {
  const h = header.toLowerCase().trim().replace(/[\s_-]+/g, '_');
  for (const [canonical, aliases] of Object.entries(FIELD_ALIASES)) {
    if (aliases.includes(h) || h === canonical) return canonical;
  }
  return null;
}

function parseFlexibleValue(raw: string | undefined | null): string | undefined {
  if (raw === undefined || raw === null) return undefined;
  const s = String(raw).trim();
  if (s === '' || s === '-' || s === 'N/A' || s === 'n/a' || s === 'null' || s === 'NULL' || s === 'undefined') return undefined;
  return s;
}

export interface ParseResult {
  tracks: RawTrack[];
  warnings: ParseWarning[];
  totalRows: number;
  successfulRows: number;
}

function mapRowToRawTrack(row: Record<string, unknown>, rowIndex: number): { track: RawTrack; warnings: ParseWarning[] } {
  const warnings: ParseWarning[] = [];
  const track: RawTrack = {};

  for (const [rawHeader, value] of Object.entries(row)) {
    const field = normalizeFieldName(rawHeader);
    if (!field) continue;
    const parsed = parseFlexibleValue(value as string);
    if (parsed !== undefined) {
      track[field] = parsed;
    }
  }

  if (!track.title && !track.artist) {
    warnings.push({
      rowIndex,
      rawLine: JSON.stringify(row).slice(0, 200),
      field: 'title/artist',
      message: '行缺少标题和艺术家，跳过',
      severity: 'warn',
    });
    return { track: {} as RawTrack, warnings };
  }

  if (!track.title) track.title = '(未知标题)';
  if (!track.artist) track.artist = '(未知艺术家)';

  return { track, warnings };
}

export function parseCSV(filePath: string): ParseResult {
  const content = fs.readFileSync(filePath, 'utf-8');
  const result: ParseResult = {
    tracks: [],
    warnings: [],
    totalRows: 0,
    successfulRows: 0,
  };

  const parsed = Papa.parse(content, {
    header: true,
    skipEmptyLines: 'greedy',
    transformHeader: (h: string) => h,
  });

  result.totalRows = parsed.data.length;

  for (let i = 0; i < parsed.data.length; i++) {
    const row = parsed.data[i] as Record<string, unknown>;
    if (!row || typeof row !== 'object') continue;

    const { track, warnings } = mapRowToRawTrack(row, i);
    result.warnings.push(...warnings);

    if (track.title || track.artist) {
      result.tracks.push(track);
      result.successfulRows++;
    }
  }

  for (const err of parsed.errors) {
    result.warnings.push({
      rowIndex: err.row ?? -1,
      rawLine: '',
      field: err.type || 'parse',
      message: `CSV解析错误: ${err.message}`,
      severity: 'error',
    });
  }

  return result;
}

export function parseJSON(filePath: string): ParseResult {
  const content = fs.readFileSync(filePath, 'utf-8');
  const result: ParseResult = {
    tracks: [],
    warnings: [],
    totalRows: 0,
    successfulRows: 0,
  };

  let data: unknown;
  try {
    data = JSON.parse(content);
  } catch (e) {
    result.warnings.push({
      rowIndex: 0,
      rawLine: content.slice(0, 200),
      field: 'json',
      message: `JSON解析失败: ${(e as Error).message}`,
      severity: 'error',
    });
    return result;
  }

  const items: unknown[] = Array.isArray(data) ? data : [data];
  result.totalRows = items.length;

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (!item || typeof item !== 'object') {
      result.warnings.push({
        rowIndex: i,
        rawLine: String(item).slice(0, 100),
        field: 'format',
        message: '非对象行，跳过',
        severity: 'warn',
      });
      continue;
    }

    const { track, warnings } = mapRowToRawTrack(item as Record<string, unknown>, i);
    result.warnings.push(...warnings);

    if (track.title || track.artist) {
      result.tracks.push(track);
      result.successfulRows++;
    }
  }

  return result;
}

export function parseFile(filePath: string): ParseResult {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.csv' || ext === '.tsv') {
    return parseCSV(filePath);
  } else if (ext === '.json') {
    return parseJSON(filePath);
  } else {
    const result: ParseResult = { tracks: [], warnings: [], totalRows: 0, successfulRows: 0 };
    result.warnings.push({
      rowIndex: 0,
      rawLine: filePath,
      field: 'file',
      message: `不支持的文件格式: ${ext}，尝试按CSV解析`,
      severity: 'warn',
    });
    return parseCSV(filePath);
  }
}

export function parseFiles(filePaths: string[]): ParseResult {
  const combined: ParseResult = {
    tracks: [],
    warnings: [],
    totalRows: 0,
    successfulRows: 0,
  };

  for (const fp of filePaths) {
    if (!fs.existsSync(fp)) {
      combined.warnings.push({
        rowIndex: 0,
        rawLine: fp,
        field: 'file',
        message: `文件不存在: ${fp}`,
        severity: 'error',
      });
      continue;
    }

    const result = parseFile(fp);
    combined.tracks.push(...result.tracks);
    combined.warnings.push(...result.warnings);
    combined.totalRows += result.totalRows;
    combined.successfulRows += result.successfulRows;
  }

  return combined;
}

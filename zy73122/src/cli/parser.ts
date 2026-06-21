import fs from 'node:fs';
import path from 'node:path';
import { parseLatitude, parseLongitude } from '../utils/coordinate';
import type { BadRow, RawLogRow, ValidatedRow } from './types';

export type LogFormat = 'csv' | 'json';

export function detectFormat(filePath: string): LogFormat {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.json') return 'json';
  return 'csv';
}

export function readLogFile(filePath: string): string {
  return fs.readFileSync(filePath, 'utf-8');
}

function parseCSV(content: string): RawLogRow[] {
  const lines = content.split(/\r?\n/).filter(l => l.trim().length > 0);
  if (lines.length === 0) return [];

  const headers = splitCSVLine(lines[0]);
  const rows: RawLogRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = splitCSVLine(lines[i]);
    const raw: Record<string, string> = {};
    for (let j = 0; j < headers.length; j++) {
      raw[headers[j].trim()] = (values[j] || '').trim();
    }
    rows.push({ lineNumber: i + 1, raw });
  }
  return rows;
}

function splitCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

function parseJSON(content: string): RawLogRow[] {
  const parsed = JSON.parse(content);
  const arr = Array.isArray(parsed) ? parsed : [parsed];
  return arr.map((item, idx) => ({
    lineNumber: idx + 2,
    raw: Object.fromEntries(
      Object.entries(item as Record<string, unknown>).map(([k, v]) => [k, String(v ?? '')]),
    ),
  }));
}

export function parseLog(content: string, format: LogFormat): RawLogRow[] {
  if (format === 'json') return parseJSON(content);
  return parseCSV(content);
}

const FIELD_ALIASES: Record<string, string[]> = {
  buoyId: ['浮标编号', 'buoyId', 'buoy_id', 'buoy', '编号', '浮标'],
  recordTime: ['记录时间', 'recordTime', 'record_time', 'time', '时间', '观测时间'],
  latitude: ['纬度', 'latitude', 'lat', 'latRaw', 'lat_raw'],
  longitude: ['经度', 'longitude', 'lon', 'lng', 'lonRaw', 'lon_raw'],
  seaState: ['海况等级', 'seaState', 'sea_state', '海况', '等级'],
  waveHeight: ['波高', 'waveHeight', 'wave_height', '波高(m)', '波高（m）'],
  windSpeed: ['风速', 'windSpeed', 'wind_speed', '风速(m/s)', '风速（m/s）'],
  logPage: ['记录本页码', 'logPage', 'log_page', '页码', '页'],
  manualRemark: ['人工备注', 'manualRemark', 'manual_remark', '备注', 'remark', '说明'],
};

function pickField(raw: Record<string, string>, field: string): string | undefined {
  const aliases = FIELD_ALIASES[field] || [field];
  for (const alias of aliases) {
    if (raw[alias] !== undefined && raw[alias] !== '') {
      return raw[alias];
    }
  }
  return undefined;
}

export function validateRows(rows: RawLogRow[]): { valid: ValidatedRow[]; bad: BadRow[] } {
  const valid: ValidatedRow[] = [];
  const bad: BadRow[] = [];

  for (const row of rows) {
    const errors: string[] = [];
    const { raw, lineNumber } = row;

    const buoyId = pickField(raw, 'buoyId');
    const recordTime = pickField(raw, 'recordTime');
    const latRaw = pickField(raw, 'latitude');
    const lonRaw = pickField(raw, 'longitude');
    const seaStateStr = pickField(raw, 'seaState');
    const waveHeightStr = pickField(raw, 'waveHeight');
    const windSpeedStr = pickField(raw, 'windSpeed');
    const logPage = pickField(raw, 'logPage') || `第${Math.ceil(lineNumber / 10)}页`;
    const manualRemark = pickField(raw, 'manualRemark');

    if (!buoyId) errors.push('缺少浮标编号');
    if (!recordTime) errors.push('缺少记录时间');
    if (!latRaw) errors.push('缺少纬度');
    if (!lonRaw) errors.push('缺少经度');
    if (!seaStateStr) errors.push('缺少海况等级');
    if (!waveHeightStr) errors.push('缺少波高');
    if (!windSpeedStr) errors.push('缺少风速');

    let parsedTime: Date | null = null;
    if (recordTime) {
      parsedTime = new Date(recordTime);
      if (isNaN(parsedTime.getTime())) {
        errors.push(`记录时间格式无效: "${recordTime}"`);
      }
    }

    let latitude = 0;
    let longitude = 0;
    if (latRaw) {
      latitude = parseLatitude(latRaw);
      if (latitude === 0 && !latRaw.includes('0')) {
        errors.push(`纬度解析失败: "${latRaw}"`);
      }
    }
    if (lonRaw) {
      longitude = parseLongitude(lonRaw);
      if (longitude === 0 && !lonRaw.includes('0')) {
        errors.push(`经度解析失败: "${lonRaw}"`);
      }
    }

    let seaState = 0;
    if (seaStateStr) {
      seaState = Number(seaStateStr);
      if (isNaN(seaState) || seaState < 0 || seaState > 9) {
        errors.push(`海况等级超出有效范围(0-9): "${seaStateStr}"`);
      }
    }

    let waveHeight = 0;
    if (waveHeightStr) {
      waveHeight = Number(waveHeightStr);
      if (isNaN(waveHeight) || waveHeight < 0) {
        errors.push(`波高应为非负数: "${waveHeightStr}"`);
      }
    }

    let windSpeed = 0;
    if (windSpeedStr) {
      windSpeed = Number(windSpeedStr);
      if (isNaN(windSpeed) || windSpeed < 0) {
        errors.push(`风速应为非负数: "${windSpeedStr}"`);
      }
    }

    if (errors.length > 0) {
      bad.push({ lineNumber, raw, errors });
      continue;
    }

    const isBoundaryNote = manualRemark?.includes('边界') ?? false;
    const isCloudOccludedNote = manualRemark?.includes('云遮挡') ?? false;

    valid.push({
      lineNumber,
      buoyId: buoyId!,
      recordTime: parsedTime!.toISOString(),
      latRaw: latRaw!,
      lonRaw: lonRaw!,
      latitude,
      longitude,
      seaState,
      waveHeight,
      windSpeed,
      logPage,
      manualRemark: manualRemark || undefined,
      isBoundaryNote,
      isCloudOccludedNote,
    });
  }

  return { valid, bad };
}

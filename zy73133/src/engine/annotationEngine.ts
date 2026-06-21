import type {
  RawBuoyLog,
  BuoyRecord,
  TideStationAnnotation,
  AnnotationStatus,
  CsvRow,
  NormalizedCoordinates,
  NormalizedTide,
} from './types';
import { generateId } from './types';
import { parseCoordinates } from './coordinateParser';
import { normalizeTide, tideToOriginalString } from './tideNormalizer';

const LOG_PATTERNS: RegExp[] = [
  /^(?<timestamp>[\d\- :T]+)\s+(?<lat>[NSns\-+\d\s°'′"″.,]+?)\s*[,/\s]\s*(?<lng>[EWew\-+\d\s°'′"″.,]+?)\s+(?<station>[\u4e00-\u9fa5A-Za-z0-9_\-]+站?)\s+潮位[：:]\s*(?<tide_val>-?\d+\.?\d*)\s*(?<tide_unit>[a-zA-Z\u4e00-\u9fa5]*)\s*(?<extra>.*)$/,
  /^(?<station>[\u4e00-\u9fa5A-Za-z0-9_\-]+站?)\s+(?<timestamp>[\d\- :T]+)\s+纬[：:]\s*(?<lat>[NSns\-+\d\s°'′"″.,]+?)\s+经[：:]\s*(?<lng>[EWew\-+\d\s°'′"″.,]+?)\s+潮[：:]\s*(?<tide_val>-?\d+\.?\d*)\s*(?<tide_unit>[a-zA-Z\u4e00-\u9fa5]*)\s*(?<extra>.*)$/,
];

interface FallbackFields {
  timestamp: string;
  lat: string;
  lng: string;
  tideVal: string;
  tideUnit: string;
}

function fallbackExtractFields(rawText: string): FallbackFields {
  const tokens = rawText.trim().split(/\s+/);
  const result: FallbackFields = { timestamp: '', lat: '', lng: '', tideVal: '', tideUnit: '' };

  for (const tok of tokens) {
    if (/^\d{4}[-:]\d{2}/.test(tok)) {
      result.timestamp = result.timestamp ? `${result.timestamp} ${tok}` : tok;
    } else if (!result.lat && (/[NnSs]$/.test(tok) || /^[-+]?\d+\.?\d*$/.test(tok))) {
      result.lat = tok;
    } else if (!result.lng && (/[EeWw]$/.test(tok) || /^[-+]?\d+\.?\d*$/.test(tok))) {
      result.lng = tok;
    }
  }

  const tideMatch = rawText.match(/潮位[：:]\s*(-?\d+\.?\d*)\s*([a-zA-Z\u4e00-\u9fa5]*)/);
  if (tideMatch) {
    result.tideVal = tideMatch[1];
    result.tideUnit = tideMatch[2];
  }

  const coordMatch = rawText.match(/([NSns\-+\d\s°'′"″.,]+?)\s*[,/\s]\s*([EWew\-+\d\s°'′"″.,/]+)/);
  if (coordMatch) {
    result.lat = coordMatch[1].trim() || result.lat;
    result.lng = coordMatch[2].trim() || result.lng;
  }

  return result;
}

export function parseBuoyLogLine(rawText: string, sourceFile: string, lineNumber: number): RawBuoyLog {
  for (const pattern of LOG_PATTERNS) {
    const m = rawText.trim().match(pattern);
    if (m && m.groups) {
      const g = m.groups;
      const warnings: string[] = [];
      const extra = (g.extra || '').trim();
      if (extra) warnings.push(`附加内容未解析: ${extra}`);
      return {
        logId: generateId('log'),
        rawText,
        rawLatitude: (g.lat || '').trim(),
        rawLongitude: (g.lng || '').trim(),
        rawTideValue: (g.tide_val || '').trim(),
        rawTideUnit: (g.tide_unit || '').trim(),
        timestamp: (g.timestamp || '').trim(),
        sourceFile,
        lineNumber,
        parseWarnings: warnings,
      };
    }
  }

  const fb = fallbackExtractFields(rawText);
  const warnings = ['日志行格式不匹配任何已知模式，使用备用提取'];
  if (!fb.lat || !fb.lng) warnings.push('备用提取未能定位完整经纬度，原始文本已保留');
  return {
    logId: generateId('log'),
    rawText,
    rawLatitude: fb.lat,
    rawLongitude: fb.lng,
    rawTideValue: fb.tideVal,
    rawTideUnit: fb.tideUnit,
    timestamp: fb.timestamp,
    sourceFile,
    lineNumber,
    parseWarnings: warnings,
  };
}

export function buildBuoyRecord(rawLog: RawBuoyLog): BuoyRecord {
  const errors: string[] = [];
  let isValid = true;

  let coords: NormalizedCoordinates | null = null;
  try {
    coords = parseCoordinates(rawLog.rawLatitude, rawLog.rawLongitude);
    if (coords && coords.parseNotes.some((n) => n.includes('无法解析'))) {
      isValid = false;
      errors.push(`坐标解析失败: ${coords.parseNotes.filter((n) => n.includes('无法解析')).join('; ')}`);
    }
    if (coords && (coords.latitude == null || coords.longitude == null)) {
      isValid = false;
    }
  } catch (e) {
    errors.push(`坐标解析异常: ${String(e)}`);
    isValid = false;
  }

  let tide: NormalizedTide | null = null;
  try {
    tide = normalizeTide(rawLog.rawTideValue, rawLog.rawTideUnit);
    if (tide && tide.originalUnit === 'unknown' && !rawLog.rawTideValue) {
      isValid = false;
      errors.push('潮位值缺失，无法解析');
    }
    if (tide && tide.valueMeters == null) {
      isValid = false;
      errors.push('潮位数值无法识别');
    }
  } catch (e) {
    errors.push(`潮位解析异常: ${String(e)}`);
    isValid = false;
  }

  for (const w of rawLog.parseWarnings) {
    errors.push(`[原始日志警告] ${w}`);
    if (w.includes('格式不匹配') || w.includes('未能定位完整经纬度')) {
      isValid = false;
    }
  }

  return {
    recordId: generateId('rec'),
    rawLog,
    coordinates: coords,
    tide,
    parseErrors: errors,
    isValid,
  };
}

export function assessTideLevel(valueM: number | null): string {
  if (valueM == null) return '未知';
  if (valueM >= 3.5) return '超高潮';
  if (valueM >= 2.5) return '高潮位';
  if (valueM >= 1.0) return '中潮位';
  if (valueM >= 0.0) return '低潮位';
  return '负潮位';
}

interface UnifiedData {
  stationName: string;
  timestamp: string;
  latitudeDecimal: string;
  longitudeDecimal: string;
  latitudeOriginal: string;
  longitudeOriginal: string;
  coordinateFormat: string;
  tideMeters: string;
  tideOriginal: string;
  tideLevel: string;
  tideUnitRaw: string;
  issues: string[];
  remarks: string;
  rawText: string;
  sourceRef: string;
  recordId: string;
  logId: string;
}

function unifiedDataSource(record: BuoyRecord, remarks: string[]): UnifiedData {
  const raw = record.rawLog;
  const coords = record.coordinates;
  const tide = record.tide;

  const latStr = coords && coords.latitude != null ? coords.latitude.toFixed(6) : 'PARSE_FAILED';
  const lngStr = coords && coords.longitude != null ? coords.longitude.toFixed(6) : 'PARSE_FAILED';
  const coordFmt = coords ? coords.originalFormat : 'unknown';

  const latitudeOriginal = coords && coords.rawLatitude ? coords.rawLatitude : raw.rawLatitude;
  const longitudeOriginal = coords && coords.rawLongitude ? coords.rawLongitude : raw.rawLongitude;

  const tideMStr = tide && tide.valueMeters != null ? tide.valueMeters.toFixed(4) : 'PARSE_FAILED';
  const tideOriginal = tide ? tideToOriginalString(tide) : `${raw.rawTideValue} ${raw.rawTideUnit}`.trim() || 'N/A';
  const tideLevel = assessTideLevel(tide ? tide.valueMeters : null);

  let stationName = '未知站';
  const stationMatch = raw.rawText.match(/([\u4e00-\u9fa5A-Za-z0-9_\-]+站)/);
  if (stationMatch) {
    stationName = stationMatch[1];
  } else {
    const parts = raw.rawText.trim().split(/\s+/);
    if (parts.length >= 3) stationName = parts[2];
  }

  const issues: string[] = [];
  if (!record.isValid) issues.push('记录存在解析错误，需人工核查');
  if (coords) issues.push(...coords.parseNotes);
  if (tide) issues.push(...tide.normalizeNotes);
  issues.push(...record.parseErrors);

  const remarkText = remarks.length ? remarks.join('；') : '无';

  return {
    stationName,
    timestamp: raw.timestamp || '未知时间',
    latitudeDecimal: latStr,
    longitudeDecimal: lngStr,
    latitudeOriginal,
    longitudeOriginal,
    coordinateFormat: coordFmt,
    tideMeters: tideMStr,
    tideOriginal,
    tideLevel,
    tideUnitRaw: tide ? tide.originalUnitRaw : raw.rawTideUnit,
    issues,
    remarks: remarkText,
    rawText: raw.rawText,
    sourceRef: `${raw.sourceFile}:${raw.lineNumber}`,
    recordId: record.recordId,
    logId: raw.logId,
  };
}

function buildSceneAnnotation(data: UnifiedData): string {
  const hasError = data.issues.some((i) => i.includes('解析错误') || i.includes('解析失败') || i.includes('EXCEPTION'));
  const parts: string[] = [`【${data.stationName}】潮汐能站空间标注`];
  if (hasError) parts.push(`[异常] 原始浮标日志: ${data.rawText}`);
  parts.push(`时间: ${data.timestamp}`);
  parts.push(`位置: (${data.latitudeDecimal}°N, ${data.longitudeDecimal}°E)`);
  parts.push(`原始坐标: ${data.latitudeOriginal}, ${data.longitudeOriginal} (格式: ${data.coordinateFormat})`);
  parts.push(`潮位: ${data.tideMeters} m（原始: ${data.tideOriginal}），判定为【${data.tideLevel}】`);
  if (data.remarks && data.remarks !== '无') parts.push(`备注: ${data.remarks}`);
  if (data.issues.length) parts.push(`线索提示: ${data.issues.slice(0, 3).join('；')}`);
  return parts.join(' | ');
}

function buildSideNote(data: UnifiedData): string {
  const lines = [
    `站点名: ${data.stationName}`,
    `记录时间: ${data.timestamp}`,
    `标准化坐标: ${data.latitudeDecimal}, ${data.longitudeDecimal}`,
    `原始坐标写法: ${data.latitudeOriginal} / ${data.longitudeOriginal}`,
    `坐标原始格式: ${data.coordinateFormat}`,
    `标准化潮位: ${data.tideMeters} m`,
    `原始潮位写法: ${data.tideOriginal}`,
    `潮位等级判定: ${data.tideLevel}`,
    `浮标日志来源: ${data.sourceRef}`,
    `原始浮标日志全文: ${data.rawText}`,
  ];
  if (data.remarks && data.remarks !== '无') lines.push(`人工备注: ${data.remarks}`);
  if (data.issues.length) {
    lines.push('---');
    lines.push('解析与判定线索:');
    data.issues.forEach((issue, i) => lines.push(`  ${i + 1}. ${issue}`));
  }
  return lines.join('\n');
}

function buildCsvRow(data: UnifiedData): CsvRow {
  return {
    station_name: data.stationName,
    timestamp: data.timestamp,
    latitude: data.latitudeDecimal,
    longitude: data.longitudeDecimal,
    latitude_raw: data.latitudeOriginal,
    longitude_raw: data.longitudeOriginal,
    coordinate_format: data.coordinateFormat,
    tide_meters: data.tideMeters,
    tide_original: data.tideOriginal,
    tide_unit_raw: data.tideUnitRaw,
    tide_level: data.tideLevel,
    remarks: data.remarks,
    issues: data.issues.join(' | '),
    raw_text: data.rawText,
    source_ref: data.sourceRef,
    record_id: data.recordId,
    log_id: data.logId,
  };
}

export function createAnnotation(
  batchId: string,
  record: BuoyRecord,
  remarks: string[] = [],
  status?: AnnotationStatus,
): TideStationAnnotation {
  const unified = unifiedDataSource(record, remarks);

  const finalStatus: AnnotationStatus = status ?? (record.isValid ? 'processed' : 'exception');
  const now = new Date().toISOString();

  return {
    annotationId: generateId('ann'),
    batchId,
    stationName: unified.stationName,
    buoyRecord: record,
    sceneAnnotation: buildSceneAnnotation(unified),
    sideNote: buildSideNote(unified),
    csvRow: buildCsvRow(unified),
    status: finalStatus,
    createdAt: now,
    updatedAt: now,
    remarks,
    rawTrace: {
      unifiedSourceSnapshot: unified,
      parseTimestamp: now,
    },
  };
}

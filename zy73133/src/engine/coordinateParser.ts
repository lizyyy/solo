import type { CoordinateFormat, NormalizedCoordinates } from './types';

interface LatPattern {
  re: RegExp;
  fmt: CoordinateFormat;
}

const LAT_PATTERNS: LatPattern[] = [
  { re: /^(-?\d+\.?\d*)\s*°?\s*([NSns]?)$/, fmt: 'decimal' },
  { re: /^(-?\d+)[°\s]\s*(\d+\.?\d*)\s*['′]?\s*([NSns]?)$/, fmt: 'ddm' },
  { re: /^(-?\d+)[°\s]\s*(\d+)['′\s]\s*(\d+\.?\d*)["″]?\s*([NSns]?)$/, fmt: 'dms' },
];

const LNG_PATTERNS: LatPattern[] = [
  { re: /^(-?\d+\.?\d*)\s*°?\s*([EWew]?)$/, fmt: 'decimal' },
  { re: /^(-?\d+)[°\s]\s*(\d+\.?\d*)\s*['′]?\s*([EWew]?)$/, fmt: 'ddm' },
  { re: /^(-?\d+)[°\s]\s*(\d+)['′\s]\s*(\d+\.?\d*)["″]?\s*([EWew]?)$/, fmt: 'dms' },
];

interface ParsedValue {
  value: number | null;
  fmt: CoordinateFormat;
  notes: string[];
}

function parseSingleValue(raw: string, isLatitude: boolean): ParsedValue {
  const notes: string[] = [];
  if (raw == null) {
    return { value: null, fmt: 'unknown', notes: ['原始值为空'] };
  }

  const cleaned = String(raw).trim();
  if (!cleaned) {
    return { value: null, fmt: 'unknown', notes: ['原始值为空字符串'] };
  }

  const patterns = isLatitude ? LAT_PATTERNS : LNG_PATTERNS;

  for (const { re, fmt } of patterns) {
    const m = cleaned.match(re);
    if (!m) continue;

    if (fmt === 'decimal') {
      const value = parseFloat(m[1]);
      if (Number.isNaN(value)) continue;
      const direction = (m[2] || '').toUpperCase();
      let v = value;
      if ((direction === 'S' || direction === 'W') && v > 0) {
        v = -v;
        notes.push(`检测到${direction}方向，数值取反`);
      } else if ((direction === 'N' || direction === 'E') && v < 0) {
        v = Math.abs(v);
        notes.push(`检测到${direction}方向，负数取正`);
      }
      return { value: v, fmt, notes };
    }

    if (fmt === 'ddm') {
      const degrees = parseFloat(m[1]);
      const minutes = parseFloat(m[2]);
      if (Number.isNaN(degrees) || Number.isNaN(minutes)) continue;
      const direction = (m[3] || '').toUpperCase();
      if (minutes >= 60) notes.push(`分(${minutes})超过60，按60进制转换`);
      let v = Math.abs(degrees) + minutes / 60;
      if (degrees < 0 || direction === 'S' || direction === 'W') v = -v;
      if (direction) notes.push(`按${direction}方向判定符号`);
      return { value: v, fmt, notes };
    }

    if (fmt === 'dms') {
      const degrees = parseFloat(m[1]);
      const minutes = parseFloat(m[2]);
      const seconds = parseFloat(m[3]);
      if (Number.isNaN(degrees) || Number.isNaN(minutes) || Number.isNaN(seconds)) continue;
      const direction = (m[4] || '').toUpperCase();
      if (minutes >= 60) notes.push(`分(${minutes})超过60，按60进制转换`);
      if (seconds >= 60) notes.push(`秒(${seconds})超过60，按60进制转换`);
      let v = Math.abs(degrees) + minutes / 60 + seconds / 3600;
      if (degrees < 0 || direction === 'S' || direction === 'W') v = -v;
      if (direction) notes.push(`按${direction}方向判定符号`);
      return { value: v, fmt, notes };
    }
  }

  // Fallback: try to extract a pure numeric value, but mark format unknown.
  const rawNumeric = cleaned.replace(/[^0-9.\-]/g, '');
  if (rawNumeric && !['-', '.', '-.'].includes(rawNumeric)) {
    const value = parseFloat(rawNumeric);
    if (!Number.isNaN(value)) {
      notes.push(`无法识别格式，按纯数值提取: ${rawNumeric}`);
      return { value, fmt: 'unknown', notes };
    }
  }

  return { value: null, fmt: 'unknown', notes: [`无法解析坐标值: ${cleaned}`] };
}

function validateRange(lat: number, lng: number): string[] {
  const issues: string[] = [];
  if (!(-90 <= lat && lat <= 90)) issues.push(`纬度 ${lat} 超出有效范围 [-90, 90]`);
  if (!(-180 <= lng && lng <= 180)) issues.push(`经度 ${lng} 超出有效范围 [-180, 180]`);
  return issues;
}

function pickOverallFormat(latFmt: CoordinateFormat, lngFmt: CoordinateFormat): CoordinateFormat {
  if (latFmt === lngFmt) return latFmt;
  if (latFmt === 'dms' || lngFmt === 'dms') return 'dms';
  if (latFmt === 'ddm' || lngFmt === 'ddm') return 'ddm';
  if (latFmt === 'decimal' || lngFmt === 'decimal') return 'decimal';
  return 'unknown';
}

export function parseCoordinates(rawLatitude: string, rawLongitude: string): NormalizedCoordinates {
  const latParsed = parseSingleValue(rawLatitude, true);
  const lngParsed = parseSingleValue(rawLongitude, false);

  const allNotes = [...latParsed.notes, ...lngParsed.notes];

  if (latParsed.value != null && lngParsed.value != null) {
    allNotes.push(...validateRange(latParsed.value, lngParsed.value));
  } else {
    allNotes.push('坐标解析失败：经纬度未全部识别为有效数值，点位不落海面');
  }

  const fmt = pickOverallFormat(latParsed.fmt, lngParsed.fmt);
  if (latParsed.fmt !== lngParsed.fmt) {
    allNotes.push(`经纬格式不一致: 纬度=${latParsed.fmt}, 经度=${lngParsed.fmt}，统一按 ${fmt} 记录`);
  }

  return {
    latitude: latParsed.value,
    longitude: lngParsed.value,
    originalFormat: fmt,
    rawLatitude: rawLatitude ?? '',
    rawLongitude: rawLongitude ?? '',
    parseNotes: allNotes,
  };
}

import type { DetectionResult, CoordinateType } from '../types';

const LAT_LNG_PATTERNS = [
  /[°"'NESW]/i,
  /^\s*[-+]?\d+\.\d+\s*,\s*[-+]?\d+\.\d+\s*$/,
];

const METRIC_PATTERNS = [
  /[m米]\s*$/i,
  /[m米][,\s]/i,
  /x\s*[=:]\s*[-+]?\d+\.?\d*/i,
  /y\s*[=:]\s*[-+]?\d+\.?\d*/i,
];

const LNG_RANGE = { min: -180, max: 180 };
const LAT_RANGE = { min: -90, max: 90 };

function isInRange(value: number, min: number, max: number): boolean {
  return value >= min && value <= max;
}

function hasLatLngMarker(rawValue: string): boolean {
  return LAT_LNG_PATTERNS.some(pattern => pattern.test(rawValue));
}

function hasMetricMarker(rawValue: string): boolean {
  return METRIC_PATTERNS.some(pattern => pattern.test(rawValue));
}

function parseNumbers(rawValue: string): { x: number; y: number } {
  const cleanValue = rawValue.replace(/[^0-9\-+.,\s]/g, ' ').trim();
  const parts = cleanValue.split(/[,\s]+/).filter(p => p);
  
  const numbers = parts
    .map(p => parseFloat(p))
    .filter(n => !isNaN(n));
  
  if (numbers.length >= 2) {
    return { x: numbers[0], y: numbers[1] };
  }
  
  const xMatch = rawValue.match(/x\s*[=:]\s*([-+]?\d+\.?\d*)/i);
  const yMatch = rawValue.match(/y\s*[=:]\s*([-+]?\d+\.?\d*)/i);
  
  return {
    x: xMatch ? parseFloat(xMatch[1]) : 0,
    y: yMatch ? parseFloat(yMatch[1]) : 0,
  };
}

const STRONGLY_LIKE_LNG_THRESHOLD = 50;

function looksStronglyLikeLatLng(x: number, y: number): boolean {
  return Math.abs(x) > STRONGLY_LIKE_LNG_THRESHOLD;
}

export function detectCoordinateType(rawValue: string): DetectionResult {
  const { x, y } = parseNumbers(rawValue);
  
  const hasLatLngMark = hasLatLngMarker(rawValue);
  const hasMetricMark = hasMetricMarker(rawValue);
  
  const xInLngRange = isInRange(x, LNG_RANGE.min, LNG_RANGE.max);
  const yInLatRange = isInRange(y, LAT_RANGE.min, LAT_RANGE.max);
  const bothInLatLngRange = xInLngRange && yInLatRange;
  const stronglyLatLng = looksStronglyLikeLatLng(x, y);
  
  const anyOutsideLatLngRange = !xInLngRange || !yInLatRange;
  
  const isMixed = (hasLatLngMark && hasMetricMark)
    || (stronglyLatLng && hasMetricMark)
    || (hasLatLngMark && anyOutsideLatLngRange);
  
  const isMetric = !isMixed && ((hasMetricMark || anyOutsideLatLngRange) && !hasLatLngMark);
  
  const isLatLng = !isMixed && !isMetric && (hasLatLngMark || bothInLatLngRange);
  
  let coordinateType: CoordinateType = 'LAT_LNG';
  if (isMixed) {
    coordinateType = 'MIXED';
  } else if (isMetric) {
    coordinateType = 'METRIC';
  }
  
  return {
    isLatLng,
    isMetric,
    isMixed,
    coordinateType,
    xValue: x,
    yValue: y,
  };
}

export function normalizeCoordinate(
  rawValue: string,
  targetType: 'LAT_LNG' | 'METRIC',
  referenceLat?: number,
  referenceLng?: number
): { xValue: number; yValue: number } {
  const { x, y } = parseNumbers(rawValue);
  
  if (targetType === 'METRIC' && referenceLat !== undefined && referenceLng !== undefined) {
    const earthRadius = 6371000;
    const dLat = (x - referenceLat) * Math.PI / 180;
    const dLng = (y - referenceLng) * Math.PI / 180;
    
    const latRad = referenceLat * Math.PI / 180;
    const metricX = dLng * earthRadius * Math.cos(latRad);
    const metricY = dLat * earthRadius;
    
    return { xValue: metricX, yValue: metricY };
  }
  
  if (targetType === 'LAT_LNG' && referenceLat !== undefined && referenceLng !== undefined) {
    const earthRadius = 6371000;
    const latRad = referenceLat * Math.PI / 180;
    
    const dLat = y / earthRadius;
    const dLng = x / (earthRadius * Math.cos(latRad));
    
    return {
      xValue: referenceLng + dLng * 180 / Math.PI,
      yValue: referenceLat + dLat * 180 / Math.PI,
    };
  }
  
  return { xValue: x, yValue: y };
}

export const COORDINATE_RULES = [
  {
    id: 'rule_001',
    ruleType: 'DETECTION' as const,
    ruleName: '经纬度格式检测',
    condition: '数值在经度-180~180、纬度-90~90范围内，或包含°E/°N/W/S标记',
    action: '标记为 LAT_LNG 类型',
    codeReference: 'shared/rules/coordinateRules.ts:15-30',
    description: '检测坐标是否为经纬度格式',
  },
  {
    id: 'rule_002',
    ruleType: 'DETECTION' as const,
    ruleName: '米制格式检测',
    condition: '数值带有m/米单位标记，或数值超出经纬度正常范围',
    action: '标记为 METRIC 类型',
    codeReference: 'shared/rules/coordinateRules.ts:32-48',
    description: '检测坐标是否为米制格式',
  },
  {
    id: 'rule_003',
    ruleType: 'DETECTION' as const,
    ruleName: '坐标混合检测',
    condition: '同一条记录中同时检测到经纬度格式和米制格式',
    action: '标记 is_mixed=1，status=INSPECTION_REVIEW',
    codeReference: 'shared/rules/coordinateRules.ts:50-72',
    description: '检测坐标混合情况，留待巡检组复核',
  },
  {
    id: 'rule_004',
    ruleType: 'CORRECTION' as const,
    ruleName: '坐标归一化规则',
    condition: '巡检组确认坐标类型后',
    action: '统一转换为米制坐标或经纬度坐标',
    codeReference: 'shared/rules/coordinateRules.ts:74-95',
    description: '经巡检组复核后进行坐标归一化',
  },
];

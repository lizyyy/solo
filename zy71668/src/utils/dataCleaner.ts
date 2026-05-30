import type { DataIssue, DataIssueType, Severity, Waypoint } from '@/types';

interface FieldMapping {
  [key: string]: string[];
}

const FIELD_MAPPINGS: FieldMapping = {
  model: ['model', '型号', '机型', 'drone_model', '无人机型号'],
  maxTakeoffWeight: ['maxTakeoffWeight', '最大起飞重量', '起飞重量', 'max_weight'],
  emptyWeight: ['emptyWeight', '空机重量', '空重', 'empty_weight'],
  batteryCapacity: ['batteryCapacity', '电池容量', '容量', 'capacity'],
  batteryVoltage: ['batteryVoltage', '电池电压', '电压', 'voltage'],
  maxFlightTime: ['maxFlightTime', '标称续航', '最大续航', 'flight_time'],
  cruiseSpeed: ['cruiseSpeed', '巡航速度', '速度', 'speed'],
  speed: ['speed', '风速', '飞行速度', 'wind_speed'],
  direction: ['direction', '风向', '飞行方向', 'wind_direction'],
  altitude: ['altitude', '海拔', '高度', '飞行高度'],
  cameraWeight: ['cameraWeight', '相机重量', '相机'],
  batteryWeight: ['batteryWeight', '电池重量'],
  accessoriesWeight: ['accessoriesWeight', '附件重量', '配件重量'],
  totalWeight: ['totalWeight', '总重量', '载重', 'payload'],
  currentCapacity: ['currentCapacity', '当前电量', '电量', 'battery_level'],
  cycleCount: ['cycleCount', '循环次数', '充放电次数'],
  temperature: ['temperature', '温度', '电池温度'],
  health: ['health', '健康度', '电池健康', 'battery_health'],
  lat: ['lat', 'latitude', '纬度'],
  lng: ['lng', 'lon', 'longitude', '经度'],
  stayTime: ['stayTime', '停留时间', '悬停时间'],
  flightDirection: ['flightDirection', '航向', '飞行方向'],
};

const TYPOS: { [key: string]: string } = {
  '疯速': '风速',
  '风素': '风速',
  '电迟': '电池',
  '电持': '电池',
  '栽重': '载重',
  '载重': '载重',
  '续行': '续航',
  '续肮': '续航',
};

export function normalizeFieldName(fieldName: string): string {
  const normalized = fieldName.trim().toLowerCase();
  
  for (const [standardField, aliases] of Object.entries(FIELD_MAPPINGS)) {
    if (aliases.some(alias => alias.toLowerCase() === normalized)) {
      return standardField;
    }
  }
  
  return fieldName;
}

export function correctTypos(value: string): string {
  let corrected = value;
  for (const [typo, correct] of Object.entries(TYPOS)) {
    corrected = corrected.replace(new RegExp(typo, 'g'), correct);
  }
  return corrected;
}

export function createIssue(
  type: DataIssueType,
  severity: Severity,
  field: string,
  message: string,
  suggestion: string,
  rowIndex?: number
): DataIssue {
  return {
    id: Math.random().toString(36).substring(2, 11),
    type,
    severity,
    field,
    rowIndex,
    message,
    suggestion,
    fixed: false,
  };
}

export function validateNumber(
  value: unknown,
  field: string,
  min: number,
  max: number,
  rowIndex?: number
): { valid: boolean; numValue: number; issues: DataIssue[] } {
  const issues: DataIssue[] = [];
  
  if (value === null || value === undefined || value === '') {
    issues.push(createIssue(
      'empty',
      'error',
      field,
      `字段"${field}"为空值`,
      `请输入${field}的数值`,
      rowIndex
    ));
    return { valid: false, numValue: 0, issues };
  }
  
  const numValue = typeof value === 'number' ? value : parseFloat(String(value));
  
  if (isNaN(numValue)) {
    issues.push(createIssue(
      'invalid',
      'error',
      field,
      `字段"${field}"的值"${value}"不是有效数字`,
      `请输入有效的数字`,
      rowIndex
    ));
    return { valid: false, numValue: 0, issues };
  }
  
  if (numValue < min || numValue > max) {
    issues.push(createIssue(
      'invalid',
      'warning',
      field,
      `字段"${field}"的值${numValue}超出合理范围 [${min}, ${max}]`,
      `请检查数值是否正确`,
      rowIndex
    ));
  }
  
  return { valid: issues.length === 0, numValue, issues };
}

export interface CleanedData {
  droneParams?: Record<string, unknown>;
  windData?: Record<string, unknown>;
  payloadData?: Record<string, unknown>;
  batteryStatus?: Record<string, unknown>;
  waypoints?: Waypoint[];
  issues: DataIssue[];
  dataQuality: number;
}

export function detectEmptyColumns(rows: Record<string, unknown>[]): DataIssue[] {
  if (rows.length === 0) return [];
  
  const issues: DataIssue[] = [];
  const columns = Object.keys(rows[0]);
  
  columns.forEach((col) => {
    const allEmpty = rows.every((row) => {
      const val = row[col];
      return val === null || val === undefined || val === '';
    });
    
    if (allEmpty) {
      issues.push(createIssue(
        'empty',
        'info',
        col,
        `列"${col}"全部为空`,
        '该列可能为冗余数据，建议删除或填充数据',
        undefined
      ));
    }
  });
  
  return issues;
}

export function detectDuplicateRows(rows: Record<string, unknown>[]): DataIssue[] {
  const issues: DataIssue[] = [];
  const seen = new Map<string, number>();
  
  rows.forEach((row, index) => {
    const key = JSON.stringify(Object.values(row));
    if (seen.has(key)) {
      issues.push(createIssue(
        'duplicate',
        'warning',
        'row',
        `第 ${index + 1} 行与第 ${(seen.get(key) as number) + 1} 行重复`,
        '建议删除重复行',
        index
      ));
    } else {
      seen.set(key, index);
    }
  });
  
  return issues;
}

export function cleanRawData(rawData: Record<string, unknown>[]): CleanedData {
  const issues: DataIssue[] = [];
  
  issues.push(...detectEmptyColumns(rawData));
  issues.push(...detectDuplicateRows(rawData));
  
  const normalizedData = rawData.map((row, rowIndex) => {
    const normalizedRow: Record<string, unknown> = {};
    
    for (const [key, value] of Object.entries(row)) {
      const normalizedKey = normalizeFieldName(key);
      
      if (typeof value === 'string') {
        const corrected = correctTypos(value);
        if (corrected !== value) {
          issues.push(createIssue(
            'typo',
            'info',
            normalizedKey,
            `检测到可能的错别字: "${value}" → "${corrected}"`,
            '已自动修正，可手动确认',
            rowIndex
          ));
          normalizedRow[normalizedKey] = corrected;
        } else {
          normalizedRow[normalizedKey] = value;
        }
      } else {
        normalizedRow[normalizedKey] = value;
      }
    }
    
    return normalizedRow;
  });
  
  const totalChecks = rawData.length * Object.keys(rawData[0] || {}).length + 2;
  const errorCount = issues.filter(i => i.severity === 'error').length;
  const warningCount = issues.filter(i => i.severity === 'warning').length;
  const dataQuality = Math.max(0, 100 - errorCount * 10 - warningCount * 3);
  
  return {
    issues,
    dataQuality,
  };
}

export function parseCSVData(csvData: string[] | Record<string, unknown>[]): CleanedData {
  const rows: Record<string, unknown>[] = [];
  
  if (Array.isArray(csvData) && csvData.length > 0) {
    if (typeof csvData[0] === 'object' && csvData[0] !== null) {
      rows.push(...(csvData as Record<string, unknown>[]));
    }
  }
  
  return cleanRawData(rows);
}

export function calculateDataQualityScore(issues: DataIssue[]): number {
  let score = 100;
  
  issues.forEach((issue) => {
    if (issue.fixed) return;
    
    if (issue.severity === 'error') {
      score -= 15;
    } else if (issue.severity === 'warning') {
      score -= 5;
    } else {
      score -= 1;
    }
  });
  
  return Math.max(0, Math.min(100, score));
}

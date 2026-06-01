import { InspectionRecord, DataQualityIssue } from '../types';
import { isKnownUnit } from './unitConverter';

export function checkDataQuality(records: InspectionRecord[]): DataQualityIssue[] {
  const issues: DataQualityIssue[] = [];

  records.forEach(record => {
    const recordIssues = checkRecordQuality(record);
    issues.push(...recordIssues);
  });

  return issues;
}

export function checkRecordQuality(record: InspectionRecord): DataQualityIssue[] {
  const issues: DataQualityIssue[] = [];

  if (record.temperatureInside === null || record.temperatureInside === undefined) {
    issues.push({
      recordId: record.id,
      type: 'missing',
      field: 'temperatureInside',
      message: `库内温度数据缺失`,
      suggestion: '请补充库内温度数据，或使用该冷库历史平均值进行估算',
    });
  }

  if (record.temperatureOutside === null || record.temperatureOutside === undefined) {
    issues.push({
      recordId: record.id,
      type: 'missing',
      field: 'temperatureOutside',
      message: `库外温度数据缺失`,
      suggestion: '请补充库外温度数据，或使用当天环境温度进行估算',
    });
  }

  if (record.curtainArea === null || record.curtainArea === undefined) {
    issues.push({
      recordId: record.id,
      type: 'missing',
      field: 'curtainArea',
      message: `门帘面积数据缺失`,
      suggestion: '请测量门帘实际尺寸并补充面积数据',
    });
  }

  if (record.tempInsideUnit && !isKnownUnit(record.tempInsideUnit, 'temperature')) {
    issues.push({
      recordId: record.id,
      type: 'unit_mismatch',
      field: 'tempInsideUnit',
      message: `库内温度单位"${record.tempInsideUnit}"不规范`,
      suggestion: '建议使用标准单位：°C、°F 或 K',
    });
  }

  if (record.tempOutsideUnit && !isKnownUnit(record.tempOutsideUnit, 'temperature')) {
    issues.push({
      recordId: record.id,
      type: 'unit_mismatch',
      field: 'tempOutsideUnit',
      message: `库外温度单位"${record.tempOutsideUnit}"不规范`,
      suggestion: '建议使用标准单位：°C、°F 或 K',
    });
  }

  if (record.areaUnit && !isKnownUnit(record.areaUnit, 'area')) {
    issues.push({
      recordId: record.id,
      type: 'unit_mismatch',
      field: 'areaUnit',
      message: `面积单位"${record.areaUnit}"不规范`,
      suggestion: '建议使用标准单位：m² 或 ft²',
    });
  }

  if (record.temperatureInside !== null && (record.temperatureInside < -50 || record.temperatureInside > 50)) {
    issues.push({
      recordId: record.id,
      type: 'outlier',
      field: 'temperatureInside',
      message: `库内温度${record.temperatureInside}${record.tempInsideUnit}异常`,
      suggestion: '请确认温度读数是否正确，冷库正常温度范围通常为-30°C至10°C',
    });
  }

  if (record.temperatureOutside !== null && (record.temperatureOutside < -40 || record.temperatureOutside > 60)) {
    issues.push({
      recordId: record.id,
      type: 'outlier',
      field: 'temperatureOutside',
      message: `库外温度${record.temperatureOutside}${record.tempOutsideUnit}异常`,
      suggestion: '请确认温度读数是否正确，正常环境温度范围通常为-20°C至45°C',
    });
  }

  if (record.curtainArea !== null && (record.curtainArea < 0.5 || record.curtainArea > 50)) {
    issues.push({
      recordId: record.id,
      type: 'outlier',
      field: 'curtainArea',
      message: `门帘面积${record.curtainArea}${record.areaUnit}异常`,
      suggestion: '请确认面积数据是否正确，冷库门帘正常面积范围通常为1m²至20m²',
    });
  }

  return issues;
}

export function classifyDataQuality(issues: DataQualityIssue[]): 'good' | 'missing' | 'unit_mismatch' | 'outlier' {
  if (issues.length === 0) return 'good';
  
  const hasMissing = issues.some(i => i.type === 'missing');
  const hasOutlier = issues.some(i => i.type === 'outlier');
  const hasUnitMismatch = issues.some(i => i.type === 'unit_mismatch');

  if (hasMissing) return 'missing';
  if (hasOutlier) return 'outlier';
  if (hasUnitMismatch) return 'unit_mismatch';
  return 'good';
}

export function getQualityLabel(quality: string): string {
  const labels: Record<string, string> = {
    good: '正常',
    missing: '数据缺失',
    unit_mismatch: '单位不规范',
    outlier: '数值异常',
  };
  return labels[quality] || quality;
}

export function getQualityColor(quality: string): string {
  const colors: Record<string, string> = {
    good: 'text-green-500 bg-green-50',
    missing: 'text-amber-500 bg-amber-50',
    unit_mismatch: 'text-blue-500 bg-blue-50',
    outlier: 'text-red-500 bg-red-50',
  };
  return colors[quality] || 'text-gray-500 bg-gray-50';
}

import type { DataRecord, UnitIssue, OutlierDetectionResult, TemperatureUnit, PowerUnit } from '@/types';
import { UnitConverter } from './unitConverter';

function generateId(): string {
  return Math.random().toString(36).substring(2, 15);
}

export class DataCleaner {
  static detectGaps(
    records: DataRecord[],
    expectedIntervalMinutes: number
  ): { gaps: { afterIndex: number; expectedTime: Date; actualTime: Date; gapMinutes: number }[] } {
    if (records.length < 2) return { gaps: [] };

    const sorted = [...records].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    const gaps: { afterIndex: number; expectedTime: Date; actualTime: Date; gapMinutes: number }[] = [];

    for (let i = 0; i < sorted.length - 1; i++) {
      const current = new Date(sorted[i].timestamp).getTime();
      const next = new Date(sorted[i + 1].timestamp).getTime();
      const diffMinutes = (next - current) / 60000;

      if (diffMinutes > expectedIntervalMinutes * 1.5) {
        const expectedTime = new Date(current + expectedIntervalMinutes * 60000);
        gaps.push({
          afterIndex: i,
          expectedTime,
          actualTime: new Date(next),
          gapMinutes: diffMinutes,
        });
      }
    }

    return { gaps };
  }

  static normalizeUnits(records: DataRecord[]): {
    cleaned: DataRecord[];
    issues: UnitIssue[];
  } {
    const issues: UnitIssue[] = [];
    const cleaned = records.map(record => {
      const newRecord = { ...record, unitIssues: [...record.unitIssues] };
      let modified = false;

      if (record.temperatureUnit) {
        const parsed = UnitConverter.parseUnit(record.temperatureUnit);
        if (parsed.confidence < 1.0 && parsed.confidence > 0) {
          const standardUnit = parsed.unit as TemperatureUnit;
          const convertedValue = UnitConverter.convertTemperature(record.temperature, standardUnit, '°C');
          if (!isNaN(convertedValue) && isFinite(convertedValue)) {
            issues.push({
              recordId: record.id,
              field: 'temperatureUnit',
              original: record.temperatureUnit,
              normalized: standardUnit,
              confidence: parsed.confidence,
            });
            newRecord.temperature = UnitConverter.convertTemperature(record.temperature, standardUnit, '°C');
            newRecord.temperatureUnit = '°C';
            newRecord.unitIssues.push(`温度单位: ${record.temperatureUnit} → ${standardUnit} (置信度: ${(parsed.confidence * 100).toFixed(0)}%)`);
            modified = true;
          }
        }
      }

      if (record.coolingLoadUnit) {
        const parsed = UnitConverter.parseUnit(record.coolingLoadUnit);
        if (parsed.confidence < 1.0 && parsed.confidence > 0) {
          const standardUnit = parsed.unit as PowerUnit;
          issues.push({
            recordId: record.id,
            field: 'coolingLoadUnit',
            original: record.coolingLoadUnit,
            normalized: standardUnit,
            confidence: parsed.confidence,
          });
          newRecord.coolingLoadUnit = standardUnit;
          newRecord.unitIssues.push(`冷量单位: ${record.coolingLoadUnit} → ${standardUnit} (置信度: ${(parsed.confidence * 100).toFixed(0)}%)`);
          modified = true;
        }
      }

      return modified ? newRecord : record;
    });

    return { cleaned, issues };
  }

  static detectExtremes(values: number[], threshold: number = 1.5): OutlierDetectionResult {
    if (values.length < 4) {
      const mean = values.length > 0 ? values.reduce((s, v) => s + v, 0) / values.length : 0;
      return {
        outliers: [],
        outlierIndices: [],
        bounds: { lower: -Infinity, upper: Infinity },
        stats: { median: mean, q1: mean, q3: mean, iqr: 0, mean, robustMean: mean },
      };
    }

    const sorted = [...values].sort((a, b) => a - b);
    const n = sorted.length;
    const q1Index = Math.floor(n * 0.25);
    const q3Index = Math.floor(n * 0.75);
    const q1 = sorted[q1Index];
    const q3 = sorted[q3Index];
    const iqr = q3 - q1;
    const lower = q1 - threshold * iqr;
    const upper = q3 + threshold * iqr;
    const median = sorted[Math.floor(n / 2)];
    const mean = values.reduce((s, v) => s + v, 0) / values.length;

    const outlierIndices: number[] = [];
    const outliers: number[] = [];
    values.forEach((v, i) => {
      if (v < lower || v > upper) {
        outliers.push(v);
        outlierIndices.push(i);
      }
    });

    const nonOutliers = values.filter(v => v >= lower && v <= upper);
    const robustMean = nonOutliers.length > 0
      ? nonOutliers.reduce((s, v) => s + v, 0) / nonOutliers.length
      : mean;

    return {
      outliers,
      outlierIndices,
      bounds: { lower, upper },
      stats: { median, q1, q3, iqr, mean, robustMean },
    };
  }

  static calculateRobustMean(values: number[], excludeExtremes: boolean): number {
    if (!excludeExtremes || values.length < 4) {
      return values.reduce((s, v) => s + v, 0) / values.length;
    }
    const { bounds, stats } = this.detectExtremes(values);
    const filtered = values.filter(v => v >= bounds.lower && v <= bounds.upper);
    return filtered.length > 0 ? stats.robustMean : stats.mean;
  }

  static parseRawData(rawData: any[], fileName: string, batchId: string): DataRecord[] {
    return rawData.map((row, index) => {
      const timestamp = row.timestamp || row.time || row.时间 || new Date().toISOString();
      const temperature = parseFloat(row.temperature || row.温度 || row.temp || 0);
      const rawTempUnit = String(row.temperatureUnit || row.温度单位 || row.unit || '°C');
      const humidity = parseFloat(row.humidity || row.湿度 || row.rh || 0);
      const coolingLoad = row.coolingLoad || row.冷量 || row.load ? parseFloat(row.coolingLoad || row.冷量 || row.load) : undefined;
      const rawLoadUnit = row.coolingLoadUnit || row.冷量单位 ? String(row.coolingLoadUnit || row.冷量单位) : undefined;

      const parsedTempUnit = UnitConverter.parseUnit(rawTempUnit);
      const parsedLoadUnit = rawLoadUnit ? UnitConverter.parseUnit(rawLoadUnit) : null;

      const missingFields: string[] = [];
      if (!temperature && temperature !== 0) missingFields.push('temperature');
      if (!humidity && humidity !== 0) missingFields.push('humidity');
      if (!timestamp) missingFields.push('timestamp');

      const unitIssues: string[] = [];
      if (parsedTempUnit.confidence < 1.0) {
        unitIssues.push(`温度单位"${rawTempUnit}"疑似${parsedTempUnit.unit}，置信度${(parsedTempUnit.confidence * 100).toFixed(0)}%`);
      }
      if (parsedLoadUnit && parsedLoadUnit.confidence < 1.0) {
        unitIssues.push(`冷量单位"${rawLoadUnit}"疑似${parsedLoadUnit.unit}，置信度${(parsedLoadUnit.confidence * 100).toFixed(0)}%`);
      }

      const dataStatus: DataRecord['dataStatus'] = 
        missingFields.length > 0 ? 'missing' :
        unitIssues.length > 0 ? 'unit_mismatch' : 'clean';

      return {
        id: generateId(),
        batchId,
        timestamp: new Date(timestamp),
        temperature,
        temperatureUnit: (parsedTempUnit.confidence >= 0.5 ? parsedTempUnit.unit : rawTempUnit) as TemperatureUnit,
        humidity,
        coolingLoad,
        coolingLoadUnit: parsedLoadUnit && parsedLoadUnit.confidence >= 0.5 ? parsedLoadUnit.unit as PowerUnit : rawLoadUnit as PowerUnit | undefined,
        dataStatus,
        recordStatus: 'pending',
        sources: [{
          id: generateId(),
          recordId: '',
          sourceType: 'import' as const,
          sourceFile: fileName,
          sourceLine: index + 2,
          originalValue: JSON.stringify(row),
          originalUnit: rawTempUnit,
          importTimestamp: new Date(),
        }],
        missingFields,
        unitIssues,
      };
    });
  }
}

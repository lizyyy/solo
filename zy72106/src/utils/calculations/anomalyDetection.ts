import type { SensorRecord, DataValidationIssue, AnomalyRules } from '@/types';

const calculateIQR = (values: number[]): { q1: number; q3: number; iqr: number; median: number } => {
  const sorted = [...values].sort((a, b) => a - b);
  const q1 = sorted[Math.floor(sorted.length * 0.25)];
  const q3 = sorted[Math.floor(sorted.length * 0.75)];
  const median = sorted[Math.floor(sorted.length * 0.5)];
  return { q1, q3, iqr: q3 - q1, median };
};

export const detectAnomalies = (
  records: SensorRecord[],
  rules: AnomalyRules
): DataValidationIssue[] => {
  const issues: DataValidationIssue[] = [];

  records.forEach((record) => {
    if (record.pWaveArrival === null) {
      issues.push({
        type: 'empty',
        recordId: record.id,
        field: 'pWaveArrival',
        message: 'P波到时为空',
        severity: 'warning',
      });
    }
    if (record.sWaveArrival === null) {
      issues.push({
        type: 'empty',
        recordId: record.id,
        field: 'sWaveArrival',
        message: 'S波到时为空',
        severity: 'warning',
      });
    }
    if (record.amplitude === null) {
      issues.push({
        type: 'empty',
        recordId: record.id,
        field: 'amplitude',
        message: '振幅为空',
        severity: 'info',
      });
    }

    if (record.pWaveArrival !== null && record.sWaveArrival !== null) {
      const timeDiff = record.sWaveArrival - record.pWaveArrival;
      if (timeDiff > rules.maxTimeDifference) {
        issues.push({
          type: 'boundary',
          recordId: record.id,
          field: 'sWaveArrival',
          message: `S-P时差 (${timeDiff.toFixed(2)}s) 超过最大阈值`,
          severity: 'warning',
        });
      }
      if (timeDiff < rules.minTimeDifference) {
        issues.push({
          type: 'boundary',
          recordId: record.id,
          field: 'sWaveArrival',
          message: `S-P时差 (${timeDiff.toFixed(2)}s) 低于最小阈值`,
          severity: 'warning',
        });
      }
    }
  });

  const validPWaveTimes = records
    .map((r) => r.pWaveArrival)
    .filter((t): t is number => t !== null);

  if (validPWaveTimes.length > 0) {
    const { q1, q3, iqr } = calculateIQR(validPWaveTimes);
    const lowerBound = q1 - 1.5 * iqr;
    const upperBound = q3 + 1.5 * iqr;

    records.forEach((record) => {
      if (record.pWaveArrival !== null) {
        if (record.pWaveArrival < lowerBound || record.pWaveArrival > upperBound) {
          issues.push({
            type: 'outlier',
            recordId: record.id,
            field: 'pWaveArrival',
            message: 'P波到时为极端值',
            severity: 'error',
          });
        }
      }
    });
  }

  const validAmplitudes = records
    .map((r) => r.amplitude)
    .filter((a): a is number => a !== null);

  if (validAmplitudes.length > 0) {
    const mean = validAmplitudes.reduce((a, b) => a + b, 0) / validAmplitudes.length;
    const stdDev = Math.sqrt(
      validAmplitudes.reduce((sum, a) => sum + Math.pow(a - mean, 2), 0) / validAmplitudes.length
    );

    records.forEach((record) => {
      if (record.amplitude !== null) {
        const zScore = Math.abs((record.amplitude - mean) / stdDev);
        if (zScore > rules.amplitudeOutlierThreshold) {
          issues.push({
            type: 'outlier',
            recordId: record.id,
            field: 'amplitude',
            message: `振幅 (Z分数 (${zScore.toFixed(2)}) 超出正常范围`,
            severity: 'error',
          });
        }
      }
    });
  }

  const seen = new Map<string, SensorRecord>();
  records.forEach((record) => {
    const key = `${record.sensorId}-${record.pWaveArrival}`;
    if (seen.has(key)) {
      issues.push({
        type: 'duplicate',
        recordId: record.id,
        message: '重复的传感器记录',
        severity: 'warning',
      });
    } else {
      seen.set(key, record);
    }
  });

  return issues;
};

export const getExtremeValueRecords = (
  records: SensorRecord[],
  issues: DataValidationIssue[]
): SensorRecord[] => {
  const extremeRecordIds = new Set(
    issues.filter((i) => i.severity === 'error').map((i) => i.recordId)
  );
  return records.filter((r) => extremeRecordIds.has(r.id));
};

export const getNeedsReviewRecords = (
  records: SensorRecord[],
  issues: DataValidationIssue[]
): SensorRecord[] => {
  const reviewRecordIds = new Set(
    issues.filter((i) => i.severity === 'warning').map((i) => i.recordId)
  );
  return records.filter((r) => reviewRecordIds.has(r.id));
};

export const groupIssuesByRecord = (
  issues: DataValidationIssue[]
): Map<string, DataValidationIssue[]> => {
  const grouped = new Map<string, DataValidationIssue[]>();
  issues.forEach((issue) => {
    const existing = grouped.get(issue.recordId) || [];
    grouped.set(issue.recordId, [...existing, issue]);
  });
  return grouped;
};

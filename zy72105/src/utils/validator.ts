import type {
  AnomalyRecord,
  ConflictRecord,
  DataPoint,
  Direction,
  SensorLogEntry,
  ThresholdConfig,
} from '../types';

const generateId = (): string => Math.random().toString(36).substring(2, 11);

export const validateDirection = (sensorDir?: Direction, importDir?: Direction): boolean => {
  if (!sensorDir || !importDir) return true;
  return sensorDir === importDir;
};

export const validateTimeGap = (
  timestamps: number[],
  config: ThresholdConfig
): { gap: number; maxGap: number; exceeds: boolean }[] => {
  const results: { gap: number; maxGap: number; exceeds: boolean }[] = [];
  const sorted = [...timestamps].sort((a, b) => a - b);

  for (let i = 1; i < sorted.length; i++) {
    const gap = (sorted[i] - sorted[i - 1]) / 1000;
    const exceeds = gap > config.timeGapWarning;
    results.push({
      gap,
      maxGap: config.timeGapCritical,
      exceeds,
    });
  }

  return results;
};

export const validateValueTolerance = (
  sensorValue: number,
  importValue: number,
  tolerance: number
): { diff: number; diffPercent: number; exceeds: boolean } => {
  const diff = Math.abs(sensorValue - importValue);
  const diffPercent = (diff / Math.max(Math.abs(sensorValue), Math.abs(importValue), 1)) * 100;
  return {
    diff,
    diffPercent,
    exceeds: diffPercent > tolerance,
  };
};

export const detectConflicts = (
  dataPoints: DataPoint[],
  sensorLogs: SensorLogEntry[],
  config: ThresholdConfig
): ConflictRecord[] => {
  const conflicts: ConflictRecord[] = [];
  const timeWindow = 5000;

  for (const importPoint of dataPoints) {
    const matchingLogs = sensorLogs.filter(
      (log) => Math.abs(log.timestamp - importPoint.timestamp) <= timeWindow
    );

    for (const sensorLog of matchingLogs) {
      if (sensorLog.unit !== importPoint.unit && config.directionMismatch) {
        const toleranceCheck = validateValueTolerance(
          sensorLog.value,
          importPoint.value,
          config.valueTolerance
        );

        conflicts.push({
          id: generateId(),
          batchId: importPoint.source === 'import' ? importPoint.id : '',
          timestamp: Date.now(),
          type: 'unit_mismatch',
          severity: toleranceCheck.exceeds ? 'critical' : 'error',
          sensorData: {
            value: sensorLog.value,
            unit: sensorLog.unit,
            timestamp: sensorLog.timestamp,
            rawLog: sensorLog.rawLog,
          },
          importData: {
            value: importPoint.value,
            unit: importPoint.unit,
            timestamp: importPoint.timestamp,
            source: importPoint.source,
          },
          suggestedAction: `单位不匹配：传感器记录${sensorLog.unit}，导入数据为${importPoint.unit}。建议检查原始数据，确认正确单位后重新换算。`,
        });
      }

      if (
        importPoint.direction &&
        config.directionMismatch &&
        sensorLog.parameter.includes('direction')
      ) {
        const sensorDir = sensorLog.rawLog.includes('CCW') ? 'CCW' : 'CW';
        if (sensorDir !== importPoint.direction) {
          conflicts.push({
            id: generateId(),
            batchId: '',
            timestamp: Date.now(),
            type: 'direction_error',
            severity: 'error',
            sensorData: {
              value: sensorLog.value,
              unit: sensorLog.unit,
              timestamp: sensorLog.timestamp,
              rawLog: sensorLog.rawLog,
            },
            importData: {
              value: importPoint.value,
              unit: importPoint.unit,
              timestamp: importPoint.timestamp,
              source: importPoint.source,
            },
            suggestedAction: `方向符号冲突：传感器记录${sensorDir}(${sensorDir === 'CCW' ? '逆时针' : '顺时针'})，导入数据为${importPoint.direction}(${importPoint.direction === 'CCW' ? '逆时针' : '顺时针'})。请核实旋翼旋转方向。`,
          });
        }
      }

      if (sensorLog.unit === importPoint.unit) {
        const toleranceCheck = validateValueTolerance(
          sensorLog.value,
          importPoint.value,
          config.valueTolerance
        );

        if (toleranceCheck.exceeds) {
          conflicts.push({
            id: generateId(),
            batchId: '',
            timestamp: Date.now(),
            type: 'value_conflict',
            severity: toleranceCheck.diffPercent > config.valueTolerance * 2 ? 'critical' : 'warning',
            sensorData: {
              value: sensorLog.value,
              unit: sensorLog.unit,
              timestamp: sensorLog.timestamp,
              rawLog: sensorLog.rawLog,
            },
            importData: {
              value: importPoint.value,
              unit: importPoint.unit,
              timestamp: importPoint.timestamp,
              source: importPoint.source,
            },
            suggestedAction: `数值差异超过容差${config.valueTolerance}%，实际差异${toleranceCheck.diffPercent.toFixed(2)}%。建议检查数据采集过程是否存在异常。`,
          });
        }
      }
    }
  }

  const allTimestamps = [
    ...dataPoints.map((d) => d.timestamp),
    ...sensorLogs.map((l) => l.timestamp),
  ];
  const timeGapResults = validateTimeGap(allTimestamps, config);

  for (let i = 0; i < timeGapResults.length; i++) {
    const result = timeGapResults[i];
    if (result.exceeds) {
      const timestamps = [...allTimestamps].sort((a, b) => a - b);
      conflicts.push({
        id: generateId(),
        batchId: '',
        timestamp: Date.now(),
        type: 'timegap_error',
        severity: result.gap > config.timeGapCritical ? 'critical' : 'warning',
        sensorData: {
          value: result.gap,
          unit: 'Hz',
          timestamp: timestamps[i],
          rawLog: `时间间隔: ${result.gap.toFixed(2)}秒`,
        },
        importData: {
          value: config.timeGapWarning,
          unit: 'Hz',
          timestamp: timestamps[i + 1],
          source: 'threshold_config',
        },
        suggestedAction: `时间间隔${result.gap.toFixed(2)}秒超过阈值${config.timeGapWarning}秒。可能存在数据丢失，建议检查传感器日志完整性。`,
      });
    }
  }

  return conflicts;
};

export const detectAnomalies = (
  dataPoints: DataPoint[],
  config: ThresholdConfig
): AnomalyRecord[] => {
  const anomalies: AnomalyRecord[] = [];

  for (const dp of dataPoints) {
    if (dp.unit === 'dB' || dp.unit === 'dBA' || dp.unit === 'dBm') {
      if (dp.value >= config.noiseWarning) {
        anomalies.push({
          id: generateId(),
          batchId: '',
          type: 'threshold_exceed',
          description: `噪声值${dp.value}${dp.unit}超过${dp.value >= config.noiseCritical ? '临界' : '警告'}阈值`,
          value: dp.value,
          threshold: dp.value >= config.noiseCritical ? config.noiseCritical : config.noiseWarning,
          timestamp: dp.timestamp,
          highlighted: true,
        });
      }
    }
  }

  const values = dataPoints.filter((dp) => dp.unit === 'dB' || dp.unit === 'dBA').map((dp) => dp.value);
  if (values.length >= 3) {
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const stdDev = Math.sqrt(values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length);

    for (const dp of dataPoints) {
      if (dp.unit === 'dB' || dp.unit === 'dBA') {
        const zScore = Math.abs((dp.value - mean) / stdDev);
        if (zScore > 2.5) {
          anomalies.push({
            id: generateId(),
            batchId: '',
            type: 'outlier',
            description: `检测到异常值：${dp.value}${dp.unit}，Z分数${zScore.toFixed(2)} > 2.5`,
            value: dp.value,
            threshold: mean + 2.5 * stdDev,
            timestamp: dp.timestamp,
            highlighted: true,
          });
        }
      }
    }
  }

  return anomalies;
};

export const getHumanReadableConflictMessage = (conflict: ConflictRecord): string => {
  const typeMessages: Record<string, string> = {
    unit_mismatch: '⚠️ 单位不匹配',
    direction_error: '↺ 方向符号错误',
    timegap_error: '⏱ 时间间隔异常',
    value_conflict: '≠ 数值冲突',
  };

  const severityLabels: Record<string, string> = {
    warning: '警告',
    error: '错误',
    critical: '严重',
  };

  return `${typeMessages[conflict.type] || '冲突'} [${severityLabels[conflict.severity]}]: ${conflict.suggestedAction}`;
};

export const getValidationSummary = (
  conflicts: ConflictRecord[],
  anomalies: AnomalyRecord[]
): {
  totalIssues: number;
  criticalCount: number;
  errorCount: number;
  warningCount: number;
  canProceed: boolean;
  summary: string;
} => {
  const criticalCount = conflicts.filter((c) => c.severity === 'critical' && !c.resolution).length;
  const errorCount = conflicts.filter((c) => c.severity === 'error' && !c.resolution).length;
  const warningCount =
    conflicts.filter((c) => c.severity === 'warning' && !c.resolution).length + anomalies.length;

  const totalIssues = criticalCount + errorCount + warningCount;
  const canProceed = criticalCount === 0 && errorCount === 0;

  let summary = '';
  if (totalIssues === 0) {
    summary = '✅ 数据校验通过，无异常';
  } else if (canProceed) {
    summary = `⚠️ 存在 ${warningCount} 个警告，建议处理后继续`;
  } else {
    summary = `❌ 存在 ${criticalCount} 个严重问题和 ${errorCount} 个错误，必须处理后才能继续`;
  }

  return {
    totalIssues,
    criticalCount,
    errorCount,
    warningCount,
    canProceed,
    summary,
  };
};

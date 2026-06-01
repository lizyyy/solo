import type {
  BatteryRecord,
  DetectionStep,
  ThresholdConfig,
  AnalysisResult,
  DataQualityReport,
  RecommendationItem,
  FieldType,
} from '@/types';
import { detectExtremeValues } from './extremeDetection';
import { DEFAULT_THRESHOLD_CONFIG, FIELD_LABELS, FIELD_UNITS } from '@/config/thresholds';

export function createDetectionStep(
  step: DetectionStep['step'],
  value: number,
  threshold: number,
  formula: string,
): DetectionStep {
  const result: DetectionStep['result'] =
    value >= threshold ? 'danger' : value >= threshold * 0.8 ? 'warning' : 'normal';

  return {
    step,
    timestamp: new Date(),
    value,
    threshold,
    result,
    formula,
  };
}

export function checkDataQuality(
  records: BatteryRecord[],
  config: ThresholdConfig = DEFAULT_THRESHOLD_CONFIG,
): { records: BatteryRecord[]; report: DataQualityReport } {
  const report: DataQualityReport = {
    totalRecords: records.length,
    nullCount: 0,
    duplicateCount: 0,
    boundaryCount: 0,
    extremeCount: 0,
    nullRecords: [],
    duplicateRecords: [],
    boundaryRecords: [],
    extremeRecords: [],
  };

  const seen = new Map<string, string[]>();

  const processedRecords = records.map((record) => {
    const newRecord = { ...record, dataQuality: { ...record.dataQuality } };

    if (
      record.temperature === null ||
      record.voltage === null ||
      record.current === null ||
      record.internalResistance === null
    ) {
      newRecord.dataQuality.isNull = true;
      report.nullCount++;
      report.nullRecords.push(record.id);
    }

    const key = `${record.temperature}-${record.voltage}-${record.current}-${record.internalResistance}`;
    if (seen.has(key)) {
      seen.get(key)!.push(record.id);
      newRecord.dataQuality.isDuplicate = true;
      report.duplicateCount++;
      report.duplicateRecords.push(record.id);
    } else {
      seen.set(key, [record.id]);
    }

    if (
      record.temperature !== null &&
      (Math.abs(record.temperature - config.temperatureWarning) < 0.01 ||
        Math.abs(record.temperature - config.temperatureDanger) < 0.01)
    ) {
      newRecord.dataQuality.isBoundary = true;
      report.boundaryCount++;
      report.boundaryRecords.push(record.id);
    }

    return newRecord;
  });

  seen.forEach((ids) => {
    if (ids.length > 1) {
      ids.forEach((id) => {
        const rec = processedRecords.find((r) => r.id === id);
        if (rec) rec.dataQuality.isDuplicate = true;
      });
    }
  });

  return { records: processedRecords, report };
}

export function analyzeRecords(
  records: BatteryRecord[],
  config: ThresholdConfig = DEFAULT_THRESHOLD_CONFIG,
): { records: BatteryRecord[]; result: AnalysisResult } {
  const temperatures = records.map((r) => r.temperature).filter((v): v is number => v !== null);
  const voltages = records.map((r) => r.voltage).filter((v): v is number => v !== null);

  const tempExtremeResult = detectExtremeValues(
    temperatures,
    config.extremeStdDev,
    config.extremeIQR,
  );

  const processedRecords = records.map((record, index) => {
    const newRecord = { ...record, detectionSteps: [...record.detectionSteps] };
    const tempIndex = temperatures.indexOf(record.temperature ?? NaN);

    if (record.temperature !== null && tempIndex >= 0) {
      if (tempExtremeResult.flags[tempIndex]) {
        newRecord.dataQuality.isExtreme = true;
      }

      newRecord.detectionSteps.push(
        createDetectionStep(
          'raw',
          record.temperature,
          config.temperatureWarning,
          `原始温度值 ${record.temperature}${FIELD_UNITS.temperature}`,
        ),
      );

      newRecord.detectionSteps.push(
        createDetectionStep(
          'extremeDetection',
          record.temperature,
          config.extremeStdDev,
          `标准差法: |${record.temperature} - ${tempExtremeResult.meanWithExtremes.toFixed(1)}| > ${config.extremeStdDev} × ${tempExtremeResult.stdDev?.toFixed(1)} = ${(config.extremeStdDev * (tempExtremeResult.stdDev ?? 0)).toFixed(1)}`,
        ),
      );

      newRecord.detectionSteps.push(
        createDetectionStep(
          'thresholdCompare',
          record.temperature,
          config.temperatureWarning,
          `温度 ${record.temperature}${FIELD_UNITS.temperature} 与警告阈值 ${config.temperatureWarning}${FIELD_UNITS.temperature} 比较`,
        ),
      );

      const dangerStep = createDetectionStep(
        'riskRating',
        record.temperature,
        config.temperatureDanger,
        `温度 ${record.temperature}${FIELD_UNITS.temperature} 与危险阈值 ${config.temperatureDanger}${FIELD_UNITS.temperature} 比较`,
      );
      newRecord.detectionSteps.push(dangerStep);
    }

    return newRecord;
  });

  const validTemperatures = temperatures.filter(
    (_, i) => !tempExtremeResult.flags[i],
  );
  const meanTemperature =
    validTemperatures.reduce((a, b) => a + b, 0) / validTemperatures.length;
  const meanVoltage = voltages.reduce((a, b) => a + b, 0) / voltages.length;

  const extremeCount = processedRecords.filter(
    (r) => r.dataQuality.isExtreme,
  ).length;

  const hasDanger = processedRecords.some((r) => {
    const lastStep = r.detectionSteps[r.detectionSteps.length - 1];
    return lastStep?.result === 'danger';
  });
  const hasWarning = processedRecords.some((r) => {
    const lastStep = r.detectionSteps[r.detectionSteps.length - 1];
    return lastStep?.result === 'warning';
  });

  const riskLevel = hasDanger
    ? 'high'
    : hasWarning || extremeCount > 0
      ? 'medium'
      : 'low';

  const excludedRecords = processedRecords
    .filter((r) => r.dataQuality.isExtreme)
    .map((r) => r.id);

  const result: AnalysisResult = {
    meanTemperature,
    meanVoltage,
    extremeCount,
    riskLevel,
    excludedRecords,
  };

  return { records: processedRecords, result };
}

export function generateRecommendations(
  records: BatteryRecord[],
  analysisResult: AnalysisResult,
  dataQualityReport: DataQualityReport,
): RecommendationItem[] {
  const recommendations: RecommendationItem[] = [];

  const dangerRecords = records.filter(
    (r) =>
      r.detectionSteps[r.detectionSteps.length - 1]?.result === 'danger' &&
      !r.dataQuality.isExtreme,
  );
  if (dangerRecords.length > 0) {
    recommendations.push({
      level: 'danger',
      title: '立即处理：温度超过危险阈值',
      description: `检测到 ${dangerRecords.length} 条记录温度超过 ${DEFAULT_THRESHOLD_CONFIG.temperatureDanger}°C，存在热失控风险。`,
      action: '1. 立即切断充电/放电电源\n2. 启用紧急冷却系统\n3. 隔离该电池组\n4. 通知安全工程师到场',
      relatedRecordIds: dangerRecords.map((r) => r.id),
    });
  }

  const warningRecords = records.filter(
    (r) =>
      r.detectionSteps[r.detectionSteps.length - 1]?.result === 'warning' &&
      !r.dataQuality.isExtreme,
  );
  if (warningRecords.length > 0) {
    recommendations.push({
      level: 'warning',
      title: '计划处理：温度接近警告阈值',
      description: `检测到 ${warningRecords.length} 条记录温度超过 ${DEFAULT_THRESHOLD_CONFIG.temperatureWarning}°C，需密切关注。`,
      action: '1. 增加巡检频次至每30分钟一次\n2. 检查散热系统运行状态\n3. 降低充放电倍率\n4. 做好应急准备',
      relatedRecordIds: warningRecords.map((r) => r.id),
    });
  }

  const extremeRecords = records.filter((r) => r.dataQuality.isExtreme);
  if (extremeRecords.length > 0) {
    const temps = extremeRecords
      .map((r) => r.temperature)
      .filter((v): v is number => v !== null);
    recommendations.push({
      level: 'warning',
      title: '极端值提醒：已从平均值计算中排除',
      description: `检测到 ${extremeRecords.length} 个极端值 (${temps.join('°C, ')}°C)，已标记并排除在平均值计算外，未被平均值掩盖。`,
      action: '1. 核实极端值是否为真实数据\n2. 检查传感器是否正常工作\n3. 记录极端值发生时的工况\n4. 分析极端值出现的原因',
      relatedRecordIds: extremeRecords.map((r) => r.id),
    });
  }

  if (dataQualityReport.nullCount > 0) {
    recommendations.push({
      level: 'info',
      title: '数据质量：存在空值记录',
      description: `检测到 ${dataQualityReport.nullCount} 条记录包含空值，已标记但未参与计算。`,
      action: '1. 补充缺失的实验数据\n2. 检查数据采集设备连接\n3. 确认是否为数据传输中断导致',
      relatedRecordIds: dataQualityReport.nullRecords,
    });
  }

  if (dataQualityReport.duplicateCount > 0) {
    recommendations.push({
      level: 'info',
      title: '数据质量：存在重复记录',
      description: `检测到 ${dataQualityReport.duplicateCount} 条重复记录，已标记。`,
      action: '1. 核对重复记录的真实性\n2. 如为误导入请删除重复项\n3. 检查数据导出是否有重复',
      relatedRecordIds: dataQualityReport.duplicateRecords,
    });
  }

  if (dataQualityReport.boundaryCount > 0) {
    recommendations.push({
      level: 'info',
      title: '边界值提醒：恰好等于阈值',
      description: `检测到 ${dataQualityReport.boundaryCount} 条记录恰好等于警告或危险阈值。`,
      action: '1. 确认该数据点的准确性\n2. 关注该时间点前后的数据变化趋势\n3. 可作为阈值调整的参考依据',
      relatedRecordIds: dataQualityReport.boundaryRecords,
    });
  }

  if (analysisResult.meanTemperature > DEFAULT_THRESHOLD_CONFIG.temperatureWarning * 0.7) {
    recommendations.push({
      level: 'info',
      title: '持续观察：平均温度偏高',
      description: `排除极端值后的平均温度为 ${analysisResult.meanTemperature.toFixed(1)}°C，处于正常范围偏高区域。`,
      action: '1. 持续监测温度变化趋势\n2. 评估当前冷却系统是否足够\n3. 考虑降低充放电功率',
      relatedRecordIds: [],
    });
  }

  return recommendations;
}

export function compareAnalysisResults(
  before: AnalysisResult,
  after: AnalysisResult,
): {
  diffTemperature: number;
  diffVoltage: number;
  diffExtremeCount: number;
  riskLevelChanged: boolean;
  summary: string;
} {
  const diffTemperature = after.meanTemperature - before.meanTemperature;
  const diffVoltage = after.meanVoltage - before.meanVoltage;
  const diffExtremeCount = after.extremeCount - before.extremeCount;
  const riskLevelChanged = before.riskLevel !== after.riskLevel;

  const parts: string[] = [];
  if (diffTemperature !== 0) {
    parts.push(
      `平均温度${diffTemperature > 0 ? '上升' : '下降'} ${Math.abs(diffTemperature).toFixed(1)}°C`,
    );
  }
  if (riskLevelChanged) {
    parts.push(`风险等级从"${before.riskLevel}"变为"${after.riskLevel}"`);
  }
  if (diffExtremeCount !== 0) {
    parts.push(
      `极端值数量${diffExtremeCount > 0 ? '增加' : '减少'} ${Math.abs(diffExtremeCount)} 个`,
    );
  }

  return {
    diffTemperature,
    diffVoltage,
    diffExtremeCount,
    riskLevelChanged,
    summary: parts.length > 0 ? parts.join('；') : '无显著变化',
  };
}

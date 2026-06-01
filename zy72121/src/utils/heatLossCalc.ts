import { CalculationParams, InspectionRecord, HeatLossResult, ThresholdVersion, RiskLevel } from '../types';
import { toCelsius, toSquareMeters, fromWatts } from './unitConverter';

export const DEFAULT_PARAMS: CalculationParams = {
  airDensity: 1.2,
  specificHeatCapacity: 1.005,
  heatTransferCoeff: 3.5,
  openingTimeFactor: 0.15,
};

export function calculateHeatLoss(
  record: InspectionRecord,
  params: CalculationParams,
  threshold: ThresholdVersion,
  batchId: string
): HeatLossResult | null {
  if (
    record.temperatureInside === null ||
    record.temperatureOutside === null ||
    record.curtainArea === null
  ) {
    return null;
  }

  const tempInsideC = toCelsius(record.temperatureInside, record.tempInsideUnit);
  const tempOutsideC = toCelsius(record.temperatureOutside, record.tempOutsideUnit);
  const areaM2 = toSquareMeters(record.curtainArea, record.areaUnit);

  const deltaT = Math.abs(tempOutsideC - tempInsideC);
  const heatLossW = params.heatTransferCoeff * areaM2 * deltaT * params.openingTimeFactor;

  const targetUnit = threshold.unit || 'W';
  const heatLossValue = fromWatts(heatLossW, targetUnit);

  const riskLevel = getRiskLevel(heatLossValue, threshold);

  return {
    id: `result_${record.id}_${Date.now()}`,
    recordId: record.id,
    batchId,
    thresholdVersionId: threshold.id,
    heatLossValue: Math.round(heatLossValue * 100) / 100,
    unit: targetUnit,
    riskLevel,
    calculationParams: { ...params },
    processedAt: new Date().toISOString(),
    processedBy: '何工',
  };
}

export function getRiskLevel(value: number, threshold: ThresholdVersion): RiskLevel {
  if (value >= threshold.dangerThreshold) {
    return 'danger';
  }
  if (value >= threshold.warningThreshold) {
    return 'warning';
  }
  return 'normal';
}

export function generateActionSuggestion(
  result: HeatLossResult,
  record: InspectionRecord,
  threshold: ThresholdVersion
): string {
  const suggestions: string[] = [];
  const diffDanger = Math.round((result.heatLossValue - threshold.dangerThreshold) / threshold.dangerThreshold * 100);
  const diffWarning = Math.round((result.heatLossValue - threshold.warningThreshold) / threshold.warningThreshold * 100);

  switch (result.riskLevel) {
    case 'danger':
      suggestions.push(`【紧急处理】${record.location}热损失超过危险阈值${diffDanger > 0 ? diffDanger + '%' : ''}，需立即采取行动：`);
      suggestions.push('  1. 检查门帘密封性，确认是否有破损或老化');
      suggestions.push('  2. 核实开门频率是否异常，考虑增加自动关门装置');
      suggestions.push('  3. 联系维保人员进行现场评估，必要时更换门帘');
      suggestions.push('  4. 临时措施：在门旁增设风幕机减少热交换');
      break;
    case 'warning':
      suggestions.push(`【关注提醒】${record.location}热损失接近或超过预警阈值${diffWarning > 0 ? diffWarning + '%' : ''}，建议：`);
      suggestions.push('  1. 列入本周巡检重点关注项');
      suggestions.push('  2. 检查门帘使用情况，记录开关频次');
      suggestions.push('  3. 下周复测确认趋势，若持续走高则安排维保');
      break;
    default:
      suggestions.push(`【正常】${record.location}热损失在可控范围内，保持常规巡检即可`);
  }

  return suggestions.join('\n');
}

export function generateBatchSummary(
  results: HeatLossResult[],
  threshold: ThresholdVersion
): {
  totalRecords: number;
  normalCount: number;
  warningCount: number;
  dangerCount: number;
  avgHeatLoss: number;
  maxHeatLoss: number;
  suggestions: string[];
} {
  const normalCount = results.filter(r => r.riskLevel === 'normal').length;
  const warningCount = results.filter(r => r.riskLevel === 'warning').length;
  const dangerCount = results.filter(r => r.riskLevel === 'danger').length;
  const avgHeatLoss = results.reduce((sum, r) => sum + r.heatLossValue, 0) / results.length;
  const maxHeatLoss = Math.max(...results.map(r => r.heatLossValue));

  const suggestions: string[] = [];

  if (dangerCount > 0) {
    suggestions.push(`⚠️ 发现 ${dangerCount} 处危险级热损失，请立即安排现场处理`);
  }
  if (warningCount > 0) {
    suggestions.push(`🔔 发现 ${warningCount} 处预警级热损失，建议加强关注`);
  }
  if (dangerCount === 0 && warningCount === 0) {
    suggestions.push('✅ 所有测点热损失均在正常范围内，继续保持');
  }

  suggestions.push(`📊 平均热损失: ${Math.round(avgHeatLoss * 100) / 100} ${threshold.unit}`);
  suggestions.push(`📈 最大热损失: ${Math.round(maxHeatLoss * 100) / 100} ${threshold.unit}`);

  return {
    totalRecords: results.length,
    normalCount,
    warningCount,
    dangerCount,
    avgHeatLoss,
    maxHeatLoss,
    suggestions,
  };
}

import { WarningDetail, FaultJudgment, Threshold, VibrationData } from '../types';
import { generateFaultJudgment } from '../utils/judgmentReason';

export interface ReproductionStep {
  order: number;
  timestamp: string;
  event: string;
  isNormal: boolean;
}

export interface ReproductionAnalysis {
  steps: ReproductionStep[];
  isOrderNormal: boolean;
  abnormalReason: string;
}

export function analyzeReproductionOrder(
  thresholds: Threshold[],
  vibrationData: VibrationData[],
  operationLogs: Array<{ operatedAt: string; description: string; type: string }>,
  warningCreatedAt: string
): ReproductionAnalysis {
  const steps: ReproductionStep[] = [];
  let isOrderNormal = true;
  let abnormalReason = '';

  const events: { timestamp: Date; event: string; type: string }[] = [];

  vibrationData.forEach(v => {
    events.push({
      timestamp: new Date(v.timestamp),
      event: `采集振动数据 ${v.value.toFixed(2)} mm/s`,
      type: 'vibration',
    });
  });

  thresholds.forEach(t => {
    events.push({
      timestamp: new Date(t.submittedAt),
      event: `提交${t.metric}阈值表 ${t.actualValue}`,
      type: 'threshold',
    });
  });

  operationLogs.forEach(log => {
    events.push({
      timestamp: new Date(log.operatedAt),
      event: log.description,
      type: log.type,
    });
  });

  events.push({
    timestamp: new Date(warningCreatedAt),
    event: '故障预警触发',
    type: 'warning',
  });

  events.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

  let warningTriggered = false;

  events.forEach((event, index) => {
    let isStepNormal = true;

    if (event.type === 'threshold' && !vibrationData.length) {
      isStepNormal = false;
      isOrderNormal = false;
      abnormalReason = '阈值表提交早于振动数据采集，存在补材料嫌疑';
    }

    if (event.type === 'warning') {
      warningTriggered = true;
    }

    if (event.type === 'repair_late' && warningTriggered) {
      isStepNormal = false;
      isOrderNormal = false;
      abnormalReason = '维修单在故障预警后补填，属于晚补记录';
    }

    if (event.type === 'vibration_modified') {
      isStepNormal = false;
      isOrderNormal = false;
      abnormalReason = '振动数据存在手工修改，可能影响结论判断';
    }

    steps.push({
      order: index + 1,
      timestamp: event.timestamp.toISOString(),
      event: event.event,
      isNormal: isStepNormal,
    });
  });

  return {
    steps,
    isOrderNormal,
    abnormalReason,
  };
}

export function detectFault(warningDetail: WarningDetail): FaultJudgment {
  const { thresholds, vibrationData, createdAt } = warningDetail;

  const judgment = generateFaultJudgment({
    thresholds,
    vibrationData,
    warningCreatedAt: createdAt,
  });

  judgment.warningId = warningDetail.id;

  return judgment;
}

export function getRiskLevel(warningDetail: WarningDetail): 'low' | 'medium' | 'high' {
  if (warningDetail.faultJudgment.isAbnormal) return 'high';
  if (warningDetail.status === 'fault') return 'high';
  if (warningDetail.status === 'warning') return 'medium';
  return 'low';
}

export function formatDateTime(isoString: string): string {
  return new Date(isoString).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

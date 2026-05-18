import { RoastingBatch, BatchStatus, ValidationError, RoastLevel } from '../types';
import { store } from '../data/store';

export const RULE_THRESHOLDS = {
  MAX_WEIGHT_LOSS_PERCENTAGE: 15,
  MIN_CUPPING_SCORE: 60,
  MAX_ROAST_DEVIATION_SECONDS: 30,
  MAX_TEMPERATURE_DEVIATION: 5
};

export class BusinessRulesEngine {
  public validateBatchCreation(batch: Partial<RoastingBatch>): ValidationError[] {
    const errors: ValidationError[] = [];

    if (!batch.greenCoffeeId) {
      errors.push({
        field: 'greenCoffeeId',
        message: '必须指定生豆批次',
        code: 'MISSING_GREEN_COFFEE',
        suggestedAction: '请选择要烘焙的生豆批次'
      });
    }

    if (!batch.roastingCurveId) {
      errors.push({
        field: 'roastingCurveId',
        message: '必须指定烘焙曲线',
        code: 'MISSING_ROASTING_CURVE',
        suggestedAction: '请选择适用的烘焙曲线'
      });
    }

    if (!batch.plannedWeightKg || batch.plannedWeightKg <= 0) {
      errors.push({
        field: 'plannedWeightKg',
        message: '烘焙重量必须大于0',
        code: 'INVALID_WEIGHT',
        suggestedAction: '请输入有效的烘焙重量'
      });
    }

    if (!batch.roastMaster) {
      errors.push({
        field: 'roastMaster',
        message: '必须指定烘焙师',
        code: 'MISSING_ROAST_MASTER',
        suggestedAction: '请指定负责的烘焙师'
      });
    }

    return errors;
  }

  public checkTraceabilityConsistency(batch: RoastingBatch): { needsAttention: boolean; reasons: string[] } {
    const reasons: string[] = [];

    const relatedBatches = store.getBatchesByGreenCoffeeId(batch.greenCoffeeId)
      .filter(b => b.id !== batch.id && b.status !== BatchStatus.REJECTED);

    if (relatedBatches.length > 0) {
      const uniqueCurves = new Set([
        batch.roastingCurveId,
        ...relatedBatches.map(b => b.roastingCurveId)
      ]);

      if (uniqueCurves.size > 1) {
        reasons.push(`同一批生豆被拆分为 ${relatedBatches.length + 1} 个烘焙批次使用 ${uniqueCurves.size} 种不同烘焙曲线`);
        reasons.push('需要确认批次追溯一致性');
        reasons.push('建议品质部门进行杯测确认');
      }
    }

    if (batch.parentBatchId) {
      const parentBatch = store.getBatch(batch.parentBatchId);
      if (parentBatch) {
        reasons.push(`属于拆分批次，需要与父批次 ${parentBatch.batchNumber} 进行追溯确认`);
      }
    }

    return {
      needsAttention: reasons.length > 0,
      reasons
    };
  }

  public checkRoastingQuality(batch: RoastingBatch): { needsAttention: boolean; needsRejection: boolean; reasons: string[] } {
    const reasons: string[] = [];
    let needsRejection = false;

    if (batch.weightLossPercentage !== null) {
      if (batch.weightLossPercentage > RULE_THRESHOLDS.MAX_WEIGHT_LOSS_PERCENTAGE) {
        const issue = `${batch.roastLevel === RoastLevel.DARK ? '深' : ''}烘焙重量损耗超过预期（${batch.weightLossPercentage}% > ${RULE_THRESHOLDS.MAX_WEIGHT_LOSS_PERCENTAGE}%阈值）`;
        if (batch.weightLossPercentage > RULE_THRESHOLDS.MAX_WEIGHT_LOSS_PERCENTAGE + 2) {
          needsRejection = true;
          reasons.push(`严重: ${issue}`);
        } else {
          reasons.push(issue);
        }
      }
    }

    if (batch.cuppingResult) {
      if (batch.cuppingResult.overall < RULE_THRESHOLDS.MIN_CUPPING_SCORE) {
        needsRejection = true;
        reasons.push(`杯测分数 ${batch.cuppingResult.overall} 分低于 ${RULE_THRESHOLDS.MIN_CUPPING_SCORE} 分合格线`);
      }
    }

    if (batch.actualTemperaturePoints.length > 0 && batch.roastingCurve) {
      const curvePoints = batch.roastingCurve.temperaturePoints;
      const actualPoints = batch.actualTemperaturePoints;

      for (let i = 0; i < Math.min(curvePoints.length, actualPoints.length); i++) {
        const curveTemp = curvePoints[i].temperature;
        const actualTemp = actualPoints[i].temperature;
        const tempDiff = Math.abs(curveTemp - actualTemp);

        if (tempDiff > RULE_THRESHOLDS.MAX_TEMPERATURE_DEVIATION) {
          reasons.push(`第 ${i + 1} 个温度节点偏差超过 ${RULE_THRESHOLDS.MAX_TEMPERATURE_DEVIATION}℃（目标: ${curveTemp}℃, 实际: ${actualTemp}℃）`);
        }
      }
    }

    return {
      needsAttention: reasons.length > 0 && !needsRejection,
      needsRejection,
      reasons
    };
  }

  public determineBatchStatus(
    batch: RoastingBatch,
    traceabilityCheck: { needsAttention: boolean; reasons: string[] },
    qualityCheck: { needsAttention: boolean; needsRejection: boolean; reasons: string[] }
  ): { status: BatchStatus; attentionReasons: string[]; rejectionReason: string | null } {
    if (qualityCheck.needsRejection) {
      return {
        status: BatchStatus.REJECTED,
        attentionReasons: [],
        rejectionReason: qualityCheck.reasons.join('; ')
      };
    }

    const allAttentionReasons = [
      ...traceabilityCheck.reasons,
      ...qualityCheck.reasons
    ];

    if (allAttentionReasons.length > 0) {
      return {
        status: BatchStatus.NEEDS_ATTENTION,
        attentionReasons: allAttentionReasons,
        rejectionReason: null
      };
    }

    if (batch.endTime && batch.cuppingResult) {
      return {
        status: BatchStatus.COMPLETED,
        attentionReasons: [],
        rejectionReason: null
      };
    }

    if (batch.startTime && !batch.endTime) {
      return {
        status: BatchStatus.PROCESSING,
        attentionReasons: [],
        rejectionReason: null
      };
    }

    return {
      status: BatchStatus.DRAFT,
      attentionReasons: [],
      rejectionReason: null
    };
  }

  public generateExplanationMessage(batch: RoastingBatch): string {
    if (batch.status === BatchStatus.REJECTED) {
      return `烘焙批次 ${batch.batchNumber} 已被驳回。原因：${batch.rejectionReason}。建议：请烘焙师重新调整烘焙参数后安排重新烘焙，或联系品质部门评估是否可降级使用。`;
    }

    if (batch.status === BatchStatus.NEEDS_ATTENTION) {
      return `烘焙批次 ${batch.batchNumber} 需要人工处理。发现问题：${batch.attentionReasons.join('；')}。请品质部门进行追溯确认和杯测评估。`;
    }

    return `烘焙批次 ${batch.batchNumber} 状态正常（${batch.status}），无需特殊处理。`;
  }
}

export const rulesEngine = new BusinessRulesEngine();

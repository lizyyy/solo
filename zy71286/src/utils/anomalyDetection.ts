import type {
  TransitionMatrix,
  AnomalyRecord,
  ProductStatus,
  Severity,
} from '@/types';
import { PRODUCT_STATUSES, STATUS_LABELS } from '@/types';

const MISSING_SAMPLE_THRESHOLD = 5;
const PROMO_DISTORTION_THRESHOLD = 0.3;
const ABSORBING_TEST_THRESHOLD = 0.05;
const ABSORBING_STATES: ProductStatus[] = ['SLOW', 'CLEAR'];

function generateId(): string {
  return `anomaly-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

function detectMissingSamples(matrix: TransitionMatrix): AnomalyRecord[] {
  const anomalies: AnomalyRecord[] = [];
  const { sampleCounts, states } = matrix;

  for (let i = 0; i < states.length; i++) {
    for (let j = 0; j < states.length; j++) {
      const count = sampleCounts[i][j];
      if (count < MISSING_SAMPLE_THRESHOLD && count > 0) {
        const severity: Severity = count < 2 ? 'HIGH' : count < 5 ? 'MEDIUM' : 'LOW';
        anomalies.push({
          id: generateId(),
          type: 'MISSING_SAMPLE',
          fromStatus: states[i],
          toStatus: states[j],
          severity,
          description: `从「${STATUS_LABELS[states[i]]}」到「${STATUS_LABELS[states[j]]}」的状态跳转样本量不足，仅 ${count} 条记录，统计结果可信度较低。`,
          suggestion: severity === 'HIGH'
            ? '建议补充至少3个月的历史数据，或合并相邻状态后重新计算。'
            : '建议确认数据完整性，或在报告中标注该路径的置信度。',
          sampleCount: count,
          isResolved: false,
        });
      } else if (count === 0) {
        anomalies.push({
          id: generateId(),
          type: 'MISSING_SAMPLE',
          fromStatus: states[i],
          toStatus: states[j],
          severity: 'HIGH',
          description: `从「${STATUS_LABELS[states[i]]}」到「${STATUS_LABELS[states[j]]}」无历史跳转记录，转移概率使用拉普拉斯平滑估算，可能与实际情况存在偏差。`,
          suggestion: '建议采用贝叶斯先验或专家经验调整该转移概率，或扩大数据时间窗口。',
          sampleCount: 0,
          isResolved: false,
        });
      }
    }
  }

  return anomalies;
}

function detectPromoDistortion(
  promoMatrix: TransitionMatrix,
  nonPromoMatrix: TransitionMatrix
): AnomalyRecord[] {
  const anomalies: AnomalyRecord[] = [];
  const states = promoMatrix.states;
  const affectedTransitions: string[] = [];

  let totalDistortion = 0;
  let significantCount = 0;

  for (let i = 0; i < states.length; i++) {
    for (let j = 0; j < states.length; j++) {
      const promoP = promoMatrix.probabilities[i][j];
      const nonPromoP = nonPromoMatrix.probabilities[i][j];
      const diff = Math.abs(promoP - nonPromoP);
      const relativeDiff = nonPromoP > 0.01 ? diff / nonPromoP : diff;

      if (relativeDiff > PROMO_DISTORTION_THRESHOLD && diff > 0.05) {
        significantCount++;
        totalDistortion += relativeDiff;
        affectedTransitions.push(`${states[i]}→${states[j]}`);

        const severity: Severity = relativeDiff > 0.5 ? 'HIGH' : relativeDiff > 0.3 ? 'MEDIUM' : 'LOW';
        anomalies.push({
          id: generateId(),
          type: 'PROMO_DISTORT',
          fromStatus: states[i],
          toStatus: states[j],
          severity,
          description: `促销活动显著影响「${STATUS_LABELS[states[i]]}」→「${STATUS_LABELS[states[j]]}」转移路径：促销期概率 ${(promoP * 100).toFixed(1)}%，非促销期 ${(nonPromoP * 100).toFixed(1)}%，差异达 ${(relativeDiff * 100).toFixed(0)}%。`,
          suggestion: severity === 'HIGH'
            ? '强烈建议在预测时采用分层模型，分别预测促销期和非促销期的状态演变，避免平均化导致偏差。'
            : '建议在清仓决策时区分促销与非促销场景，设置不同的行动阈值。',
          distortionFactor: relativeDiff,
          isResolved: false,
        });
      }
    }
  }

  if (significantCount >= 3) {
    const avgDistortion = totalDistortion / significantCount;
    anomalies.push({
      id: generateId(),
      type: 'PROMO_DISTORT',
      severity: avgDistortion > 0.5 ? 'HIGH' : 'MEDIUM',
      description: `促销活动对整体转移模式存在系统性影响，共 ${significantCount} 条路径差异超过30%，平均差异度 ${(avgDistortion * 100).toFixed(1)}%。`,
      suggestion: '建议建立促销-常规双模型体系，在大促前后切换预测模型，或引入促销强度作为协变量。',
      affectedTransitions,
      distortionFactor: avgDistortion,
      isResolved: false,
    });
  }

  return anomalies;
}

function binomialTest(success: number, trials: number, p0: number): number {
  if (trials === 0) return 1;

  const p_hat = success / trials;
  const se = Math.sqrt(p0 * (1 - p0) / trials);
  if (se === 0) return 0;

  const z = (p_hat - p0) / se;

  return 2 * (1 - normalCDF(Math.abs(z)));
}

function normalCDF(x: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(x));
  const d = 0.3989423 * Math.exp(-x * x / 2);
  const prob = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return x > 0 ? 1 - prob : prob;
}

function detectAbsorbingMisset(matrix: TransitionMatrix): AnomalyRecord[] {
  const anomalies: AnomalyRecord[] = [];
  const { states, probabilities, sampleCounts } = matrix;

  ABSORBING_STATES.forEach(absState => {
    const stateIdx = states.indexOf(absState);
    if (stateIdx < 0) return;

    const rowTotal = sampleCounts[stateIdx].reduce((a, b) => a + b, 0);
    if (rowTotal === 0) return;

    let outFlowCount = 0;
    let maxOutState: ProductStatus | null = null;
    let maxOutProb = 0;

    for (let j = 0; j < states.length; j++) {
      if (!ABSORBING_STATES.includes(states[j])) {
        outFlowCount += sampleCounts[stateIdx][j];
        if (probabilities[stateIdx][j] > maxOutProb) {
          maxOutProb = probabilities[stateIdx][j];
          maxOutState = states[j];
        }
      }
    }

    const outFlowProb = outFlowCount / rowTotal;
    const pValue = binomialTest(outFlowCount, rowTotal, ABSORBING_TEST_THRESHOLD);

    if (outFlowProb > ABSORBING_TEST_THRESHOLD) {
      const severity: Severity = pValue < 0.01 ? 'HIGH' : pValue < 0.05 ? 'MEDIUM' : 'LOW';

      anomalies.push({
        id: generateId(),
        type: 'ABSORBING_MISSET',
        fromStatus: absState,
        toStatus: maxOutState || undefined,
        severity,
        description: `「${STATUS_LABELS[absState]}」被假设为吸收态，但实际观测到 ${outFlowCount}/${rowTotal} (${(outFlowProb * 100).toFixed(1)}%) 的样本转出到其他状态${maxOutState ? `，主要流向「${STATUS_LABELS[maxOutState]}」` : ''}。统计检验p值 = ${pValue.toFixed(4)}，表明吸收态假设可能不成立。`,
        suggestion: severity === 'HIGH'
          ? '强烈建议修正吸收态定义：要么收紧滞销判定标准，要么将「滞销」设为瞬态，在模型中增加「深度滞销」作为真正的吸收态。'
          : '建议检查滞销品的运营策略，是否存在清仓后重新上架的情况，必要时调整状态机设计。',
        sampleCount: outFlowCount,
        isResolved: false,
      });
    }
  });

  return anomalies;
}

export function detectAllAnomalies(
  fullMatrix: TransitionMatrix,
  promoMatrix: TransitionMatrix | null,
  nonPromoMatrix: TransitionMatrix | null
): AnomalyRecord[] {
  const anomalies: AnomalyRecord[] = [];

  anomalies.push(...detectMissingSamples(fullMatrix));

  if (promoMatrix && nonPromoMatrix) {
    anomalies.push(...detectPromoDistortion(promoMatrix, nonPromoMatrix));
  }

  anomalies.push(...detectAbsorbingMisset(fullMatrix));

  return anomalies.sort((a, b) => {
    const severityOrder: Record<Severity, number> = { HIGH: 0, MEDIUM: 1, LOW: 2 };
    if (severityOrder[a.severity] !== severityOrder[b.severity]) {
      return severityOrder[a.severity] - severityOrder[b.severity];
    }
    const typeOrder: Record<string, number> = { ABSORBING_MISSET: 0, PROMO_DISTORT: 1, MISSING_SAMPLE: 2 };
    return typeOrder[a.type] - typeOrder[b.type];
  });
}

export function calculateConfidenceRating(anomalies: AnomalyRecord[]): {
  overall: number;
  breakdown: { category: string; score: number; issues: number }[];
} {
  const missingSampleCount = anomalies.filter(a => a.type === 'MISSING_SAMPLE' && a.severity === 'HIGH').length;
  const promoDistortCount = anomalies.filter(a => a.type === 'PROMO_DISTORT' && a.severity === 'HIGH').length;
  const absorbingMissetCount = anomalies.filter(a => a.type === 'ABSORBING_MISSET' && a.severity === 'HIGH').length;

  const totalCells = PRODUCT_STATUSES.length * PRODUCT_STATUSES.length;
  const dataQualityScore = Math.max(0, 100 - missingSampleCount * (100 / totalCells) * 2);
  const modelValidityScore = Math.max(0, 100 - absorbingMissetCount * 30);
  const robustnessScore = Math.max(0, 100 - promoDistortCount * 20);

  const overall = Math.round((dataQualityScore * 0.4 + modelValidityScore * 0.35 + robustnessScore * 0.25));

  return {
    overall,
    breakdown: [
      { category: '数据质量', score: Math.round(dataQualityScore), issues: missingSampleCount },
      { category: '模型有效性', score: Math.round(modelValidityScore), issues: absorbingMissetCount },
      { category: '场景鲁棒性', score: Math.round(robustnessScore), issues: promoDistortCount },
    ],
  };
}

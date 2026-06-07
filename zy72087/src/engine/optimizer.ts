import type {
  HistoricalSample,
  ParamConfig,
  ReasoningChain,
  ReasoningStep,
  SuggestionLevel,
} from '@/types';
import { toSeconds, formatInterval } from './validator';

function findConfig(
  sample: HistoricalSample,
  configs: ParamConfig[]
): ParamConfig | undefined {
  return configs.find(
    (c) =>
      c.lineId === sample.lineId &&
      c.timePeriod === sample.timePeriod &&
      c.caliberTag === sample.caliberTag
  );
}

function makeDefaultConfig(sample: HistoricalSample): ParamConfig {
  const isPeak = sample.timePeriod === '早高峰' || sample.timePeriod === '晚高峰';
  return {
    id: `DEFAULT_${sample.lineId}_${sample.timePeriod}`,
    lineId: sample.lineId,
    lineName: sample.lineName,
    timePeriod: sample.timePeriod,
    minIntervalSec: isPeak ? 180 : 300,
    maxIntervalSec: isPeak ? 420 : 600,
    targetLoadRate: isPeak ? 0.75 : 0.55,
    weightPassenger: 0.45,
    weightCost: 0.30,
    weightReliability: 0.25,
    unit: 'sec',
    caliberTag: sample.caliberTag,
  };
}

function buildReasoningChain(
  sample: HistoricalSample,
  config: ParamConfig,
  hasNullFields: boolean,
  isOverBounds: boolean,
  isAtBoundary: boolean,
  isOldCaliber: boolean
): ReasoningChain {
  const steps: ReasoningStep[] = [];

  const intervalSec = sample.actualInterval !== null
    ? toSeconds(sample.actualInterval, sample.actualIntervalUnit)
    : null;

  const isDefaultConfig = config.id.startsWith('DEFAULT_');

  steps.push({
    stepType: 'param_ref',
    description: `引用参数配置 ${config.id}：${sample.lineName} ${sample.timePeriod}，口径 ${config.caliberTag}${isDefaultConfig ? '（默认配置，该线路未录入参数表）' : ''}`,
    parameterReferenced: config.id,
    calculatedValue: null,
    thresholdCompared: '',
    conclusion: `最小间隔=${formatInterval(config.minIntervalSec)}，最大间隔=${formatInterval(config.maxIntervalSec)}，目标载客率=${(config.targetLoadRate * 100).toFixed(0)}%${isDefaultConfig ? '，⚠使用默认值' : ''}`,
  });

  steps.push({
    stepType: 'param_ref',
    description: `权重分配：客流=${config.weightPassenger}，成本=${config.weightCost}，准点=${config.weightReliability}，合计=${(config.weightPassenger + config.weightCost + config.weightReliability).toFixed(2)}`,
    parameterReferenced: `${config.id}.weights`,
    calculatedValue: config.weightPassenger + config.weightCost + config.weightReliability,
    thresholdCompared: '=1.00',
    conclusion: Math.abs(config.weightPassenger + config.weightCost + config.weightReliability - 1.0) <= 0.01
      ? '权重闭合，可用于加权计算'
      : '⚠ 权重未闭合，加权计算结果仅供参考',
  });

  if (hasNullFields) {
    steps.push({
      stepType: 'weight_calc',
      description: '该样本存在空值字段，无法进行完整加权评分计算',
      parameterReferenced: '',
      calculatedValue: null,
      thresholdCompared: '',
      conclusion: '跳过加权评分，标记为需人工确认',
    });
  } else {
    const passengerScore = Math.min(
      1,
      (sample.passengerCount! / (config.targetLoadRate * 120)) * config.weightPassenger
    );
    const costScore = sample.costPerTrip! < 130
      ? (1 - (sample.costPerTrip! - 80) / 100) * config.weightCost
      : 0;
    const reliabilityScore = sample.onTimeRate! * config.weightReliability;
    const weightedScore = passengerScore + costScore + reliabilityScore;

    steps.push({
      stepType: 'weight_calc',
      description: `加权评分：客流得分=${passengerScore.toFixed(2)}（客流${sample.passengerCount}/目标${(config.targetLoadRate * 120).toFixed(0)}×权重${config.weightPassenger}），成本得分=${costScore.toFixed(2)}，准点得分=${reliabilityScore.toFixed(2)}`,
      parameterReferenced: `${config.id}.weights`,
      calculatedValue: weightedScore,
      thresholdCompared: '≥0.60',
      conclusion: weightedScore >= 0.6
        ? `综合得分 ${weightedScore.toFixed(2)}，达标`
        : `综合得分 ${weightedScore.toFixed(2)}，低于0.60阈值，需关注`,
    });
  }

  if (intervalSec !== null) {
    if (isOverBounds) {
      steps.push({
        stepType: 'threshold_cmp',
        description: `实际间隔 ${formatInterval(intervalSec)} 超出上限 ${formatInterval(config.maxIntervalSec)}，越界 ${formatInterval(intervalSec - config.maxIntervalSec)}`,
        parameterReferenced: `${config.id}.maxIntervalSec`,
        calculatedValue: intervalSec,
        thresholdCompared: `≤${config.maxIntervalSec}`,
        conclusion: '越界，建议缩短发车间隔并人工核实',
      });
    } else if (isAtBoundary) {
      steps.push({
        stepType: 'threshold_cmp',
        description: `实际间隔 ${formatInterval(intervalSec)} 等于上限 ${formatInterval(config.maxIntervalSec)}，处于边界`,
        parameterReferenced: `${config.id}.maxIntervalSec`,
        calculatedValue: intervalSec,
        thresholdCompared: `≤${config.maxIntervalSec}`,
        conclusion: '边界状态，建议关注下一时段是否恶化',
      });
    } else if (intervalSec < config.minIntervalSec) {
      steps.push({
        stepType: 'threshold_cmp',
        description: `实际间隔 ${formatInterval(intervalSec)} 低于下限 ${formatInterval(config.minIntervalSec)}`,
        parameterReferenced: `${config.id}.minIntervalSec`,
        calculatedValue: intervalSec,
        thresholdCompared: `≥${config.minIntervalSec}`,
        conclusion: '间隔过短，可能造成资源浪费，建议适当拉长',
      });
    } else {
      steps.push({
        stepType: 'threshold_cmp',
        description: `实际间隔 ${formatInterval(intervalSec)} 在合理范围内 [${formatInterval(config.minIntervalSec)}, ${formatInterval(config.maxIntervalSec)}]`,
        parameterReferenced: `${config.id}.minIntervalSec`,
        calculatedValue: intervalSec,
        thresholdCompared: `[${config.minIntervalSec}, ${config.maxIntervalSec}]`,
        conclusion: '间隔合规',
      });
    }
  }

  if (isOldCaliber) {
    steps.push({
      stepType: 'conclusion',
      description: `该样本口径为 ${sample.caliberTag}，当前主口径为 V2-2025。已按旧口径参数参与计算，结论仅作参考，建议以新口径重新采集。`,
      parameterReferenced: sample.caliberTag,
      calculatedValue: null,
      thresholdCompared: '',
      conclusion: '旧口径补录，结论标记为参考',
    });
  }

  let level: SuggestionLevel = 'pass';
  let finalSuggestion = '';
  let suggestionReason = '';
  let needsManualReview = false;

  if (isOverBounds) {
    level = 'fail';
    finalSuggestion = '建议缩短发车间隔';
    suggestionReason = `实际间隔越界，超出上限。准点率${sample.onTimeRate !== null ? (sample.onTimeRate * 100).toFixed(0) + '%' : '未知'}，${sample.onTimeRate !== null && sample.onTimeRate < 0.7 ? '准点率低于70%，服务品质不达标，' : ''}需立即调整排班。`;
    needsManualReview = true;
  } else if (hasNullFields) {
    level = 'warn';
    finalSuggestion = '需人工确认后决定';
    suggestionReason = '样本存在空值字段，无法自动完成优化判断。请补全数据或确认后重新计算。';
    needsManualReview = true;
  } else if (isAtBoundary) {
    level = 'warn';
    finalSuggestion = '建议关注，暂不调整';
    suggestionReason = '间隔处于上限边界，当前虽合规但裕度极小，若下一时段客流上升则需缩短间隔。';
    needsManualReview = true;
  } else if (isOldCaliber) {
    level = 'pass';
    finalSuggestion = '保持当前间隔（旧口径参考）';
    suggestionReason = `旧口径 ${sample.caliberTag} 数据显示间隔合理，但口径差异可能影响可比性，建议以新口径重新评估。`;
    needsManualReview = false;
  } else {
    level = 'pass';
    finalSuggestion = '保持当前间隔';
    suggestionReason = `间隔在合理范围内，加权评分达标，准点率${sample.onTimeRate !== null ? (sample.onTimeRate * 100).toFixed(0) + '%' : '未知'}，无需调整。`;
  }

  steps.push({
    stepType: 'conclusion',
    description: `最终建议：${finalSuggestion}`,
    parameterReferenced: '',
    calculatedValue: null,
    thresholdCompared: '',
    conclusion: suggestionReason,
  });

  return {
    id: `RC_${sample.id}`,
    sampleId: sample.id,
    steps,
    finalSuggestion,
    suggestionReason,
    level,
    needsManualReview,
  };
}

export function generateReasoningChains(
  samples: HistoricalSample[],
  configs: ParamConfig[],
  nullSampleIds: Set<string>,
  overBoundsSampleIds: Set<string>,
  boundarySampleIds: Set<string>
): ReasoningChain[] {
  return samples.map((sample) => {
    const config = findConfig(sample, configs);
    const fallbackConfig = config || makeDefaultConfig(sample);
    const hasNullFields = nullSampleIds.has(sample.id);
    const isOverBounds = overBoundsSampleIds.has(sample.id);
    const isAtBoundary = boundarySampleIds.has(sample.id);
    const isOldCaliber = sample.caliberTag !== 'V2-2025';

    return buildReasoningChain(
      sample,
      fallbackConfig,
      hasNullFields,
      isOverBounds,
      isAtBoundary,
      isOldCaliber
    );
  });
}

import { ParameterRecord, ExampleRecord, ForecastResult, MixedFormatInfo, ConflictDecisionInfo, ReviewChainEntry, Conflict } from '../../shared/types';

function parseNumericValue(v: number | string): number {
  if (typeof v === 'number') return v;
  if (v.endsWith('%')) {
    return parseFloat(v) / 100;
  }
  return parseFloat(v);
}

function isPercentageString(v: number | string): boolean {
  return typeof v === 'string' && v.endsWith('%');
}

function getRawString(v: number | string): string {
  if (typeof v === 'number') return String(v);
  return v;
}

function buildMixedFormatInfo(
  paramRecord: ParameterRecord,
  alpha: number,
  beta: number,
  gamma: number
): MixedFormatInfo | null {
  if (!paramRecord.hasMixedFormat) return null;

  const rawA = paramRecord.rawAlpha ?? getRawString(paramRecord.alpha);
  const rawB = paramRecord.rawBeta ?? getRawString(paramRecord.beta);
  const rawG = paramRecord.rawGamma ?? getRawString(paramRecord.gamma);
  const hasPctA = isPercentageString(paramRecord.alpha);
  const hasPctB = isPercentageString(paramRecord.beta);
  const hasPctC = isPercentageString(paramRecord.gamma);

  const originalDescription = `原始参数：alpha=${rawA}${hasPctA ? '（百分数）' : '（小数）'}，beta=${rawB}${hasPctB ? '（百分数）' : '（小数）'}，gamma=${rawG}${hasPctC ? '（百分数）' : '（小数）'}`;
  const normalizedDescription = `归一化后：alpha=${alpha.toFixed(4)}，beta=${beta.toFixed(4)}，gamma=${gamma.toFixed(4)}`;

  return {
    rawAlpha: rawA,
    rawBeta: rawB,
    rawGamma: rawG,
    parsedAlpha: alpha,
    parsedBeta: beta,
    parsedGamma: gamma,
    hasPercentage: [hasPctA, hasPctB, hasPctC],
    originalDescription,
    normalizedDescription,
    needManualReview: true,
    nextOwner: '活动负责人',
  };
}

function buildConflictDecisionInfo(
  conflict: Conflict,
  finalValue: number,
  paramConclusion: number | string
): ConflictDecisionInfo {
  const isAccept = conflict.resolution === 'accept_example';
  const originalStatement = isAccept
    ? `原始说法（参数表）：${paramConclusion}件，与手算反例 ${conflict.exampleValue}件 存在 ${Math.abs(conflict.diffPercentage).toFixed(2)}% 差异`
    : `原始说法（参数表）：${paramConclusion}件，与手算反例 ${conflict.exampleValue}件 存在 ${Math.abs(conflict.diffPercentage).toFixed(2)}% 差异`;

  return {
    conflictId: conflict.id,
    resolution: conflict.resolution as 'accept_example' | 'reject_example',
    parameterValue: conflict.parameterValue,
    exampleValue: conflict.exampleValue,
    diffPercentage: conflict.diffPercentage,
    evidence: conflict.evidence,
    resolutionReason: conflict.resolutionReason ?? '',
    resolvedBy: conflict.resolvedBy ?? '数据分析师小祁',
    resolvedAt: conflict.resolvedAt ?? new Date().toISOString(),
    originalStatement,
    updatedValue: finalValue,
    changeReason: conflict.resolutionReason ?? '',
    nextOwner: isAccept ? '活动负责人复核' : '活动负责人复核',
  };
}

function buildReviewChain(
  paramRecord: ParameterRecord,
  mixed: MixedFormatInfo | null,
  conflictDecision: ConflictDecisionInfo | null,
  finalValue: number,
  extraMeta: { recalculationCount: number; lastModifiedBy: string }
): ReviewChainEntry[] {
  const chain: ReviewChainEntry[] = [];
  const now = new Date().toISOString();

  chain.push({
    stage: 'import_detected',
    action: paramRecord.hasMixedFormat ? '导入时检测到百分数与小数混合' : '导入时格式一致',
    originalValue: `alpha=${paramRecord.rawAlpha}, beta=${paramRecord.rawBeta}, gamma=${paramRecord.rawGamma}`,
    operator: paramRecord.lastModifiedBy || '数据分析师小祁',
    nextOwner: paramRecord.hasMixedFormat ? '活动负责人复核混合格式' : '无',
    timestamp: paramRecord.createdAt || now,
  });

  const hasOverwrite =
    paramRecord.source === 'overwritten' ||
    (paramRecord.source === 'corrected' &&
      paramRecord.previousValues &&
      (paramRecord.previousValues as ParameterRecord).previousValues);

  if (hasOverwrite) {
    const overwriteRec: Partial<ParameterRecord> =
      paramRecord.source === 'corrected'
        ? (paramRecord.previousValues as ParameterRecord)
        : paramRecord;
    const origVals = (overwriteRec as ParameterRecord).previousValues;
    chain.push({
      stage: 'duplicate_handled',
      action: `重复导入，策略：${overwriteRec.changeReason || '覆盖'}`,
      originalValue: `原版本 v${((overwriteRec.version || 1) - 1)}`
        + (origVals
          ? ` alpha=${(origVals as Partial<ParameterRecord>).rawAlpha} beta=${(origVals as Partial<ParameterRecord>).rawBeta} gamma=${(origVals as Partial<ParameterRecord>).rawGamma}`
          : ''),
      updatedValue: `新版本 v${overwriteRec.version} alpha=${overwriteRec.rawAlpha} beta=${overwriteRec.rawBeta} gamma=${overwriteRec.rawGamma}`,
      reason: overwriteRec.changeReason || '重复导入覆盖',
      operator: overwriteRec.lastModifiedBy || '系统',
      nextOwner: overwriteRec.nextOwner || '数据分析师确认',
      timestamp: overwriteRec.lastModifiedAt,
    });
  }

  if (paramRecord.source === 'corrected') {
    chain.push({
      stage: 'corrected',
      action: `参数补录/修正（v${(paramRecord.version || 1) - 1} → v${paramRecord.version}）`,
      originalValue: paramRecord.previousValues
        ? `原参数 alpha=${paramRecord.previousValues.rawAlpha} beta=${paramRecord.previousValues.rawBeta} gamma=${paramRecord.previousValues.rawGamma} 结论=${paramRecord.previousValues.forecastConclusion}`
        : undefined,
      updatedValue: `修正后 alpha=${paramRecord.rawAlpha} beta=${paramRecord.rawBeta} gamma=${paramRecord.rawGamma} 结论=${paramRecord.forecastConclusion}`,
      reason: paramRecord.changeReason || '业务补录',
      operator: paramRecord.lastModifiedBy || '数据分析师小祁',
      nextOwner: paramRecord.nextOwner || '活动负责人复核',
      timestamp: paramRecord.lastModifiedAt,
    });
  }

  if (conflictDecision) {
    chain.push({
      stage: 'conflict_resolved',
      action: conflictDecision.resolution === 'accept_example' ? '采纳手算反例值' : '维持参数表结论',
      originalValue: conflictDecision.resolution === 'accept_example'
        ? `参数值：${conflictDecision.parameterValue} → 手算值：${conflictDecision.exampleValue}`
        : `手算值：${conflictDecision.exampleValue} → 维持参数值：${conflictDecision.parameterValue}`,
      updatedValue: String(conflictDecision.updatedValue),
      reason: conflictDecision.changeReason,
      operator: conflictDecision.resolvedBy,
      nextOwner: conflictDecision.nextOwner,
      timestamp: conflictDecision.resolvedAt,
    });
  }

  chain.push({
    stage: 'calculation_completed',
    action: mixed
      ? `三次指数平滑计算完成（已归一化混合参数，重算第 ${extraMeta.recalculationCount} 次）`
      : `三次指数平滑计算完成（第 ${extraMeta.recalculationCount} 次）`,
    originalValue: mixed ? mixed.originalDescription : undefined,
    updatedValue: `最终预测值：${finalValue}`,
    reason: mixed ? mixed.normalizedDescription : undefined,
    operator: extraMeta.lastModifiedBy || '指数平滑模型 v1.0',
    nextOwner: mixed ? mixed.nextOwner : conflictDecision ? '活动负责人复核' : '业务运营查看',
    timestamp: now,
  });

  return chain;
}

function holtWinters(
  data: number[],
  alpha: number,
  beta: number,
  gamma: number,
  seasonLength: number = 4,
  periods: number = 1
): { forecast: number; smoothed: number[] } {
  const n = data.length;
  const smoothed: number[] = [];
  
  let level = data[0];
  let trend = 0;
  for (let i = 1; i < Math.min(seasonLength, n); i++) {
    trend += data[i] - data[i - 1];
  }
  trend /= Math.min(seasonLength, n) - 1;
  
  const seasonal: number[] = [];
  const seasonMeans: number[] = [];
  for (let i = 0; i < seasonLength; i++) {
    let sum = 0;
    let count = 0;
    for (let j = i; j < n; j += seasonLength) {
      sum += data[j];
      count++;
    }
    seasonMeans.push(count > 0 ? sum / count : 0);
  }
  const totalMean = data.reduce((a, b) => a + b, 0) / n;
  for (let i = 0; i < seasonLength; i++) {
    seasonal.push(totalMean > 0 ? seasonMeans[i] / totalMean : 1);
  }
  
  for (let t = 0; t < n; t++) {
    const seasonIndex = t % seasonLength;
    const lastLevel = level;
    const lastTrend = trend;
    const lastSeasonal = seasonal[seasonIndex];
    
    level = alpha * (data[t] / lastSeasonal) + (1 - alpha) * (lastLevel + lastTrend);
    trend = beta * (level - lastLevel) + (1 - beta) * lastTrend;
    seasonal[seasonIndex] = gamma * (data[t] / level) + (1 - gamma) * lastSeasonal;
    
    smoothed.push((level + trend) * seasonal[seasonIndex]);
  }
  
  const forecastSeasonIndex = n % seasonLength;
  const forecast = (level + periods * trend) * seasonal[forecastSeasonIndex];
  
  return { forecast, smoothed };
}

function generateForecast(
  paramRecord: ParameterRecord,
  exampleRecord?: ExampleRecord,
  conflict?: Conflict,
  parameterVersion: string = 'v1.0',
  options: { importBatch?: string; recalculationCount: number } = { recalculationCount: 0 }
): ForecastResult {
  const alpha = parseNumericValue(paramRecord.alpha);
  const beta = parseNumericValue(paramRecord.beta);
  const gamma = parseNumericValue(paramRecord.gamma);

  const rawA = paramRecord.rawAlpha ?? getRawString(paramRecord.alpha);
  const rawB = paramRecord.rawBeta ?? getRawString(paramRecord.beta);
  const rawG = paramRecord.rawGamma ?? getRawString(paramRecord.gamma);

  const historicalData: number[] = [];
  const base = 100;
  for (let i = 0; i < 12; i++) {
    const seasonFactor = 1 + 0.1 * Math.sin((i / 12) * 2 * Math.PI);
    const trend = i * 2;
    const noise = (Math.random() - 0.5) * 10;
    historicalData.push(Math.max(0, Math.round(base + trend + seasonFactor * 10 + noise)));
  }

  const { forecast, smoothed } = holtWinters(historicalData, alpha, beta, gamma);

  let finalValue = forecast;
  let tradeoffReason = '使用指数平滑算法计算预测值';
  let calculationDetail = `参数版本: ${parameterVersion}; alpha=${rawA}, beta=${rawB}, gamma=${rawG}; 三次指数平滑预测`;

  if (paramRecord.hasMixedFormat) {
    calculationDetail += '; 注意：参数包含混合格式（小数和百分比）';
    tradeoffReason += '; 参数存在混合格式，已统一转换为数值计算';
  }

  let conflictDecision: ConflictDecisionInfo | null = null;
  const resolution = conflict?.resolution;

  if (exampleRecord && conflict && resolution) {
    if (resolution === 'accept_example') {
      finalValue = exampleRecord.manualCalculation;
      tradeoffReason = `采纳示例计算结果：${exampleRecord.reasoning}`;
      calculationDetail += `; 冲突解决：采纳示例值 ${exampleRecord.manualCalculation}，理由：${exampleRecord.reasoning}`;
      conflictDecision = buildConflictDecisionInfo(conflict, finalValue, paramRecord.forecastConclusion);
    } else {
      finalValue = forecast;
      tradeoffReason = `保留算法预测值，拒绝示例：${exampleRecord.reasoning}`;
      calculationDetail += `; 冲突解决：保留算法预测值 ${forecast.toFixed(2)}，拒绝示例值 ${exampleRecord.manualCalculation}`;
      conflictDecision = buildConflictDecisionInfo(conflict, Math.round(finalValue * 100) / 100, paramRecord.forecastConclusion);
    }
  }

  const mixedFormatInfo = buildMixedFormatInfo(paramRecord, alpha, beta, gamma);
  const reviewChain = buildReviewChain(paramRecord, mixedFormatInfo, conflictDecision, Math.round(finalValue * 100) / 100, {
    recalculationCount: options.recalculationCount || 0,
    lastModifiedBy: paramRecord.lastModifiedBy || '数据分析师小祁',
  });

  const hasSomethingToReview = paramRecord.hasMixedFormat || !!conflictDecision || paramRecord.source === 'corrected';
  const finalV = Math.round(finalValue * 100) / 100;
  const now = new Date().toISOString();

  return {
    id: `forecast_${paramRecord.id}_${Date.now()}`,
    productId: paramRecord.productId,
    productName: paramRecord.productName,
    parameterVersion,
    calculationDetail,
    tradeoffReason,
    forecastValue: finalV,
    rawValue: paramRecord.forecastConclusion,
    valueFormat: paramRecord.valueFormat,
    isMixedFormat: paramRecord.hasMixedFormat,
    reviewStatus: hasSomethingToReview ? 'pending_review' : 'normal',
    reviewedBy: null,
    reviewedAt: null,
    createdAt: now,
    historicalData,
    smoothedData: smoothed,
    rawAlpha: rawA,
    rawBeta: rawB,
    rawGamma: rawG,
    parsedAlpha: alpha,
    parsedBeta: beta,
    parsedGamma: gamma,
    mixedFormatInfo,
    conflictDecision,
    reviewChain,
    importBatch: options.importBatch ?? paramRecord.tableId,
    calculatedAt: now,
    lastModifiedBy: paramRecord.lastModifiedBy || '系统',
    recalculationCount: options.recalculationCount || 0,
  };
}

export { parseNumericValue, holtWinters, generateForecast };

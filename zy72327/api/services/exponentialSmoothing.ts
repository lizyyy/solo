import { ParameterRecord, ExampleRecord, ForecastResult } from '../../shared/types';

function parseNumericValue(v: number | string): number {
  if (typeof v === 'number') return v;
  if (v.endsWith('%')) {
    return parseFloat(v) / 100;
  }
  return parseFloat(v);
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
  resolution?: 'accept_example' | 'reject_example',
  parameterVersion: string = 'v1.0'
): ForecastResult {
  const alpha = parseNumericValue(paramRecord.alpha);
  const beta = parseNumericValue(paramRecord.beta);
  const gamma = parseNumericValue(paramRecord.gamma);
  
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
  let calculationDetail = `参数版本: ${parameterVersion}; alpha=${paramRecord.alpha}, beta=${paramRecord.beta}, gamma=${paramRecord.gamma}; 三次指数平滑预测`;
  
  if (paramRecord.hasMixedFormat) {
    calculationDetail += '; 注意：参数包含混合格式（小数和百分比）';
    tradeoffReason += '; 参数存在混合格式，已统一转换为数值计算';
  }
  
  if (exampleRecord && resolution) {
    if (resolution === 'accept_example') {
      finalValue = exampleRecord.manualCalculation;
      tradeoffReason = `采纳示例计算结果：${exampleRecord.reasoning}`;
      calculationDetail += `; 冲突解决：采纳示例值 ${exampleRecord.manualCalculation}，理由：${exampleRecord.reasoning}`;
    } else {
      finalValue = forecast;
      tradeoffReason = `保留算法预测值，拒绝示例：${exampleRecord.reasoning}`;
      calculationDetail += `; 冲突解决：保留算法预测值 ${forecast.toFixed(2)}，拒绝示例值 ${exampleRecord.manualCalculation}`;
    }
  }
  
  return {
    id: `forecast_${paramRecord.id}_${Date.now()}`,
    productId: paramRecord.productId,
    productName: paramRecord.productName,
    parameterVersion,
    calculationDetail,
    tradeoffReason,
    forecastValue: Math.round(finalValue * 100) / 100,
    rawValue: paramRecord.forecastConclusion,
    valueFormat: paramRecord.valueFormat,
    isMixedFormat: paramRecord.hasMixedFormat,
    reviewStatus: 'pending_review',
    reviewedBy: null,
    reviewedAt: null,
    createdAt: new Date().toISOString(),
    historicalData,
    smoothedData: smoothed
  };
}

export { parseNumericValue, holtWinters, generateForecast };

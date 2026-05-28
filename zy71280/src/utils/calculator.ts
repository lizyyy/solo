import type {
  AuctionItem,
  BidRecord,
  TransactionRecord,
  CalculationParams,
  CalculationPoint,
  ScenarioType,
  CommissionTier,
} from '../types/auction';
import rules from '../data/rules.json';

function calculateCommission(amount: number, tiers: CommissionTier[]): number {
  let commission = 0;
  let remaining = amount;

  for (const tier of tiers) {
    const tierMax = tier.maxAmount ?? Infinity;
    const tierMin = tier.minAmount;

    if (remaining <= 0) break;

    const tierRange = tierMax - tierMin;
    if (tierRange <= 0) continue;

    const taxableInTier = Math.min(remaining, tierRange);
    commission += taxableInTier * (tier.rate / 100);
    remaining -= taxableInTier;
  }

  return Math.round(commission);
}

function calculateMean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function calculateStdDev(values: number[], mean: number): number {
  if (values.length <= 1) return mean * 0.15;
  const squaredDiffs = values.map(v => Math.pow(v - mean, 2));
  const stdDev = Math.sqrt(squaredDiffs.reduce((sum, v) => sum + v, 0) / (values.length - 1));
  return Math.max(stdDev, mean * 0.08);
}

function normalCDF(x: number, mean: number, stdDev: number): number {
  if (stdDev === 0) return x >= mean ? 1 : 0;
  const z = (x - mean) / stdDev;
  return 0.5 * (1 + erf(z / Math.SQRT2));
}

function erf(x: number): number {
  const a1 =  0.254829592;
  const a2 = -0.284496736;
  const a3 =  1.421413741;
  const a4 = -1.453152027;
  const a5 =  1.061405429;
  const p  =  0.3275911;

  const sign = x < 0 ? -1 : 1;
  const absX = Math.abs(x);
  const t = 1.0 / (1.0 + p * absX);
  const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-absX * absX);
  return sign * y;
}

export function calculateExpectedRevenue(
  reservePrice: number,
  appraisedValue: number,
  bids: BidRecord[],
  transactions: TransactionRecord[],
  params: CalculationParams,
  scenario: ScenarioType = 'neutral',
  itemId?: string
): CalculationPoint {
  const scenarioAdj = rules.scenarioAdjustments[scenario];

  const relevantBids = itemId 
    ? bids.filter(b => b.itemId === itemId)
    : bids.filter(b => b.itemId);
  const relevantTrxs = itemId
    ? transactions.filter(t => t.itemId === itemId && t.salePrice > 0)
    : transactions.filter(t => t.salePrice > 0);

  const weightedBidAmounts = relevantBids.map(b => {
    const activityFactor = 1 + (b.buyerActivity / 10 - 0.5) * params.buyerWeight * scenarioAdj.activity;
    return b.bidAmount * activityFactor;
  });

  const trxPrices = relevantTrxs.map(t => t.salePrice);
  const allPrices = [...weightedBidAmounts, ...trxPrices];

  if (allPrices.length === 0) {
    return {
      reservePrice,
      reserveRatio: reservePrice / appraisedValue,
      expectedRevenue: appraisedValue * 0.5,
      expectedCommission: 0,
      unsoldProbability: 0.5,
      confidence: 0.3,
      scenario,
    };
  }

  const meanPrice = calculateMean(allPrices);
  const stdDev = calculateStdDev(allPrices, meanPrice);

  const adjustedStdDev = stdDev * scenarioAdj.probability;

  const saleProbability = 1 - normalCDF(reservePrice, meanPrice, adjustedStdDev);

  const expectedSalePrice = reservePrice + (meanPrice - reservePrice) * (1 - normalCDF(reservePrice, meanPrice, adjustedStdDev * 1.5));

  const expectedCommission = calculateCommission(expectedSalePrice, params.commissionTiers);

  const unsoldCost = appraisedValue * params.unsoldCostCoefficient;

  const expectedRevenue = (expectedSalePrice + expectedCommission) * saleProbability - unsoldCost * (1 - saleProbability);

  const sampleSize = allPrices.length;
  const confidence = Math.min(1, sampleSize / rules.sampleSizeThresholds.good) * (1 - Math.abs(params.riskTolerance - 0.5));

  return {
    reservePrice,
    reserveRatio: reservePrice / appraisedValue,
    expectedRevenue: Math.round(expectedRevenue),
    expectedCommission: Math.round(expectedCommission),
    unsoldProbability: Math.round((1 - saleProbability) * 100) / 100,
    confidence: Math.round(confidence * 100) / 100,
    scenario,
  };
}

export function applyRiskConstraints(
  points: CalculationPoint[],
  params: CalculationParams
): CalculationPoint[] {
  const filtered = points.filter(p => {
    if (p.unsoldProbability > params.maxUnsoldProbability) return false;
    if (p.expectedCommission < params.minCommissionGuarantee) return false;
    if (p.reserveRatio < params.minReserveRatio || p.reserveRatio > params.maxReserveRatio) return false;
    return true;
  });
  
  if (filtered.length === 0 && points.length > 0) {
    console.warn('风险约束过滤掉了所有点，使用原始数据中期望收益最高的点');
    const bestPoint = findOptimalPoint(points);
    return bestPoint ? [bestPoint] : points;
  }
  
  return filtered;
}

export function calculateScenarios(
  item: AuctionItem,
  bids: BidRecord[],
  transactions: TransactionRecord[],
  params: CalculationParams
): {
  conservative: CalculationPoint[];
  neutral: CalculationPoint[];
  optimistic: CalculationPoint[];
} {
  const scenarios: ScenarioType[] = ['conservative', 'neutral', 'optimistic'];
  const result: Record<string, CalculationPoint[]> = {};

  for (const scenario of scenarios) {
    const points: CalculationPoint[] = [];
    const minReserve = item.appraisedValue * params.minReserveRatio;
    const maxReserve = item.appraisedValue * params.maxReserveRatio;
    const step = (maxReserve - minReserve) / 20;

    for (let reserve = minReserve; reserve <= maxReserve; reserve += step) {
      points.push(calculateExpectedRevenue(
        Math.round(reserve),
        item.appraisedValue,
        bids,
        transactions,
        params,
        scenario,
        item.id
      ));
    }

    result[scenario] = points;
  }

  return {
    conservative: result.conservative,
    neutral: result.neutral,
    optimistic: result.optimistic,
  };
}

export function findOptimalPoint(points: CalculationPoint[]): CalculationPoint | null {
  if (points.length === 0) return null;
  return points.reduce((best, current) =>
    current.expectedRevenue > best.expectedRevenue ? current : best
  );
}

export function calculateConfidenceInterval(
  sampleSize: number,
  mean: number,
  stdDev: number,
  confidenceLevel: number = 0.95
): [number, number] {
  const zScore = confidenceLevel === 0.99 ? 2.576 : confidenceLevel === 0.90 ? 1.645 : 1.96;
  const marginOfError = zScore * (stdDev / Math.sqrt(sampleSize));
  return [mean - marginOfError, mean + marginOfError];
}

export function calculateUnsoldCost(
  appraisedValue: number,
  reAuctionCount: number,
  storageMonths: number = 3
): {
  storageCost: number;
  marketingCost: number;
  opportunityCost: number;
  total: number;
} {
  const components = rules.unsoldCostComponents;
  const storageCost = appraisedValue * components[0].default * storageMonths;
  const marketingCost = appraisedValue * components[1].default;
  const opportunityCost = appraisedValue * components[2].default;

  return {
    storageCost: Math.round(storageCost),
    marketingCost: Math.round(marketingCost),
    opportunityCost: Math.round(opportunityCost),
    total: Math.round(storageCost + marketingCost + opportunityCost),
  };
}

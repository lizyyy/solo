import type { BudgetRule, MetricPoint, BudgetConsumption, ServiceStatus, ReleaseDecision, FreezeReason, TrendPoint } from '../types/index.js';

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
const MINUTE_MS = 60 * 1000;

export interface BudgetCalcInput {
  rule: BudgetRule;
  metrics: MetricPoint[];
  now: number;
}

export function calculateBudgetConsumption(input: BudgetCalcInput): BudgetConsumption | null {
  const { rule, metrics, now } = input;
  
  const windowEnd = now;
  const windowStart = now - rule.windowDays * DAY_MS;
  
  const windowMetrics = metrics.filter(m => m.timestamp >= windowStart && m.timestamp <= windowEnd);
  
  if (windowMetrics.length === 0) {
    return null;
  }
  
  const totalRequests = windowMetrics.reduce((sum, m) => sum + m.totalRequests, 0);
  const errorRequests = windowMetrics.reduce((sum, m) => sum + m.errorRequests, 0);
  
  const allowedErrors = totalRequests * (rule.budgetPercent / 100);
  const consumedBudget = errorRequests;
  const remainingBudget = Math.max(0, allowedErrors - errorRequests);
  const remainingPercent = allowedErrors > 0 ? (remainingBudget / allowedErrors) * 100 : 0;
  
  const burnRate = calculateBurnRate(windowMetrics, rule, now);
  const burnRateLevel = getBurnRateLevel(burnRate, rule);
  
  const isSpike = detectSpike(windowMetrics, rule, now);
  const isSustainedBurn = detectSustainedBurn(windowMetrics, rule, now);
  
  const { status, decision, freezeReason } = determineStatusAndDecision(
    remainingPercent, burnRate, burnRateLevel, isSpike, isSustainedBurn, rule
  );
  
  return {
    serviceId: rule.serviceId,
    endpointId: rule.endpointId,
    budgetRuleId: rule.id,
    windowStart,
    windowEnd,
    totalBudget: allowedErrors,
    consumedBudget,
    remainingBudget,
    remainingPercent,
    burnRate,
    burnRateLevel,
    isSpike,
    isSustainedBurn,
    status,
    decision,
    freezeReason,
  };
}

export function calculateBurnRate(metrics: MetricPoint[], rule: BudgetRule, now: number): number {
  const longWindowStart = now - rule.windowDays * DAY_MS;
  const shortWindowStart = now - 1 * HOUR_MS;
  
  const shortMetrics = metrics.filter(m => m.timestamp >= shortWindowStart && m.timestamp <= now);
  
  if (shortMetrics.length === 0) {
    return 0;
  }
  
  const shortTotal = shortMetrics.reduce((sum, m) => sum + m.totalRequests, 0);
  const shortErrors = shortMetrics.reduce((sum, m) => sum + m.errorRequests, 0);
  
  const shortErrorRate = shortTotal > 0 ? shortErrors / shortTotal : 0;
  const budgetPerHour = (rule.budgetPercent / 100) * (shortTotal / (rule.windowDays * 24));
  
  if (budgetPerHour <= 0) return 0;
  
  return shortErrors / budgetPerHour;
}

function getBurnRateLevel(burnRate: number, rule: BudgetRule): 'normal' | 'warning' | 'critical' {
  if (burnRate >= rule.burnRateThreshold2) return 'critical';
  if (burnRate >= rule.burnRateThreshold1) return 'warning';
  return 'normal';
}

function detectSpike(metrics: MetricPoint[], rule: BudgetRule, now: number): boolean {
  const spikeWindowStart = now - rule.spikeWindowMinutes * MINUTE_MS;
  const spikeMetrics = metrics.filter(m => m.timestamp >= spikeWindowStart && m.timestamp <= now);
  
  if (spikeMetrics.length < 2) return false;
  
  const prevWindowStart = spikeWindowStart - rule.spikeWindowMinutes * MINUTE_MS;
  const prevMetrics = metrics.filter(m => m.timestamp >= prevWindowStart && m.timestamp < spikeWindowStart);
  
  const spikeErrors = spikeMetrics.reduce((sum, m) => sum + m.errorRequests, 0);
  const spikeTotal = spikeMetrics.reduce((sum, m) => sum + m.totalRequests, 0);
  const spikeRate = spikeTotal > 0 ? spikeErrors / spikeTotal : 0;
  
  const prevErrors = prevMetrics.reduce((sum, m) => sum + m.errorRequests, 0);
  const prevTotal = prevMetrics.reduce((sum, m) => sum + m.totalRequests, 0);
  const prevRate = prevTotal > 0 ? prevErrors / prevTotal : 0;
  
  if (prevRate === 0) return spikeRate > 0.05;
  
  return spikeRate > prevRate * 3 && spikeRate > 0.02;
}

function detectSustainedBurn(metrics: MetricPoint[], rule: BudgetRule, now: number): boolean {
  const sustainedStart = now - rule.spikeSustainedMinutes * MINUTE_MS;
  const sustainedMetrics = metrics.filter(m => m.timestamp >= sustainedStart && m.timestamp <= now);
  
  if (sustainedMetrics.length < 3) return false;
  
  const intervalMs = 5 * MINUTE_MS;
  const intervals: MetricPoint[][] = [];
  let currentInterval: MetricPoint[] = [];
  let intervalStart = sustainedStart;
  
  for (const m of sustainedMetrics.sort((a, b) => a.timestamp - b.timestamp)) {
    if (m.timestamp >= intervalStart + intervalMs) {
      if (currentInterval.length > 0) intervals.push(currentInterval);
      currentInterval = [m];
      intervalStart = m.timestamp;
    } else {
      currentInterval.push(m);
    }
  }
  if (currentInterval.length > 0) intervals.push(currentInterval);
  
  if (intervals.length < 3) return false;
  
  const highBurnCount = intervals.filter(interval => {
    const total = interval.reduce((s, m) => s + m.totalRequests, 0);
    const errors = interval.reduce((s, m) => s + m.errorRequests, 0);
    const rate = total > 0 ? errors / total : 0;
    return rate > (rule.budgetPercent / 100) * 2;
  }).length;
  
  return highBurnCount >= Math.ceil(intervals.length * 0.6);
}

function determineStatusAndDecision(
  remainingPercent: number,
  burnRate: number,
  burnRateLevel: 'normal' | 'warning' | 'critical',
  isSpike: boolean,
  isSustainedBurn: boolean,
  rule: BudgetRule
): { status: ServiceStatus; decision: ReleaseDecision; freezeReason?: FreezeReason } {
  
  if (remainingPercent <= 0) {
    return { status: 'frozen', decision: 'freeze', freezeReason: 'budget_exhausted' };
  }
  
  if (remainingPercent <= 10) {
    return { status: 'critical', decision: 'needs_exception', freezeReason: 'budget_exhausted' };
  }
  
  if (isSustainedBurn && burnRateLevel === 'critical') {
    return { status: 'critical', decision: 'freeze', freezeReason: 'sustained_burn' };
  }
  
  if (burnRateLevel === 'critical' && burnRate >= rule.burnRateThreshold2 * 1.5) {
    return { status: 'critical', decision: 'freeze', freezeReason: 'rapid_burn' };
  }
  
  if (isSustainedBurn || burnRateLevel === 'critical') {
    return { status: 'critical', decision: 'needs_exception' };
  }
  
  if (remainingPercent <= 30 || burnRateLevel === 'warning' || isSpike) {
    return { status: 'warning', decision: 'observe' };
  }
  
  return { status: 'healthy', decision: 'continue' };
}

export function calculateTrend(
  metrics: MetricPoint[],
  rule: BudgetRule,
  now: number
): TrendPoint[] {
  const windowStart = now - rule.windowDays * DAY_MS;
  const windowMetrics = metrics.filter(m => m.timestamp >= windowStart && m.timestamp <= now);
  
  if (windowMetrics.length === 0) return [];
  
  const sorted = [...windowMetrics].sort((a, b) => a.timestamp - b.timestamp);
  const intervalMs = 1 * HOUR_MS;
  
  const trendPoints: TrendPoint[] = [];
  let intervalStart = sorted[0].timestamp;
  let currentInterval: MetricPoint[] = [];
  
  for (const m of sorted) {
    if (m.timestamp >= intervalStart + intervalMs) {
      if (currentInterval.length > 0) {
        trendPoints.push(aggregateToTrendPoint(currentInterval, rule, intervalStart));
      }
      currentInterval = [m];
      intervalStart = m.timestamp;
    } else {
      currentInterval.push(m);
    }
  }
  
  if (currentInterval.length > 0) {
    trendPoints.push(aggregateToTrendPoint(currentInterval, rule, intervalStart));
  }
  
  return trendPoints;
}

function aggregateToTrendPoint(
  metrics: MetricPoint[],
  rule: BudgetRule,
  timestamp: number
): TrendPoint {
  const totalRequests = metrics.reduce((s, m) => s + m.totalRequests, 0);
  const errorRequests = metrics.reduce((s, m) => s + m.errorRequests, 0);
  
  const errorRate = totalRequests > 0 ? (errorRequests / totalRequests) * 100 : 0;
  
  const totalBudget = totalRequests * (rule.budgetPercent / 100);
  const consumedBudget = errorRequests;
  const budgetRemaining = totalBudget > 0 ? ((totalBudget - consumedBudget) / totalBudget) * 100 : 100;
  
  const burnRate = totalBudget > 0 ? errorRequests / (totalBudget / (rule.windowDays * 24)) : 0;
  
  return {
    timestamp,
    errorRate: Math.round(errorRate * 100) / 100,
    budgetRemaining: Math.max(0, Math.round(budgetRemaining * 100) / 100),
    burnRate: Math.round(burnRate * 100) / 100,
  };
}

export function checkMetricsGap(
  lastMetric: MetricPoint | null,
  now: number,
  gapThresholdHours: number = 2
): { hasGap: boolean; gapHours: number } {
  if (!lastMetric) {
    return { hasGap: true, gapHours: Infinity };
  }
  
  const gapMs = now - lastMetric.timestamp;
  const gapHours = gapMs / HOUR_MS;
  
  return { hasGap: gapHours >= gapThresholdHours, gapHours };
}

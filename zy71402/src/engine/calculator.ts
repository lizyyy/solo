import type {
  ParsedTerms,
  CustomerPosition,
  UnderlyingPrice,
  CalculationResult,
  CalculationStep,
  ObservationInterval,
  ReturnTier,
  EvidenceRef,
} from '../types';
import { generateId } from '../utils/hash';
import { createEvidenceRef } from './evidence';
import type { Material } from '../types';

function checkInInterval(
  value: number,
  lowerBound: number,
  upperBound: number,
  lowerInclusive: boolean,
  upperInclusive: boolean
): boolean {
  const lowerOk = lowerInclusive ? value >= lowerBound : value > lowerBound;
  const upperOk = upperInclusive ? value <= upperBound : value < upperBound;
  return lowerOk && upperOk;
}

function findMatchingInterval(
  price: number,
  intervals: ObservationInterval[]
): ObservationInterval | null {
  for (const interval of intervals) {
    if (
      checkInInterval(
        price,
        interval.lowerBound,
        interval.upperBound,
        interval.lowerInclusive,
        interval.upperInclusive
      )
    ) {
      return interval;
    }
  }
  return null;
}

function findMatchingTier(
  price: number,
  tiers: ReturnTier[]
): ReturnTier | null {
  for (const tier of tiers) {
    if (
      checkInInterval(
        price,
        tier.lowerBound,
        tier.upperBound,
        tier.lowerInclusive,
        tier.upperInclusive
      )
    ) {
      return tier;
    }
  }
  return null;
}

function getObservationPrice(
  prices: UnderlyingPrice[],
  observationDate: string,
  interval: ObservationInterval | null
): { price: number; date: string; isBoundary: boolean } | null {
  if (interval) {
    const filteredPrices = prices.filter(p => {
      const d = p.date;
      return d >= interval.startDate && d <= interval.endDate;
    });
    
    if (filteredPrices.length > 0) {
      const latestPrice = filteredPrices.sort((a, b) => 
        b.date.localeCompare(a.date)
      )[0];
      
      const isBoundary = 
        Math.abs(latestPrice.price - interval.lowerBound) < 0.001 ||
        Math.abs(latestPrice.price - interval.upperBound) < 0.001;
      
      return {
        price: latestPrice.price,
        date: latestPrice.date,
        isBoundary,
      };
    }
  }
  
  const exactMatch = prices.find(p => p.date === observationDate);
  if (exactMatch) {
    return {
      price: exactMatch.price,
      date: exactMatch.date,
      isBoundary: false,
    };
  }
  
  if (prices.length > 0) {
    const latestPrice = prices.sort((a, b) => b.date.localeCompare(a.date))[0];
    return {
      price: latestPrice.price,
      date: latestPrice.date,
      isBoundary: false,
    };
  }
  
  return null;
}

function checkEarlyTermination(
  prices: UnderlyingPrice[],
  terms: ParsedTerms
): { terminated: boolean; date?: string; price?: number } {
  if (!terms.earlyTermination || !terms.earlyTermination.enabled) {
    return { terminated: false };
  }
  
  const et = terms.earlyTermination;
  
  for (const obsDate of et.observationDates) {
    const priceData = prices.find(p => p.date === obsDate);
    if (!priceData) continue;
    
    let triggered = false;
    if (et.triggerCondition.includes('>=')) {
      triggered = priceData.price >= et.triggerLevel;
    } else if (et.triggerCondition.includes('<=')) {
      triggered = priceData.price <= et.triggerLevel;
    } else if (et.triggerCondition.includes('>')) {
      triggered = priceData.price > et.triggerLevel;
    } else if (et.triggerCondition.includes('<')) {
      triggered = priceData.price < et.triggerLevel;
    }
    
    if (triggered) {
      return {
        terminated: true,
        date: obsDate,
        price: priceData.price,
      };
    }
  }
  
  return { terminated: false };
}

function formatBound(
  bound: number,
  inclusive: boolean,
  isLower: boolean
): string {
  if (bound === -Infinity) return '-∞';
  if (bound === Infinity) return '+∞';
  
  const symbol = isLower 
    ? (inclusive ? '≥' : '>')
    : (inclusive ? '≤' : '<');
  
  return `${symbol} ${bound.toFixed(4)}`;
}

function createSteps(
  position: CustomerPosition,
  terms: ParsedTerms,
  observationPrice: number,
  observationDate: string,
  isBoundary: boolean,
  matchedTier: ReturnTier | null,
  earlyTermResult: { terminated: boolean; date?: string; price?: number },
  priceMaterial: Material | null
): CalculationStep[] {
  const steps: CalculationStep[] = [];
  
  steps.push({
    step: '1',
    description: '本金确认',
    value: position.principal.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    evidence: position.evidenceRef,
  });
  
  steps.push({
    step: '2',
    description: '标的观察价格确认',
    value: `${observationDate}: ${observationPrice.toFixed(4)}`,
    evidence: priceMaterial ? createEvidenceRef(
      priceMaterial,
      `价格数据_${observationDate}`,
      String(observationPrice)
    ) : undefined,
  });
  
  if (isBoundary) {
    steps.push({
      step: '2.1',
      description: '⚠️ 价格触达区间边界，需特别注意边界处理',
      value: observationPrice.toFixed(4),
    });
  }
  
  if (terms.observationIntervals.length > 0) {
    const interval = terms.observationIntervals[0];
    steps.push({
      step: '3',
      description: '观察区间校验',
      value: `${interval.startDate} ~ ${interval.endDate}, 价格 ${formatBound(interval.lowerBound, interval.lowerInclusive, true)} ~ ${formatBound(interval.upperBound, interval.upperInclusive, false)}`,
      evidence: terms.evidenceRef['observation_interval'] || terms.evidenceRef['interval_startDate'],
    });
    
    const inInterval = checkInInterval(
      observationPrice,
      interval.lowerBound,
      interval.upperBound,
      interval.lowerInclusive,
      interval.upperInclusive
    );
    
    steps.push({
      step: '3.1',
      description: '价格是否在观察区间内',
      value: inInterval ? '是' : '否',
    });
  }
  
  if (earlyTermResult.terminated) {
    steps.push({
      step: '4',
      description: '提前终止检查',
      value: `触发提前终止 (${earlyTermResult.date}: ${earlyTermResult.price?.toFixed(4)})`,
      evidence: terms.evidenceRef['earlyTermination'],
    });
    
    const etRate = terms.earlyTermination?.returnRate || 0;
    const etReturn = position.principal * etRate;
    
    steps.push({
      step: '5',
      description: '提前终止收益率',
      value: `${(etRate * 100).toFixed(2)}%`,
      evidence: terms.evidenceRef['earlyTermination'],
    });
    
    steps.push({
      step: '6',
      description: '提前终止收益计算',
      value: etReturn.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    });
  } else {
    if (terms.earlyTermination?.enabled) {
      steps.push({
        step: '4',
        description: '提前终止检查',
        value: '未触发',
        evidence: terms.evidenceRef['earlyTermination'],
      });
    }
    
    steps.push({
      step: '5',
      description: '档位匹配',
      value: matchedTier 
        ? matchedTier.description 
        : '⚠️ 未匹配到任何档位',
      evidence: matchedTier 
        ? terms.evidenceRef[`tier_${terms.returnTiers.indexOf(matchedTier)}`]
        : undefined,
    });
    
    if (matchedTier) {
      const rate = matchedTier.returnRate;
      const returnAmount = position.principal * rate;
      
      steps.push({
        step: '6',
        description: '匹配档位收益率',
        value: `${(rate * 100).toFixed(2)}%`,
      });
      
      steps.push({
        step: '7',
        description: '收益计算 (本金 × 收益率)',
        value: returnAmount.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      });
    }
  }
  
  return steps;
}

export interface CalculationInput {
  terms: ParsedTerms;
  position: CustomerPosition;
  prices: UnderlyingPrice[];
  observationDate?: string;
  priceMaterial?: Material | null;
}

export function calculateReturn(
  input: CalculationInput
): CalculationResult {
  const { terms, position, prices, observationDate, priceMaterial } = input;
  
  const defaultObsDate = terms.observationIntervals[0]?.endDate 
    || position.endDate 
    || new Date().toISOString().split('T')[0];
  
  const obsDate = observationDate || defaultObsDate;
  const interval = terms.observationIntervals[0] || null;
  
  const priceResult = getObservationPrice(prices, obsDate, interval);
  
  if (!priceResult) {
    const steps: CalculationStep[] = [
      {
        step: '错误',
        description: '无法获取观察价格',
        value: '缺少标的价格数据',
      },
    ];
    
    return {
      id: generateId('calc'),
      batchId: terms.batchId,
      positionId: position.id,
      customerName: position.customerName,
      principal: position.principal,
      matchedTierId: null,
      matchedTierDescription: '价格数据缺失',
      observationPrice: 0,
      observationDate: obsDate,
      returnRate: 0,
      calculatedReturn: 0,
      payoutAmount: position.principal,
      calculationSteps: steps,
      earlyTerminated: false,
      calculatedAt: new Date(),
    };
  }
  
  const { price: observationPrice, date, isBoundary } = priceResult;
  
  const earlyTermResult = checkEarlyTermination(prices, terms);
  
  let returnRate = 0;
  let matchedTier: ReturnTier | null = null;
  let matchedTierDescription = '';
  let earlyTerminated = false;
  let terminationDate: string | undefined = undefined;
  
  if (earlyTermResult.terminated) {
    returnRate = terms.earlyTermination?.returnRate || 0;
    matchedTierDescription = `提前终止 (${earlyTermResult.date})`;
    earlyTerminated = true;
    terminationDate = earlyTermResult.date;
  } else {
    matchedTier = findMatchingTier(observationPrice, terms.returnTiers);
    
    if (matchedTier) {
      returnRate = matchedTier.returnRate;
      matchedTierDescription = matchedTier.description;
    } else {
      returnRate = 0;
      matchedTierDescription = '未匹配到档位';
    }
  }
  
  const calculatedReturn = position.principal * returnRate;
  const payoutAmount = position.principal + calculatedReturn;
  
  const calculationSteps = createSteps(
    position,
    terms,
    observationPrice,
    date,
    isBoundary,
    matchedTier,
    earlyTermResult,
    priceMaterial || null
  );
  
  return {
    id: generateId('calc'),
    batchId: terms.batchId,
    positionId: position.id,
    customerName: position.customerName,
    principal: position.principal,
    matchedTierId: matchedTier?.id || null,
    matchedTierDescription,
    observationPrice,
    observationDate: date,
    returnRate,
    calculatedReturn,
    payoutAmount,
    calculationSteps,
    earlyTerminated,
    terminationDate,
    calculatedAt: new Date(),
  };
}

export function batchCalculate(
  terms: ParsedTerms,
  positions: CustomerPosition[],
  prices: UnderlyingPrice[],
  priceMaterial?: Material | null
): CalculationResult[] {
  return positions.map(position => 
    calculateReturn({
      terms,
      position,
      prices,
      priceMaterial: priceMaterial || null,
    })
  );
}

export function checkBoundaryRisk(
  price: number,
  intervals: ObservationInterval[],
  tiers: ReturnTier[]
): { hasRisk: boolean; details: string[] } {
  const details: string[] = [];
  
  for (const interval of intervals) {
    if (Math.abs(price - interval.lowerBound) < 0.001) {
      const inclusive = interval.lowerInclusive;
      details.push(`价格触及区间下限 ${interval.lowerBound}，${inclusive ? '包含边界' : '不包含边界'}，需确认`);
    }
    if (Math.abs(price - interval.upperBound) < 0.001) {
      const inclusive = interval.upperInclusive;
      details.push(`价格触及区间上限 ${interval.upperBound}，${inclusive ? '包含边界' : '不包含边界'}，需确认`);
    }
  }
  
  for (const tier of tiers) {
    if (Math.abs(price - tier.lowerBound) < 0.001) {
      const inclusive = tier.lowerInclusive;
      details.push(`价格触及档位分界点 ${tier.lowerBound}，${inclusive ? '包含边界' : '不包含边界'}，需确认档位归属`);
    }
    if (Math.abs(price - tier.upperBound) < 0.001) {
      const inclusive = tier.upperInclusive;
      details.push(`价格触及档位分界点 ${tier.upperBound}，${inclusive ? '包含边界' : '不包含边界'}，需确认档位归属`);
    }
  }
  
  return {
    hasRisk: details.length > 0,
    details,
  };
}

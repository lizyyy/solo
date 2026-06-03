import { CalculationParams } from '../types';

export const CALCULATION_PARAMS_VERSIONS: CalculationParams[] = [
  {
    version: 'v2.1.0',
    effectiveDate: '2026-01-01',
    description: '养老目标基金换仓手续费计算规则，区分申购赎回费率档位'
  },
  {
    version: 'v2.0.0',
    effectiveDate: '2025-06-01',
    description: '统一手续费计算口径，按持有时间阶梯费率'
  },
  {
    version: 'v1.0.0',
    effectiveDate: '2024-01-01',
    description: '初始版本，固定费率计算'
  }
];

export const getLatestParams = (tradeDate: string): CalculationParams => {
  const sorted = [...CALCULATION_PARAMS_VERSIONS].sort(
    (a, b) => new Date(b.effectiveDate).getTime() - new Date(a.effectiveDate).getTime()
  );
  const tradeDateTime = new Date(tradeDate).getTime();
  for (const params of sorted) {
    if (tradeDateTime >= new Date(params.effectiveDate).getTime()) {
      return params;
    }
  }
  return sorted[sorted.length - 1];
};

export const FEE_RATE_TIERS = [
  { minHoldingDays: 0, maxHoldingDays: 30, rate: 0.015, reason: '持有不满30天，惩罚性费率' },
  { minHoldingDays: 30, maxHoldingDays: 90, rate: 0.0075, reason: '持有30-90天，普通赎回费率' },
  { minHoldingDays: 90, maxHoldingDays: 365, rate: 0.005, reason: '持有90-365天，优惠费率' },
  { minHoldingDays: 365, maxHoldingDays: Infinity, rate: 0, reason: '持有满1年，免赎回费' }
];

export const getFeeRate = (holdingDays: number): { rate: number; reason: string } => {
  for (const tier of FEE_RATE_TIERS) {
    if (holdingDays >= tier.minHoldingDays && holdingDays < tier.maxHoldingDays) {
      return { rate: tier.rate, reason: tier.reason };
    }
  }
  return { rate: 0, reason: '超出费率档位，默认免手续费' };
};

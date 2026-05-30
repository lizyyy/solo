import type { RoyaltyLadder, CalculationStep, ProductType } from '../../shared/types.js';
import { DEFAULT_LADDER_PHYSICAL, DEFAULT_LADDER_EBOOK, DEFAULT_LADDER_DISCOUNT } from '../../shared/constants.js';

export interface LadderResult {
  tier: number;
  range: string;
  rate: number;
  royaltyAmount: number;
  steps: CalculationStep[];
  crossLadder: boolean;
  crossDetails?: {
    tierBreakdown: { tier: number; volume: number; rate: number; amount: number }[];
  };
}

export function getLadderForProductType(
  ladders: RoyaltyLadder[],
  productType: ProductType,
  ladderType: 'STANDARD' | 'DISCOUNT' = 'STANDARD'
): RoyaltyLadder[] {
  const filtered = ladders.filter(
    (l) => l.productType === productType && l.ladderType === ladderType
  );

  if (filtered.length === 0) {
    return getDefaultLadder(productType, ladderType);
  }

  return filtered.sort((a, b) => a.minVolume - b.minVolume);
}

function getDefaultLadder(
  productType: ProductType,
  ladderType: 'STANDARD' | 'DISCOUNT'
): RoyaltyLadder[] {
  let defaults;
  if (ladderType === 'DISCOUNT') {
    defaults = DEFAULT_LADDER_DISCOUNT;
  } else if (productType === 'PHYSICAL') {
    defaults = DEFAULT_LADDER_PHYSICAL;
  } else if (productType === 'EBOOK') {
    defaults = DEFAULT_LADDER_EBOOK;
  } else {
    defaults = DEFAULT_LADDER_DISCOUNT;
  }

  return defaults.map((d, i) => ({
    id: `default-${productType}-${i}`,
    contractId: 'default',
    productType,
    minVolume: d.minVolume,
    maxVolume: d.maxVolume,
    rate: d.rate,
    ladderType,
    createdAt: new Date().toISOString(),
  }));
}

export function resolveLadderTier(
  netSalesVolume: number,
  ladders: RoyaltyLadder[]
): { tier: number; ladder: RoyaltyLadder } {
  const sorted = [...ladders].sort((a, b) => a.minVolume - b.minVolume);

  for (let i = sorted.length - 1; i >= 0; i--) {
    const ladder = sorted[i];
    if (netSalesVolume >= ladder.minVolume) {
      if (ladder.maxVolume === undefined || netSalesVolume <= ladder.maxVolume) {
        return { tier: i + 1, ladder };
      }
    }
  }

  return { tier: 1, ladder: sorted[0] };
}

export function checkCrossLadder(
  netSalesVolume: number,
  ladders: RoyaltyLadder[]
): boolean {
  const sorted = [...ladders].sort((a, b) => a.minVolume - b.minVolume);

  let crossings = 0;
  for (const ladder of sorted) {
    if (netSalesVolume >= ladder.minVolume) {
      crossings++;
    }
  }

  return crossings > 1;
}

export function calculateRoyaltyWithLadder(
  netSalesVolume: number,
  netSalesAmount: number,
  ladders: RoyaltyLadder[],
  isDiscountActivity: boolean = false,
  adjustedRate?: number
): LadderResult {
  const steps: CalculationStep[] = [];
  const sortedLadders = [...ladders].sort((a, b) => a.minVolume - b.minVolume);
  const crossLadder = checkCrossLadder(netSalesVolume, ladders);

  steps.push({
    order: 1,
    description: '确认净销售册数',
    operation: 'input',
    input: netSalesVolume,
    output: netSalesVolume,
    rule: `净销售册数 = 销售册数 - 退货册数`,
  });

  steps.push({
    order: 2,
    description: '确认净销售码洋',
    operation: 'input',
    input: netSalesAmount,
    output: netSalesAmount,
    rule: `净销售码洋 = 销售码洋 - 退货码洋`,
  });

  let royaltyAmount: number;
  let tier: number;
  let rate: number;
  let range: string;

  if (isDiscountActivity && adjustedRate !== undefined) {
    tier = 1;
    rate = adjustedRate;
    range = '活动专用';

    steps.push({
      order: 3,
      description: '应用活动折扣税率',
      operation: 'apply_rate',
      input: netSalesAmount,
      output: netSalesAmount * rate,
      rule: `活动折扣期，统一按 ${(rate * 100).toFixed(2)}% 税率计算`,
    });

    royaltyAmount = netSalesAmount * rate;
  } else if (crossLadder) {
    const tierBreakdown: { tier: number; volume: number; rate: number; amount: number }[] = [];
    let remainingVolume = netSalesVolume;
    let totalAmount = 0;
    let avgRate = 0;

    for (let i = 0; i < sortedLadders.length; i++) {
      const ladder = sortedLadders[i];
      const nextLadder = sortedLadders[i + 1];

      if (remainingVolume <= 0) break;

      const tierVolume = nextLadder
        ? Math.min(remainingVolume, nextLadder.minVolume - ladder.minVolume)
        : remainingVolume;

      if (tierVolume > 0) {
        const tierAmount = (tierVolume / netSalesVolume) * netSalesAmount * ladder.rate;
        tierBreakdown.push({
          tier: i + 1,
          volume: tierVolume,
          rate: ladder.rate,
          amount: tierAmount,
        });
        totalAmount += tierAmount;
        remainingVolume -= tierVolume;

        steps.push({
          order: 3 + i,
          description: `第${i + 1}档阶梯计算`,
          operation: 'ladder_calc',
          input: tierVolume,
          output: tierAmount,
          rule: `第${i + 1}档 [${ladder.minVolume}${ladder.maxVolume ? `-${ladder.maxVolume}` : '+'}] 册，税率 ${(ladder.rate * 100).toFixed(2)}%，分摊码洋 ${((tierVolume / netSalesVolume) * netSalesAmount).toFixed(2)} 元`,
        });
      }
    }

    royaltyAmount = totalAmount;
    tier = tierBreakdown.length;
    rate = totalAmount / netSalesAmount;
    avgRate = rate;

    const firstTier = sortedLadders[0];
    const lastTier = sortedLadders[tierBreakdown.length - 1];
    range = `${firstTier.minVolume}-${lastTier.maxVolume || '∞'}`;

    steps.push({
      order: 3 + tierBreakdown.length,
      description: '跨阶梯汇总计算',
      operation: 'sum',
      input: totalAmount,
      output: totalAmount,
      rule: `跨 ${tierBreakdown.length} 档阶梯，综合税率 ${(avgRate * 100).toFixed(2)}%`,
    });

    return {
      tier,
      range,
      rate: avgRate,
      royaltyAmount,
      steps,
      crossLadder: true,
      crossDetails: { tierBreakdown },
    };
  } else {
    const { tier: resolvedTier, ladder } = resolveLadderTier(netSalesVolume, sortedLadders);
    tier = resolvedTier;
    rate = ladder.rate;
    range = `${ladder.minVolume}${ladder.maxVolume ? `-${ladder.maxVolume}` : '+'}`;

    steps.push({
      order: 3,
      description: `确定阶梯档位`,
      operation: 'resolve_tier',
      input: netSalesVolume,
      output: tier,
      rule: `净销售 ${netSalesVolume} 册，落在第 ${tier} 档 [${range}] 册，税率 ${(rate * 100).toFixed(2)}%`,
    });

    steps.push({
      order: 4,
      description: `计算版税金额`,
      operation: 'apply_rate',
      input: netSalesAmount,
      output: netSalesAmount * rate,
      rule: `版税 = 净销售码洋 × 税率 = ${netSalesAmount.toFixed(2)} × ${(rate * 100).toFixed(2)}%`,
    });

    royaltyAmount = netSalesAmount * rate;
  }

  steps.push({
    order: steps.length + 1,
    description: '最终版税金额',
    operation: 'final',
    input: royaltyAmount,
    output: royaltyAmount,
    rule: `四舍五入保留2位小数`,
  });

  return {
    tier,
    range,
    rate,
    royaltyAmount: Math.round(royaltyAmount * 100) / 100,
    steps,
    crossLadder,
  };
}

export function formatLadderFormula(
  productType: ProductType,
  ladderType: 'STANDARD' | 'DISCOUNT',
  crossLadder: boolean
): string {
  if (ladderType === 'DISCOUNT') {
    return `版税 = 净销售码洋 × 活动折扣税率`;
  }

  if (crossLadder) {
    return `版税 = Σ(各档分摊码洋 × 对应档位税率)`;
  }

  return `版税 = 净销售码洋 × 对应档位税率`;
}

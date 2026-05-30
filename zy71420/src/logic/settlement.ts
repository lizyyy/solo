import { Bond, Position, CouponRecord, GameError, GameState } from '../types/game';

export function calculateCouponPayment(
  positions: Position[],
  bonds: Bond[]
): { totalCoupon: number; records: CouponRecord[] } {
  let totalCoupon = 0;
  const records: CouponRecord[] = [];

  for (const pos of positions) {
    const bond = bonds.find(b => b.id === pos.bondId);
    if (!bond) continue;

    const expectedAmount = pos.quantity * bond.faceValue * (bond.couponRate / 100);
    const actualAmount = expectedAmount;

    totalCoupon += actualAmount;

    records.push({
      id: `coupon_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      round: 0,
      bondId: pos.bondId,
      quantity: pos.quantity,
      expectedAmount: Math.round(expectedAmount * 100) / 100,
      actualAmount: Math.round(actualAmount * 100) / 100,
      source: 'hamster_bond_exchange_v1'
    });
  }

  return {
    totalCoupon: Math.round(totalCoupon * 100) / 100,
    records
  };
}

export function detectCouponMissed(
  expectedRecords: CouponRecord[],
  actualCashChange: number,
  round: number
): GameError | null {
  const expectedTotal = expectedRecords.reduce((sum, r) => sum + r.expectedAmount, 0);
  
  if (Math.abs(actualCashChange - expectedTotal) > 0.01) {
    return {
      id: `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      round,
      type: 'coupon_missed',
      description: '票息结算异常：实际入账金额与应得票息不符',
      impact: {
        metric: '票息收入',
        expectedValue: Math.round(expectedTotal * 100) / 100,
        actualValue: Math.round(actualCashChange * 100) / 100,
        difference: Math.round((actualCashChange - expectedTotal) * 100) / 100
      },
      affectedResults: ['现金余额', '总资产', '最终收益']
    };
  }
  
  return null;
}

export function detectRateReversed(
  oldRate: number,
  newRate: number,
  oldBondPrices: { [bondId: string]: number },
  newBondPrices: { [bondId: string]: number },
  round: number
): GameError | null {
  const rateChange = newRate - oldRate;
  
  if (Math.abs(rateChange) < 0.01) return null;

  let allCorrect = true;
  let exampleBondId = '';
  
  for (const bondId of Object.keys(oldBondPrices)) {
    const oldPrice = oldBondPrices[bondId];
    const newPrice = newBondPrices[bondId];
    if (!oldPrice || !newPrice) continue;
    
    const priceChange = newPrice - oldPrice;
    
    if (rateChange > 0 && priceChange > 0.01) {
      allCorrect = false;
      exampleBondId = bondId;
      break;
    }
    if (rateChange < 0 && priceChange < -0.01) {
      allCorrect = false;
      exampleBondId = bondId;
      break;
    }
  }

  if (!allCorrect) {
    return {
      id: `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      round,
      type: 'rate_reversed',
      description: '利率方向异常：债券价格变化方向与利率变化方向一致（应为反向）',
      impact: {
        metric: '债券定价方向',
        expectedValue: rateChange > 0 ? -1 : 1,
        actualValue: rateChange > 0 ? 1 : -1,
        difference: 2
      },
      affectedResults: ['债券估值', '总资产', '交易决策']
    };
  }
  
  return null;
}

export function detectCashOverdraft(
  cash: number,
  round: number
): GameError | null {
  if (cash < -0.01) {
    return {
      id: `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      round,
      type: 'cash_overdraft',
      description: '现金透支：交易后现金余额为负数',
      impact: {
        metric: '现金余额',
        expectedValue: 0,
        actualValue: Math.round(cash * 100) / 100,
        difference: Math.round(cash * 100) / 100
      },
      affectedResults: ['流动性风险', '信用评级', '最终收益']
    };
  }
  
  return null;
}

export function runAllChecks(
  state: GameState,
  oldBondPrices: { [bondId: string]: number },
  couponCashChange: number
): GameError[] {
  const errors: GameError[] = [];

  const couponError = detectCouponMissed(
    state.couponRecords.filter(r => r.round === state.currentRound),
    couponCashChange,
    state.currentRound
  );
  if (couponError) errors.push(couponError);

  const newBondPrices: { [bondId: string]: number } = {};
  state.bonds.forEach(b => {
    newBondPrices[b.id] = b.currentPrice;
  });

  const rateError = detectRateReversed(
    state.marketRate - (state.events.find(e => e.round === state.currentRound)?.rateChange || 0) / 100,
    state.marketRate,
    oldBondPrices,
    newBondPrices,
    state.currentRound
  );
  if (rateError) errors.push(rateError);

  const cashError = detectCashOverdraft(state.cash, state.currentRound);
  if (cashError) errors.push(cashError);

  return errors;
}

export function getErrorTypeLabel(type: string): string {
  switch (type) {
    case 'coupon_missed': return '票息漏入账';
    case 'rate_reversed': return '利率方向反';
    case 'cash_overdraft': return '现金透支';
    default: return '未知错误';
  }
}

export function getErrorTypeEmoji(type: string): string {
  switch (type) {
    case 'coupon_missed': return '💸';
    case 'rate_reversed': return '🔄';
    case 'cash_overdraft': return '🏦';
    default: return '⚠️';
  }
}

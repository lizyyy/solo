import { Bond } from '../types/game';

export function calculateBondPrice(
  faceValue: number,
  couponRate: number,
  marketRate: number,
  remainingRounds: number
): number {
  const r = marketRate / 100;
  const coupon = faceValue * (couponRate / 100);
  
  let price = 0;
  
  for (let t = 1; t <= remainingRounds; t++) {
    price += coupon / Math.pow(1 + r, t);
  }
  
  price += faceValue / Math.pow(1 + r, remainingRounds);
  
  return Math.round(price * 100) / 100;
}

export function updateBondPrices(
  bonds: Bond[],
  marketRate: number,
  currentRound: number
): Bond[] {
  return bonds.map(bond => {
    const remainingRounds = Math.max(0, bond.maturityRound - currentRound);
    
    if (remainingRounds === 0) {
      return { ...bond, currentPrice: bond.faceValue };
    }
    
    const newPrice = calculateBondPrice(
      bond.faceValue,
      bond.couponRate,
      marketRate,
      remainingRounds
    );
    
    return { ...bond, currentPrice: newPrice };
  });
}

export function calculateDuration(
  faceValue: number,
  couponRate: number,
  marketRate: number,
  remainingRounds: number
): number {
  const r = marketRate / 100;
  const coupon = faceValue * (couponRate / 100);
  const price = calculateBondPrice(faceValue, couponRate, marketRate, remainingRounds);
  
  let duration = 0;
  
  for (let t = 1; t <= remainingRounds; t++) {
    const pv = coupon / Math.pow(1 + r, t);
    duration += (t * pv) / price;
  }
  
  duration += (remainingRounds * faceValue / Math.pow(1 + r, remainingRounds)) / price;
  
  return Math.round(duration * 100) / 100;
}

export function getPriceChangeExplanation(
  oldPrice: number,
  newPrice: number,
  rateChange: number
): string {
  const priceDiff = newPrice - oldPrice;
  const priceDiffPercent = ((priceDiff / oldPrice) * 100).toFixed(2);
  
  if (rateChange > 0) {
    return `利率上升 ${(rateChange / 100).toFixed(2)}%，债券价格下跌 ${Math.abs(priceDiff).toFixed(2)} 元 (${priceDiffPercent}%) - 记住：利率与债券价格呈反向关系！`;
  } else if (rateChange < 0) {
    return `利率下降 ${(Math.abs(rateChange) / 100).toFixed(2)}%，债券价格上涨 ${priceDiff.toFixed(2)} 元 (+${priceDiffPercent}%) - 记住：利率与债券价格呈反向关系！`;
  }
  
  return '利率保持不变，债券价格稳定。';
}

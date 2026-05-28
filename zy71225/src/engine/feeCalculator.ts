import type { Position, FeeConfig } from '@/types';

export function calculateTradingFee(
  position: Position,
  quantity: number,
  price: number,
  config: FeeConfig
): { fee: number; executionPrice: number } {
  const absQuantity = Math.abs(quantity);
  
  let baseFee: number;
  if (position.type === 'underlying') {
    baseFee = absQuantity * price * config.underlyingTradingFee;
  } else {
    baseFee = absQuantity * price * 100 * config.optionTradingFee;
  }

  const slippageAmount = absQuantity * price * config.slippage;
  const fee = baseFee + slippageAmount;

  const executionPrice = quantity > 0 
    ? price * (1 + config.slippage)
    : price * (1 - config.slippage);

  return { fee, executionPrice };
}

export function estimatePositionChangeImpact(
  position: Position,
  changeQuantity: number,
  currentUnderlyingPrice: number,
  volatility: number,
  feeConfig: FeeConfig
): {
  estimatedCost: number;
  estimatedFee: number;
  estimatedPnLRealized: number;
  newQuantity: number;
} {
  const { fee, executionPrice } = calculateTradingFee(
    position,
    changeQuantity,
    currentUnderlyingPrice,
    feeConfig
  );

  let estimatedPnLRealized = 0;
  if (changeQuantity < 0) {
    const sellQuantity = Math.min(Math.abs(changeQuantity), Math.abs(position.quantity));
    estimatedPnLRealized = (executionPrice - position.costPrice) * sellQuantity * (position.type === 'underlying' ? 1 : 100);
  }

  const tradeValue = changeQuantity * executionPrice * (position.type === 'underlying' ? 1 : 100);
  const estimatedCost = Math.abs(tradeValue) + fee;
  const newQuantity = position.quantity + changeQuantity;

  return {
    estimatedCost,
    estimatedFee: fee,
    estimatedPnLRealized,
    newQuantity,
  };
}

export function calculateTotalFees(
  positionChanges: Array<{ position: Position; changeQuantity: number; price: number }>,
  feeConfig: FeeConfig
): { totalFee: number; totalCost: number; positionResults: Array<{ positionId: string; fee: number; executionPrice: number; pnlRealized: number }> } {
  let totalFee = 0;
  let totalCost = 0;
  const positionResults: Array<{ positionId: string; fee: number; executionPrice: number; pnlRealized: number }> = [];

  for (const { position, changeQuantity, price } of positionChanges) {
    const { fee, executionPrice } = calculateTradingFee(position, changeQuantity, price, feeConfig);
    
    let pnlRealized = 0;
    if (changeQuantity < 0 && position.quantity > 0 || changeQuantity > 0 && position.quantity < 0) {
      const closeQuantity = Math.min(Math.abs(changeQuantity), Math.abs(position.quantity));
      pnlRealized = (executionPrice - position.costPrice) * closeQuantity * (position.type === 'underlying' ? 1 : 100) * Math.sign(changeQuantity) * -1;
    }

    const tradeValue = Math.abs(changeQuantity * executionPrice * (position.type === 'underlying' ? 1 : 100));
    totalFee += fee;
    totalCost += tradeValue + fee;
    
    positionResults.push({
      positionId: position.id,
      fee,
      executionPrice,
      pnlRealized,
    });
  }

  return { totalFee, totalCost, positionResults };
}

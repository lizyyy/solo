import type { Position, MarginConfig, MarginStatus } from '@/types';
import { calculatePositionGreeks } from './greekCalculator';

export function calculateMargin(
  positions: Position[],
  config: MarginConfig,
  underlyingPrice: number,
  volatility: number
): MarginStatus {
  let initialMargin = 0;
  let maintenanceMargin = 0;

  for (const position of positions) {
    if (position.type === 'underlying') {
      const marketValue = Math.abs(position.quantity) * underlyingPrice;
      initialMargin += marketValue * config.initialMarginRate;
      maintenanceMargin += marketValue * config.maintenanceMarginRate;
    } else {
      const greeks = calculatePositionGreeks(position, underlyingPrice, volatility);
      const marketValue = Math.abs(greeks.marketValue);
      
      const shortOptionAdjustment = position.quantity < 0 ? 1.5 : 1;
      
      initialMargin += marketValue * config.initialMarginRate * shortOptionAdjustment;
      maintenanceMargin += marketValue * config.maintenanceMarginRate * shortOptionAdjustment;
    }
  }

  return {
    initialMargin,
    maintenanceMargin,
    availableMargin: 0,
    marginRatio: 0,
    marginCall: false,
  };
}

export function updateMarginWithCash(
  margin: MarginStatus,
  cash: number,
  config: MarginConfig
): MarginStatus {
  const totalAssets = cash + margin.initialMargin;
  const marginRatio = totalAssets > 0 ? (margin.maintenanceMargin / totalAssets) * 100 : 100;
  const availableMargin = cash - margin.initialMargin;
  const marginCall = marginRatio > config.marginCallThreshold * 100;

  return {
    ...margin,
    availableMargin,
    marginRatio,
    marginCall,
  };
}

export function checkBankruptcy(margin: MarginStatus, cash: number): boolean {
  return cash + margin.availableMargin < 0;
}

export function getMarginUsagePercent(margin: MarginStatus, cash: number): number {
  const totalAssets = cash + margin.initialMargin;
  if (totalAssets <= 0) return 100;
  return Math.min(100, Math.max(0, (margin.initialMargin / totalAssets) * 100));
}

export function getMarginStatusColor(usagePercent: number): 'green' | 'yellow' | 'red' {
  if (usagePercent < 60) return 'green';
  if (usagePercent < 80) return 'yellow';
  return 'red';
}

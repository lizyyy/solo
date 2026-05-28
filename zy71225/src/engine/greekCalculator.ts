import type { Position, GreekValues } from '@/types';
import { calculateBlackScholes } from './blackScholes';

const RISK_FREE_RATE = 0.03;

export function calculatePositionGreeks(
  position: Position,
  underlyingPrice: number,
  volatility: number
): GreekValues & { currentPrice: number; marketValue: number; pnl: number } {
  if (position.type === 'underlying') {
    const marketValue = position.quantity * underlyingPrice;
    const pnl = (underlyingPrice - position.costPrice) * position.quantity;
    return {
      delta: position.quantity,
      gamma: 0,
      vega: 0,
      theta: 0,
      rho: 0,
      currentPrice: underlyingPrice,
      marketValue,
      pnl,
    };
  }

  const T = position.expiryDays / 365;
  const sigma = volatility / 100;

  const bs = calculateBlackScholes(
    underlyingPrice,
    position.strike,
    T,
    RISK_FREE_RATE,
    sigma,
    position.type
  );

  const marketValue = position.quantity * bs.price * 100;
  const costValue = position.quantity * position.costPrice * 100;
  const pnl = marketValue - costValue;

  return {
    delta: position.quantity * bs.delta,
    gamma: position.quantity * bs.gamma,
    vega: position.quantity * bs.vega,
    theta: position.quantity * bs.theta,
    rho: position.quantity * bs.rho,
    currentPrice: bs.price,
    marketValue,
    pnl,
  };
}

export function calculatePortfolioGreeks(
  positions: Position[],
  underlyingPrice: number,
  volatility: number
): {
  portfolioGreeks: GreekValues;
  updatedPositions: Position[];
  totalPnL: number;
  totalMarketValue: number;
  unrealizedPnL: number;
} {
  let delta = 0;
  let gamma = 0;
  let vega = 0;
  let theta = 0;
  let rho = 0;
  let totalPnL = 0;
  let totalMarketValue = 0;

  const updatedPositions = positions.map((position) => {
    const result = calculatePositionGreeks(position, underlyingPrice, volatility);

    delta += result.delta;
    gamma += result.gamma;
    vega += result.vega;
    theta += result.theta;
    rho += result.rho;
    totalPnL += result.pnl;
    totalMarketValue += result.marketValue;

    return {
      ...position,
      currentPrice: result.currentPrice,
      marketValue: result.marketValue,
      pnl: result.pnl,
      individualGreeks: {
        delta: result.delta,
        gamma: result.gamma,
        vega: result.vega,
        theta: result.theta,
        rho: result.rho,
      },
    };
  });

  return {
    portfolioGreeks: { delta, gamma, vega, theta, rho },
    updatedPositions,
    totalPnL,
    totalMarketValue,
    unrealizedPnL: totalPnL,
  };
}

export function getGreekStatus(
  value: number,
  target: { min: number; max: number }
): 'safe' | 'warning' | 'danger' {
  if (value >= target.min && value <= target.max) return 'safe';
  const range = target.max - target.min;
  const buffer = range * 0.3;
  if (value >= target.min - buffer && value <= target.max + buffer) return 'warning';
  return 'danger';
}

export function getGreekDeviationPercent(
  value: number,
  target: { min: number; max: number }
): number {
  if (value >= target.min && value <= target.max) return 0;
  const midPoint = (target.min + target.max) / 2;
  const range = target.max - target.min;
  return Math.round(((value - midPoint) / (range / 2)) * 100);
}

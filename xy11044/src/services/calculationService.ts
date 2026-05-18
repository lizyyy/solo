import { InspectionItem } from '../types';

export function calculateLossWeight(expectedWeight: number, actualWeight: number): number {
  return Math.max(0, expectedWeight - actualWeight);
}

export function calculateLossRate(lossWeight: number, expectedWeight: number): number {
  if (expectedWeight <= 0) return 0;
  return Number((lossWeight / expectedWeight * 100).toFixed(2));
}

export function calculateItemLoss(item: { expectedWeight: number; actualWeight: number }): { lossWeight: number; lossRate: number } {
  const lossWeight = calculateLossWeight(item.expectedWeight, item.actualWeight);
  const lossRate = calculateLossRate(lossWeight, item.expectedWeight);
  return { lossWeight, lossRate };
}

export function calculateOrderSummary(items: { expectedWeight: number; actualWeight: number; expectedQuantity: number; isLive: number }[]) {
  const totalQuantity = items.reduce((sum, item) => sum + item.expectedQuantity, 0);
  const totalExpectedWeight = items.reduce((sum, item) => sum + item.expectedWeight, 0);
  const totalActualWeight = items.reduce((sum, item) => sum + item.actualWeight, 0);
  const totalLossWeight = calculateLossWeight(totalExpectedWeight, totalActualWeight);
  const totalLossRate = calculateLossRate(totalLossWeight, totalExpectedWeight);

  const liveItems = items.filter(item => item.isLive === 1);
  const icedItems = items.filter(item => item.isLive === 0);

  const liveExpectedWeight = liveItems.reduce((sum, item) => sum + item.expectedWeight, 0);
  const liveActualWeight = liveItems.reduce((sum, item) => sum + item.actualWeight, 0);
  const liveLossWeight = calculateLossWeight(liveExpectedWeight, liveActualWeight);
  const liveLossRate = calculateLossRate(liveLossWeight, liveExpectedWeight);

  const icedExpectedWeight = icedItems.reduce((sum, item) => sum + item.expectedWeight, 0);
  const icedActualWeight = icedItems.reduce((sum, item) => sum + item.actualWeight, 0);
  const icedLossWeight = calculateLossWeight(icedExpectedWeight, icedActualWeight);
  const icedLossRate = calculateLossRate(icedLossWeight, icedExpectedWeight);

  return {
    totalQuantity,
    totalWeight: totalActualWeight,
    totalLossWeight,
    totalLossRate,
    liveLossRate,
    icedLossRate
  };
}

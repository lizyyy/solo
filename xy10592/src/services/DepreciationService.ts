import { Asset, AssetStatus, DepreciationDetail } from '../types';
import { parseDate, isSameMonth, diffInMonths, getStartOfMonth } from '../utils/date';
import { generateId } from '../utils/id';

export class DepreciationService {
  calculateMonthlyDepreciation(
    originalCost: number,
    usefulLifeMonths: number,
    residualValueRate: number
  ): number {
    const residualValue = originalCost * residualValueRate;
    const depreciableAmount = originalCost - residualValue;
    const monthlyDepreciation = depreciableAmount / usefulLifeMonths;
    return Math.round(monthlyDepreciation * 100) / 100;
  }

  shouldDepreciateInMonth(
    asset: Asset,
    periodYear: number,
    periodMonth: number
  ): boolean {
    if (asset.status === AssetStatus.SCRAPPED) {
      return false;
    }

    const acquisitionDate = parseDate(asset.acquisitionDate);
    const periodStart = new Date(periodYear, periodMonth - 1, 1);

    if (isSameMonth(acquisitionDate, periodStart)) {
      return false;
    }

    if (acquisitionDate > periodStart) {
      return false;
    }

    if (asset.lastDepreciationDate) {
      const lastDepDate = parseDate(asset.lastDepreciationDate);
      if (isSameMonth(lastDepDate, periodStart)) {
        return false;
      }
    }

    return true;
  }

  getRemainingLifeMonths(
    asset: Asset,
    periodYear: number,
    periodMonth: number
  ): number {
    const acquisitionDate = parseDate(asset.acquisitionDate);
    const periodStart = new Date(periodYear, periodMonth - 1, 1);
    const monthsUsed = diffInMonths(getStartOfMonth(acquisitionDate), periodStart);
    const remaining = asset.usefulLifeMonths - monthsUsed;
    return Math.max(0, remaining);
  }

  createDepreciationDetail(
    asset: Asset,
    storeId: string,
    periodId: string,
    periodYear: number,
    periodMonth: number,
    operator: string
  ): DepreciationDetail | null {
    if (!this.shouldDepreciateInMonth(asset, periodYear, periodMonth)) {
      return null;
    }

    const monthlyAmount = this.calculateMonthlyDepreciation(
      asset.originalCost,
      asset.usefulLifeMonths,
      asset.residualValueRate
    );

    const accumulatedDepreciationAfter = Math.round(
      (asset.accumulatedDepreciation + monthlyAmount) * 100
    ) / 100;

    const netBookValueAfter = Math.round(
      (asset.netBookValue - monthlyAmount) * 100
    ) / 100;

    const residualValue = asset.originalCost * asset.residualValueRate;
    if (netBookValueAfter < residualValue) {
      const adjustedAmount = asset.netBookValue - residualValue;
      if (adjustedAmount <= 0) {
        return null;
      }

      return {
        id: generateId('dep'),
        assetId: asset.id,
        storeId,
        periodId,
        periodYear,
        periodMonth,
        depreciationAmount: Math.round(adjustedAmount * 100) / 100,
        accumulatedDepreciationBefore: asset.accumulatedDepreciation,
        accumulatedDepreciationAfter: asset.accumulatedDepreciation + adjustedAmount,
        netBookValueBefore: asset.netBookValue,
        netBookValueAfter: residualValue,
        calculationMethod: 'straight-line-adjusted',
        createdBy: operator,
        createdAt: new Date().toISOString()
      };
    }

    return {
      id: generateId('dep'),
      assetId: asset.id,
      storeId,
      periodId,
      periodYear,
      periodMonth,
      depreciationAmount: monthlyAmount,
      accumulatedDepreciationBefore: asset.accumulatedDepreciation,
      accumulatedDepreciationAfter,
      netBookValueBefore: asset.netBookValue,
      netBookValueAfter,
      calculationMethod: 'straight-line',
      createdBy: operator,
      createdAt: new Date().toISOString()
    };
  }

  recalculateAssetFromRecords(
    baseAsset: Asset,
    monthlyDepreciation: number,
    depreciationMonths: number
  ): { accumulatedDepreciation: number; netBookValue: number } {
    const totalDepreciation = monthlyDepreciation * depreciationMonths;
    const residualValue = baseAsset.originalCost * baseAsset.residualValueRate;

    let accumulatedDepreciation = totalDepreciation;
    let netBookValue = baseAsset.originalCost - totalDepreciation;

    if (netBookValue < residualValue) {
      accumulatedDepreciation = baseAsset.originalCost - residualValue;
      netBookValue = residualValue;
    }

    return {
      accumulatedDepreciation: Math.round(accumulatedDepreciation * 100) / 100,
      netBookValue: Math.round(netBookValue * 100) / 100
    };
  }
}

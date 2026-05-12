import { Asset, DepreciationDetail } from '../types';
export declare class DepreciationService {
    calculateMonthlyDepreciation(originalCost: number, usefulLifeMonths: number, residualValueRate: number): number;
    shouldDepreciateInMonth(asset: Asset, periodYear: number, periodMonth: number): boolean;
    getRemainingLifeMonths(asset: Asset, periodYear: number, periodMonth: number): number;
    createDepreciationDetail(asset: Asset, storeId: string, periodId: string, periodYear: number, periodMonth: number, operator: string): DepreciationDetail | null;
    recalculateAssetFromRecords(baseAsset: Asset, monthlyDepreciation: number, depreciationMonths: number): {
        accumulatedDepreciation: number;
        netBookValue: number;
    };
}

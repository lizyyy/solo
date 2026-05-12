"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DepreciationService = void 0;
const types_1 = require("../types");
const date_1 = require("../utils/date");
const id_1 = require("../utils/id");
class DepreciationService {
    calculateMonthlyDepreciation(originalCost, usefulLifeMonths, residualValueRate) {
        const residualValue = originalCost * residualValueRate;
        const depreciableAmount = originalCost - residualValue;
        const monthlyDepreciation = depreciableAmount / usefulLifeMonths;
        return Math.round(monthlyDepreciation * 100) / 100;
    }
    shouldDepreciateInMonth(asset, periodYear, periodMonth) {
        if (asset.status === types_1.AssetStatus.SCRAPPED) {
            return false;
        }
        const acquisitionDate = (0, date_1.parseDate)(asset.acquisitionDate);
        const periodStart = new Date(periodYear, periodMonth - 1, 1);
        if ((0, date_1.isSameMonth)(acquisitionDate, periodStart)) {
            return false;
        }
        if (acquisitionDate > periodStart) {
            return false;
        }
        if (asset.lastDepreciationDate) {
            const lastDepDate = (0, date_1.parseDate)(asset.lastDepreciationDate);
            if ((0, date_1.isSameMonth)(lastDepDate, periodStart)) {
                return false;
            }
        }
        return true;
    }
    getRemainingLifeMonths(asset, periodYear, periodMonth) {
        const acquisitionDate = (0, date_1.parseDate)(asset.acquisitionDate);
        const periodStart = new Date(periodYear, periodMonth - 1, 1);
        const monthsUsed = (0, date_1.diffInMonths)((0, date_1.getStartOfMonth)(acquisitionDate), periodStart);
        const remaining = asset.usefulLifeMonths - monthsUsed;
        return Math.max(0, remaining);
    }
    createDepreciationDetail(asset, storeId, periodId, periodYear, periodMonth, operator) {
        if (!this.shouldDepreciateInMonth(asset, periodYear, periodMonth)) {
            return null;
        }
        const monthlyAmount = this.calculateMonthlyDepreciation(asset.originalCost, asset.usefulLifeMonths, asset.residualValueRate);
        const accumulatedDepreciationAfter = Math.round((asset.accumulatedDepreciation + monthlyAmount) * 100) / 100;
        const netBookValueAfter = Math.round((asset.netBookValue - monthlyAmount) * 100) / 100;
        const residualValue = asset.originalCost * asset.residualValueRate;
        if (netBookValueAfter < residualValue) {
            const adjustedAmount = asset.netBookValue - residualValue;
            if (adjustedAmount <= 0) {
                return null;
            }
            return {
                id: (0, id_1.generateId)('dep'),
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
            id: (0, id_1.generateId)('dep'),
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
    recalculateAssetFromRecords(baseAsset, monthlyDepreciation, depreciationMonths) {
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
exports.DepreciationService = DepreciationService;
//# sourceMappingURL=DepreciationService.js.map
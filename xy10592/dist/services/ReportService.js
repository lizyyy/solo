"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReportService = void 0;
const types_1 = require("../types");
const date_1 = require("../utils/date");
class ReportService {
    constructor(storage) {
        this.storage = storage;
    }
    async generateReport(year, month) {
        const stores = await this.storage.getStores();
        const assets = await this.storage.getAssets();
        const transfers = await this.storage.getTransfers();
        const depreciationDetails = await this.storage.getDepreciationDetails();
        const scraps = await this.storage.getScraps();
        const repairs = await this.storage.getRepairs();
        const filteredDepDetails = depreciationDetails.filter(d => {
            if (year !== undefined && d.periodYear !== year)
                return false;
            if (month !== undefined && d.periodMonth !== month)
                return false;
            return true;
        });
        const anomalies = [];
        const assetCodeMap = new Map();
        for (const asset of assets) {
            const arr = assetCodeMap.get(asset.code) || [];
            arr.push(asset.id);
            assetCodeMap.set(asset.code, arr);
        }
        for (const [code, ids] of assetCodeMap) {
            if (ids.length > 1) {
                anomalies.push({
                    code: 'DUPLICATE_ASSET_CODE',
                    message: `资产编号重复: ${code}，涉及 ${ids.length} 个资产`,
                    type: 'error',
                    assetCode: code,
                    details: { assetIds: ids }
                });
            }
        }
        for (const asset of assets) {
            const assetTransfers = transfers.filter(t => t.assetId === asset.id);
            const assetScrap = scraps.find(s => s.assetId === asset.id);
            if (assetScrap) {
                for (const transfer of assetTransfers) {
                    const transferDate = (0, date_1.parseDate)(transfer.transferDate);
                    const scrapDate = (0, date_1.parseDate)(assetScrap.scrapDate);
                    if (transferDate >= scrapDate) {
                        anomalies.push({
                            code: 'TRANSFER_AFTER_SCRAP',
                            message: `资产 ${asset.code} 在报废后仍有调拨，报废日期: ${assetScrap.scrapDate}，调拨日期: ${transfer.transferDate}`,
                            type: 'error',
                            assetId: asset.id,
                            assetCode: asset.code,
                            storeId: transfer.fromStoreId,
                            details: {
                                scrapDate: assetScrap.scrapDate,
                                transferDate: transfer.transferDate,
                                transferId: transfer.id
                            }
                        });
                    }
                }
            }
        }
        for (const scrap of scraps) {
            const asset = assets.find(a => a.id === scrap.assetId);
            if (!asset) {
                anomalies.push({
                    code: 'SCRAP_NO_ASSET',
                    message: `报废记录引用不存在的资产: ${scrap.assetId}`,
                    type: 'error',
                    assetId: scrap.assetId,
                    details: { scrapRecordId: scrap.id }
                });
            }
        }
        const categoryInfo = {
            [types_1.AssetCategory.FREEZER]: { defaultLife: 60, residualRate: 0.05 },
            [types_1.AssetCategory.CASH_REGISTER]: { defaultLife: 36, residualRate: 0.05 },
            [types_1.AssetCategory.COFFEE_MACHINE]: { defaultLife: 48, residualRate: 0.05 }
        };
        for (const asset of assets) {
            const info = categoryInfo[asset.category];
            if (info) {
                if (asset.residualValueRate !== info.residualRate) {
                    anomalies.push({
                        code: 'RESIDUAL_RATE_VARIANCE',
                        message: `资产 ${asset.code} 残值率 ${asset.residualValueRate} 与类别默认值 ${info.residualRate} 不同`,
                        type: 'info',
                        assetId: asset.id,
                        assetCode: asset.code,
                        storeId: asset.currentStoreId,
                        details: {
                            category: asset.category,
                            currentRate: asset.residualValueRate,
                            defaultRate: info.residualRate
                        }
                    });
                }
            }
            if (asset.netBookValue < 0) {
                anomalies.push({
                    code: 'NEGATIVE_NET_BOOK_VALUE',
                    message: `资产 ${asset.code} 净值为负: ${asset.netBookValue}`,
                    type: 'error',
                    assetId: asset.id,
                    assetCode: asset.code,
                    storeId: asset.currentStoreId
                });
            }
        }
        const reports = [];
        let totalAssets = 0;
        let totalOriginalCost = 0;
        let totalAccumulatedDepreciation = 0;
        let totalNetBookValue = 0;
        for (const store of stores) {
            const storeAssets = assets.filter(a => a.currentStoreId === store.id);
            const storeDepDetails = filteredDepDetails.filter(d => d.storeId === store.id);
            const storeAnomalies = anomalies.filter(a => a.storeId === store.id);
            const categoryBreakdown = [];
            const categories = Object.values(types_1.AssetCategory);
            for (const category of categories) {
                const categoryAssets = storeAssets.filter(a => a.category === category);
                if (categoryAssets.length > 0) {
                    categoryBreakdown.push({
                        category,
                        count: categoryAssets.length,
                        originalCost: categoryAssets.reduce((sum, a) => sum + a.originalCost, 0),
                        accumulatedDepreciation: categoryAssets.reduce((sum, a) => sum + a.accumulatedDepreciation, 0),
                        netBookValue: categoryAssets.reduce((sum, a) => sum + a.netBookValue, 0)
                    });
                }
            }
            const storeOriginalCost = storeAssets.reduce((sum, a) => sum + a.originalCost, 0);
            const storeAccumulatedDepreciation = storeAssets.reduce((sum, a) => sum + a.accumulatedDepreciation, 0);
            const storeNetBookValue = storeAssets.reduce((sum, a) => sum + a.netBookValue, 0);
            reports.push({
                storeId: store.id,
                storeName: store.name,
                storeCode: store.code,
                totalAssets: storeAssets.length,
                totalOriginalCost: Math.round(storeOriginalCost * 100) / 100,
                totalAccumulatedDepreciation: Math.round(storeAccumulatedDepreciation * 100) / 100,
                totalNetBookValue: Math.round(storeNetBookValue * 100) / 100,
                assetBreakdown: categoryBreakdown.map(b => ({
                    ...b,
                    originalCost: Math.round(b.originalCost * 100) / 100,
                    accumulatedDepreciation: Math.round(b.accumulatedDepreciation * 100) / 100,
                    netBookValue: Math.round(b.netBookValue * 100) / 100
                })),
                depreciationDetails: storeDepDetails,
                anomalies: storeAnomalies
            });
            totalAssets += storeAssets.length;
            totalOriginalCost += storeOriginalCost;
            totalAccumulatedDepreciation += storeAccumulatedDepreciation;
            totalNetBookValue += storeNetBookValue;
        }
        return {
            reports,
            summary: {
                totalStores: stores.length,
                totalAssets,
                totalOriginalCost: Math.round(totalOriginalCost * 100) / 100,
                totalAccumulatedDepreciation: Math.round(totalAccumulatedDepreciation * 100) / 100,
                totalNetBookValue: Math.round(totalNetBookValue * 100) / 100,
                anomalies
            }
        };
    }
}
exports.ReportService = ReportService;
//# sourceMappingURL=ReportService.js.map
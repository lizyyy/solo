"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AssetService = void 0;
const types_1 = require("../types");
const DepreciationService_1 = require("./DepreciationService");
const date_1 = require("../utils/date");
const id_1 = require("../utils/id");
class AssetService {
    constructor(storage) {
        this.processedIds = new Set();
        this.storage = storage;
        this.depreciationService = new DepreciationService_1.DepreciationService();
    }
    async findAsset(assetId, assets) {
        return assets.find(a => a.id === assetId || a.code === assetId);
    }
    async findStore(storeId, stores) {
        return stores.find(s => s.id === storeId || s.code === storeId);
    }
    async validateAll() {
        const assets = await this.storage.getAssets();
        const acquisitions = await this.storage.getAcquisitions();
        const transfers = await this.storage.getTransfers();
        const repairs = await this.storage.getRepairs();
        const scraps = await this.storage.getScraps();
        const stores = await this.storage.getStores();
        const errors = [];
        const warnings = [];
        const assetCodes = new Map();
        for (const asset of assets) {
            if (assetCodes.has(asset.code)) {
                errors.push({
                    code: 'DUPLICATE_ASSET_CODE',
                    message: `资产编号重复: ${asset.code}，已存在于资产 ${assetCodes.get(asset.code)}`,
                    severity: 'error',
                    assetId: asset.id
                });
            }
            else {
                assetCodes.set(asset.code, asset.id);
            }
        }
        for (const asset of assets) {
            const store = stores.find(s => s.id === asset.currentStoreId);
            if (!store) {
                errors.push({
                    code: 'INVALID_STORE',
                    message: `资产 ${asset.code} 所在门店 ${asset.currentStoreId} 不存在`,
                    severity: 'error',
                    assetId: asset.id,
                    storeId: asset.currentStoreId
                });
            }
        }
        for (const acquisition of acquisitions) {
            const asset = assets.find(a => a.id === acquisition.assetId);
            if (!asset) {
                errors.push({
                    code: 'INVALID_ACQUISITION_ASSET',
                    message: `购置记录引用不存在的资产: ${acquisition.assetId}`,
                    severity: 'error',
                    assetId: acquisition.assetId,
                    recordId: acquisition.id
                });
            }
        }
        for (const transfer of transfers) {
            const asset = assets.find(a => a.id === transfer.assetId);
            if (!asset) {
                errors.push({
                    code: 'INVALID_TRANSFER_ASSET',
                    message: `调拨记录引用不存在的资产: ${transfer.assetId}`,
                    severity: 'error',
                    assetId: transfer.assetId,
                    recordId: transfer.id
                });
                continue;
            }
            const scrap = scraps.find(s => s.assetId === transfer.assetId);
            if (scrap) {
                const scrapDate = (0, date_1.parseDate)(scrap.scrapDate);
                const transferDate = (0, date_1.parseDate)(transfer.transferDate);
                if (transferDate >= scrapDate) {
                    errors.push({
                        code: 'TRANSFER_AFTER_SCRAP',
                        message: `资产 ${asset.code} 在报废后仍有调拨记录，报废日期: ${scrap.scrapDate}，调拨日期: ${transfer.transferDate}`,
                        severity: 'error',
                        assetId: transfer.assetId,
                        recordId: transfer.id
                    });
                }
            }
            const fromStore = stores.find(s => s.id === transfer.fromStoreId);
            const toStore = stores.find(s => s.id === transfer.toStoreId);
            if (!fromStore) {
                errors.push({
                    code: 'INVALID_FROM_STORE',
                    message: `调拨记录的调出门店不存在: ${transfer.fromStoreId}`,
                    severity: 'error',
                    assetId: transfer.assetId,
                    storeId: transfer.fromStoreId
                });
            }
            if (!toStore) {
                errors.push({
                    code: 'INVALID_TO_STORE',
                    message: `调拨记录的调入门店不存在: ${transfer.toStoreId}`,
                    severity: 'error',
                    assetId: transfer.assetId,
                    storeId: transfer.toStoreId
                });
            }
            if (transfer.fromStoreId === transfer.toStoreId) {
                warnings.push({
                    code: 'SAME_STORE_TRANSFER',
                    message: `资产 ${asset.code} 调拨到同一门店: ${transfer.fromStoreId}`,
                    severity: 'warning',
                    assetId: transfer.assetId,
                    recordId: transfer.id
                });
            }
        }
        for (const repair of repairs) {
            const asset = assets.find(a => a.id === repair.assetId);
            if (!asset) {
                errors.push({
                    code: 'INVALID_REPAIR_ASSET',
                    message: `维修记录引用不存在的资产: ${repair.assetId}`,
                    severity: 'error',
                    assetId: repair.assetId,
                    recordId: repair.id
                });
                continue;
            }
            if (repair.repairType === types_1.RepairType.CAPITALIZED) {
                if (repair.extendedLifeMonths <= 0) {
                    warnings.push({
                        code: 'CAPITALIZED_REPAIR_NO_EXTENSION',
                        message: `资本化维修未延长使用年限，资产: ${asset.code}，维修日期: ${repair.repairDate}`,
                        severity: 'warning',
                        assetId: repair.assetId,
                        recordId: repair.id
                    });
                }
            }
        }
        for (const scrap of scraps) {
            const asset = assets.find(a => a.id === scrap.assetId);
            if (!asset) {
                errors.push({
                    code: 'INVALID_SCRAP_ASSET',
                    message: `报废记录引用不存在的资产: ${scrap.assetId}`,
                    severity: 'error',
                    assetId: scrap.assetId,
                    recordId: scrap.id
                });
                continue;
            }
        }
        for (const asset of assets) {
            const monthlyDepreciation = this.depreciationService.calculateMonthlyDepreciation(asset.originalCost, asset.usefulLifeMonths, asset.residualValueRate);
            const acquisitionDate = (0, date_1.parseDate)(asset.acquisitionDate);
            const now = new Date();
            const monthsUsed = (0, date_1.diffInMonths)((0, date_1.getStartOfMonth)(acquisitionDate), (0, date_1.getStartOfMonth)(now));
            const expectedAccumulated = Math.min(monthlyDepreciation * monthsUsed, asset.originalCost * (1 - asset.residualValueRate));
            if (Math.abs(asset.accumulatedDepreciation - expectedAccumulated) > 1) {
                warnings.push({
                    code: 'DEPRECIATION_MISMATCH',
                    message: `资产 ${asset.code} 累计折旧与预期值不符，当前: ${asset.accumulatedDepreciation}，预期: ${expectedAccumulated.toFixed(2)}`,
                    severity: 'warning',
                    assetId: asset.id
                });
            }
        }
        return {
            valid: errors.length === 0,
            errors,
            warnings
        };
    }
    async processAllTransactions(operator = 'system') {
        const assets = await this.storage.getAssets();
        const acquisitions = await this.storage.getAcquisitions();
        const transfers = await this.storage.getTransfers();
        const repairs = await this.storage.getRepairs();
        const scraps = await this.storage.getScraps();
        const stores = await this.storage.getStores();
        const existingHistory = await this.storage.getHistory();
        const existingCorrections = await this.storage.getCorrections();
        const warnings = [];
        const history = [...existingHistory];
        const corrections = [...existingCorrections];
        this.processedIds = new Set(existingHistory.map(h => h.transactionId));
        const assetMap = new Map(assets.map(a => [a.id, { ...a }]));
        for (const acquisition of acquisitions) {
            if (this.processedIds.has(acquisition.id)) {
                continue;
            }
            const asset = assetMap.get(acquisition.assetId);
            if (!asset) {
                warnings.push(`购置记录 ${acquisition.id} 引用不存在的资产`);
                continue;
            }
            const beforeState = JSON.stringify({
                status: asset.status,
                originalCost: asset.originalCost,
                storeId: asset.currentStoreId
            });
            asset.status = types_1.AssetStatus.ACTIVE;
            asset.originalCost = acquisition.cost;
            asset.netBookValue = acquisition.cost;
            asset.usefulLifeMonths = acquisition.usefulLifeMonths;
            asset.remainingLifeMonths = acquisition.usefulLifeMonths;
            asset.residualValueRate = acquisition.residualValueRate;
            asset.acquisitionDate = acquisition.acquisitionDate;
            asset.currentStoreId = acquisition.storeId;
            const afterState = JSON.stringify({
                status: asset.status,
                originalCost: asset.originalCost,
                storeId: asset.currentStoreId
            });
            history.push({
                id: (0, id_1.generateId)('hist'),
                assetId: asset.id,
                transactionType: types_1.TransactionType.ACQUISITION,
                transactionId: acquisition.id,
                fromStoreId: null,
                toStoreId: acquisition.storeId,
                amount: acquisition.cost,
                description: `购置资产：${asset.name}，供应商：${acquisition.supplier}`,
                operator,
                beforeState,
                afterState,
                createdAt: new Date().toISOString()
            });
            this.processedIds.add(acquisition.id);
        }
        const sortedTransfers = [...transfers].sort((a, b) => (0, date_1.parseDate)(a.transferDate).getTime() - (0, date_1.parseDate)(b.transferDate).getTime());
        for (const transfer of sortedTransfers) {
            if (this.processedIds.has(transfer.id)) {
                continue;
            }
            const asset = assetMap.get(transfer.assetId);
            if (!asset) {
                warnings.push(`调拨记录 ${transfer.id} 引用不存在的资产`);
                continue;
            }
            if (asset.status === types_1.AssetStatus.SCRAPPED) {
                warnings.push(`资产 ${asset.code} 已报废，无法进行调拨`);
                continue;
            }
            const beforeState = JSON.stringify({
                status: asset.status,
                storeId: asset.currentStoreId,
                accumulatedDepreciation: asset.accumulatedDepreciation
            });
            asset.currentStoreId = transfer.toStoreId;
            const afterState = JSON.stringify({
                status: asset.status,
                storeId: asset.currentStoreId,
                accumulatedDepreciation: asset.accumulatedDepreciation
            });
            history.push({
                id: (0, id_1.generateId)('hist'),
                assetId: asset.id,
                transactionType: types_1.TransactionType.TRANSFER,
                transactionId: transfer.id,
                fromStoreId: transfer.fromStoreId,
                toStoreId: transfer.toStoreId,
                amount: 0,
                description: `资产调拨：从 ${transfer.fromStoreId} 到 ${transfer.toStoreId}，原因：${transfer.reason}`,
                operator,
                beforeState,
                afterState,
                createdAt: new Date().toISOString()
            });
            this.processedIds.add(transfer.id);
        }
        const sortedRepairs = [...repairs].sort((a, b) => (0, date_1.parseDate)(a.repairDate).getTime() - (0, date_1.parseDate)(b.repairDate).getTime());
        for (const repair of sortedRepairs) {
            if (this.processedIds.has(repair.id)) {
                continue;
            }
            const asset = assetMap.get(repair.assetId);
            if (!asset) {
                warnings.push(`维修记录 ${repair.id} 引用不存在的资产`);
                continue;
            }
            if (asset.status === types_1.AssetStatus.SCRAPPED) {
                warnings.push(`资产 ${asset.code} 已报废，无法进行维修`);
                continue;
            }
            const beforeState = JSON.stringify({
                status: asset.status,
                originalCost: asset.originalCost,
                usefulLifeMonths: asset.usefulLifeMonths,
                remainingLifeMonths: asset.remainingLifeMonths
            });
            asset.status = types_1.AssetStatus.REPAIRING;
            if (repair.repairType === types_1.RepairType.CAPITALIZED) {
                asset.originalCost = asset.originalCost + repair.cost;
                asset.netBookValue = asset.netBookValue + repair.cost;
                asset.usefulLifeMonths = asset.usefulLifeMonths + repair.extendedLifeMonths;
                asset.remainingLifeMonths = asset.remainingLifeMonths + repair.extendedLifeMonths;
            }
            const afterState = JSON.stringify({
                status: asset.status,
                originalCost: asset.originalCost,
                usefulLifeMonths: asset.usefulLifeMonths,
                remainingLifeMonths: asset.remainingLifeMonths
            });
            history.push({
                id: (0, id_1.generateId)('hist'),
                assetId: asset.id,
                transactionType: types_1.TransactionType.REPAIR,
                transactionId: repair.id,
                fromStoreId: null,
                toStoreId: null,
                amount: repair.cost,
                description: `维修资产：${repair.description}，类型：${repair.repairType}，供应商：${repair.vendor}`,
                operator,
                beforeState,
                afterState,
                createdAt: new Date().toISOString()
            });
            this.processedIds.add(repair.id);
        }
        for (const scrap of scraps) {
            if (this.processedIds.has(scrap.id)) {
                continue;
            }
            const asset = assetMap.get(scrap.assetId);
            if (!asset) {
                warnings.push(`报废记录 ${scrap.id} 引用不存在的资产`);
                continue;
            }
            if (asset.status === types_1.AssetStatus.SCRAPPED) {
                warnings.push(`资产 ${asset.code} 已报废，无需重复处理`);
                continue;
            }
            const beforeState = JSON.stringify({
                status: asset.status,
                netBookValue: asset.netBookValue
            });
            asset.status = types_1.AssetStatus.SCRAPPED;
            const afterState = JSON.stringify({
                status: asset.status,
                netBookValue: scrap.scrapValue
            });
            history.push({
                id: (0, id_1.generateId)('hist'),
                assetId: asset.id,
                transactionType: types_1.TransactionType.SCRAP,
                transactionId: scrap.id,
                fromStoreId: null,
                toStoreId: null,
                amount: scrap.scrapValue,
                description: `资产报废：${scrap.reason}，残值：${scrap.scrapValue}`,
                operator,
                beforeState,
                afterState,
                createdAt: new Date().toISOString()
            });
            this.processedIds.add(scrap.id);
        }
        const updatedAssets = Array.from(assetMap.values());
        const state = await this.storage.getState();
        state.lastCheckAt = new Date().toISOString();
        await this.storage.saveState(state);
        return {
            assets: updatedAssets,
            history,
            corrections,
            warnings
        };
    }
    async saveProcessingResults(assets, history, corrections) {
        await this.storage.saveAssets(assets);
        await this.storage.saveHistory(history);
        await this.storage.saveCorrections(corrections);
    }
    async getAssetDetail(assetId) {
        const assets = await this.storage.getAssets();
        const stores = await this.storage.getStores();
        const acquisitions = await this.storage.getAcquisitions();
        const transfers = await this.storage.getTransfers();
        const repairs = await this.storage.getRepairs();
        const scraps = await this.storage.getScraps();
        const history = await this.storage.getHistory();
        const corrections = await this.storage.getCorrections();
        const depreciationDetails = await this.storage.getDepreciationDetails();
        const asset = await this.findAsset(assetId, assets);
        if (!asset) {
            return null;
        }
        const currentStore = stores.find(s => s.id === asset.currentStoreId) || null;
        return {
            asset,
            currentStore,
            history: history.filter(h => h.assetId === asset.id).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
            corrections: corrections.filter(c => c.assetId === asset.id).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
            depreciationHistory: depreciationDetails.filter(d => d.assetId === asset.id).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
            relatedRecords: {
                acquisition: acquisitions.find(a => a.assetId === asset.id) || null,
                transfers: transfers.filter(t => t.assetId === asset.id).sort((a, b) => (0, date_1.parseDate)(b.transferDate).getTime() - (0, date_1.parseDate)(a.transferDate).getTime()),
                repairs: repairs.filter(r => r.assetId === asset.id).sort((a, b) => (0, date_1.parseDate)(b.repairDate).getTime() - (0, date_1.parseDate)(a.repairDate).getTime()),
                scrap: scraps.find(s => s.assetId === asset.id) || null
            }
        };
    }
}
exports.AssetService = AssetService;
//# sourceMappingURL=AssetService.js.map
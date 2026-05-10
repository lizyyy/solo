"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CalculationService = void 0;
class CalculationService {
    constructor(store) {
        this.store = store;
    }
    calculateAllBatches() {
        const batches = this.store.getAllBatches();
        return batches.map(batch => this.calculateBatch(batch.productCode, batch.batchId));
    }
    calculateBatch(productCode, batchId) {
        const product = this.store.getProduct(productCode);
        const batchInventory = this.store.getBatchInventory(productCode, batchId);
        if (!product || !batchInventory) {
            return this.createEmptyBatchCalculation(productCode, batchId);
        }
        const purchases = Array.from(this.store.purchases.values()).filter(p => p.productCode === productCode && p.batchId === batchId);
        const sales = Array.from(this.store.sales.values()).filter(s => s.productCode === productCode && s.batchId === batchId);
        const losses = Array.from(this.store.losses.values()).filter(l => l.productCode === productCode && l.batchId === batchId);
        const inventories = Array.from(this.store.inventories.values()).filter(i => i.productCode === productCode && i.batchId === batchId);
        const totalCost = purchases.reduce((sum, p) => sum + p.quantity * p.unitCost, 0);
        const totalRevenue = sales.reduce((sum, s) => sum + s.quantity * s.unitPrice, 0);
        const grossProfit = totalRevenue - totalCost;
        const grossProfitMargin = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;
        const lossQuantity = batchInventory.lost;
        const lossCost = lossQuantity * batchInventory.unitCost;
        const lossRate = batchInventory.purchased > 0 ? (lossQuantity / batchInventory.purchased) * 100 : 0;
        const expectedInventory = batchInventory.purchased - batchInventory.sold - batchInventory.lost;
        const actualInventory = inventories.length > 0
            ? inventories[inventories.length - 1].countedQuantity
            : expectedInventory;
        const inventoryDiscrepancy = actualInventory - expectedInventory;
        const inventoryDiscrepancyCost = Math.abs(inventoryDiscrepancy) * batchInventory.unitCost;
        return {
            productCode,
            productName: product.name,
            batchId,
            totalCost,
            totalRevenue,
            grossProfit,
            grossProfitMargin,
            lossQuantity,
            lossCost,
            lossRate,
            expectedInventory,
            actualInventory,
            inventoryDiscrepancy,
            inventoryDiscrepancyCost
        };
    }
    calculateProductSummary(productCode) {
        const product = this.store.getProduct(productCode);
        const batches = this.store.getAllBatches().filter(b => b.productCode === productCode);
        if (!product) {
            return this.createEmptyProductSummary(productCode);
        }
        const batchCalculations = batches.map(b => this.calculateBatch(b.productCode, b.batchId));
        const totalPurchased = batchCalculations.reduce((sum, b) => sum + (b.expectedInventory + b.lossQuantity +
            (this.store.getBatchInventory(productCode, b.batchId)?.sold || 0)), 0);
        const totalSold = batchCalculations.reduce((sum, b) => sum +
            (this.store.getBatchInventory(productCode, b.batchId)?.sold || 0), 0);
        const totalLoss = batchCalculations.reduce((sum, b) => sum + b.lossQuantity, 0);
        const expectedInventory = batchCalculations.reduce((sum, b) => sum + b.expectedInventory, 0);
        const actualInventory = batchCalculations.reduce((sum, b) => sum + b.actualInventory, 0);
        const totalDiscrepancy = batchCalculations.reduce((sum, b) => sum + b.inventoryDiscrepancy, 0);
        const totalCost = batchCalculations.reduce((sum, b) => sum + b.totalCost, 0);
        const totalRevenue = batchCalculations.reduce((sum, b) => sum + b.totalRevenue, 0);
        const totalGrossProfit = totalRevenue - totalCost;
        const overallLossRate = totalPurchased > 0 ? (totalLoss / totalPurchased) * 100 : 0;
        return {
            productCode,
            productName: product.name,
            totalPurchased,
            totalSold,
            totalLoss,
            expectedInventory,
            actualInventory,
            totalDiscrepancy,
            totalCost,
            totalRevenue,
            totalGrossProfit,
            overallLossRate,
            batches: batches.map(b => b.batchId)
        };
    }
    calculateAllProducts() {
        const products = Array.from(this.store.products.keys());
        return products.map(code => this.calculateProductSummary(code));
    }
    detectExceptions() {
        const exceptions = [];
        const batchCalculations = this.calculateAllBatches();
        for (const batch of batchCalculations) {
            if (batch.inventoryDiscrepancy !== 0) {
                exceptions.push({
                    code: 'INVENTORY_DISCREPANCY',
                    message: `盘点不一致`,
                    details: `商品 ${batch.productName}(${batch.productCode}) 批次 ${batch.batchId}：理论库存 ${batch.expectedInventory}，实际盘点 ${batch.actualInventory}，差异 ${batch.inventoryDiscrepancy > 0 ? '+' : ''}${batch.inventoryDiscrepancy}`,
                    productCode: batch.productCode,
                    batchId: batch.batchId
                });
            }
            if (batch.lossRate > 10) {
                exceptions.push({
                    code: 'HIGH_LOSS_RATE',
                    message: `损耗率过高`,
                    details: `商品 ${batch.productName}(${batch.productCode}) 批次 ${batch.batchId} 损耗率 ${batch.lossRate.toFixed(2)}%，超过 10% 预警值`,
                    productCode: batch.productCode,
                    batchId: batch.batchId
                });
            }
            if (batch.grossProfitMargin < 0) {
                exceptions.push({
                    code: 'NEGATIVE_PROFIT',
                    message: `负毛利`,
                    details: `商品 ${batch.productName}(${batch.productCode}) 批次 ${batch.batchId} 出现亏损，毛利 ${batch.grossProfit.toFixed(2)} 元`,
                    productCode: batch.productCode,
                    batchId: batch.batchId
                });
            }
        }
        return exceptions;
    }
    generateReport() {
        const batchCalculations = this.calculateAllBatches();
        const productSummaries = this.calculateAllProducts();
        const exceptions = this.detectExceptions();
        const summary = {
            totalProducts: productSummaries.length,
            totalBatches: batchCalculations.length,
            totalPurchased: productSummaries.reduce((sum, p) => sum + p.totalPurchased, 0),
            totalSold: productSummaries.reduce((sum, p) => sum + p.totalSold, 0),
            totalLoss: productSummaries.reduce((sum, p) => sum + p.totalLoss, 0),
            expectedInventory: productSummaries.reduce((sum, p) => sum + p.expectedInventory, 0),
            actualInventory: productSummaries.reduce((sum, p) => sum + p.actualInventory, 0),
            totalDiscrepancy: productSummaries.reduce((sum, p) => sum + p.totalDiscrepancy, 0),
            totalCost: productSummaries.reduce((sum, p) => sum + p.totalCost, 0),
            totalRevenue: productSummaries.reduce((sum, p) => sum + p.totalRevenue, 0),
            totalGrossProfit: productSummaries.reduce((sum, p) => sum + p.totalGrossProfit, 0),
            overallLossRate: productSummaries.reduce((sum, p) => sum + p.totalPurchased, 0) > 0
                ? (productSummaries.reduce((sum, p) => sum + p.totalLoss, 0) / productSummaries.reduce((sum, p) => sum + p.totalPurchased, 0)) * 100
                : 0
        };
        const needsReview = {
            batches: batchCalculations
                .filter(b => b.inventoryDiscrepancy !== 0 || b.lossRate > 10 || b.grossProfitMargin < 0)
                .map(b => b.batchId),
            records: []
        };
        return {
            generatedAt: Date.now(),
            summary,
            productSummaries,
            batchCalculations,
            exceptions,
            needsReview
        };
    }
    createEmptyBatchCalculation(productCode, batchId) {
        return {
            productCode,
            productName: '未知商品',
            batchId,
            totalCost: 0,
            totalRevenue: 0,
            grossProfit: 0,
            grossProfitMargin: 0,
            lossQuantity: 0,
            lossCost: 0,
            lossRate: 0,
            expectedInventory: 0,
            actualInventory: 0,
            inventoryDiscrepancy: 0,
            inventoryDiscrepancyCost: 0
        };
    }
    createEmptyProductSummary(productCode) {
        return {
            productCode,
            productName: '未知商品',
            totalPurchased: 0,
            totalSold: 0,
            totalLoss: 0,
            expectedInventory: 0,
            actualInventory: 0,
            totalDiscrepancy: 0,
            totalCost: 0,
            totalRevenue: 0,
            totalGrossProfit: 0,
            overallLossRate: 0,
            batches: []
        };
    }
}
exports.CalculationService = CalculationService;

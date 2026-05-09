"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.productionService = exports.ProductionService = void 0;
const inMemoryStore_1 = require("../storage/inMemoryStore");
class ProductionService {
    addProduction(params) {
        const shift = inMemoryStore_1.store.getShiftById(params.shiftId);
        if (!shift) {
            throw new Error(`班次不存在: ${params.shiftId}`);
        }
        if (params.quantity <= 0) {
            throw new Error('产量必须大于0');
        }
        const now = new Date();
        const record = {
            id: inMemoryStore_1.store.generateId(),
            shiftId: params.shiftId,
            productId: params.productId,
            productName: params.productName,
            quantity: params.quantity,
            timestamp: params.timestamp || now,
            status: 'pending',
            createdBy: params.createdBy,
            createdAt: now,
            updatedAt: now,
            version: 1,
        };
        return inMemoryStore_1.store.saveProduction(record);
    }
    addWaste(params) {
        const shift = inMemoryStore_1.store.getShiftById(params.shiftId);
        if (!shift) {
            throw new Error(`班次不存在: ${params.shiftId}`);
        }
        if (params.quantity <= 0) {
            throw new Error('废品数量必须大于0');
        }
        if (!params.reason || params.reason.trim().length === 0) {
            throw new Error('废品原因不能为空');
        }
        const now = new Date();
        const record = {
            id: inMemoryStore_1.store.generateId(),
            shiftId: params.shiftId,
            productId: params.productId,
            productName: params.productName,
            quantity: params.quantity,
            reason: params.reason,
            timestamp: params.timestamp || now,
            status: 'pending',
            createdBy: params.createdBy,
            createdAt: now,
            updatedAt: now,
            version: 1,
        };
        return inMemoryStore_1.store.saveWaste(record);
    }
    confirmProduction(id) {
        const record = inMemoryStore_1.store.getProductionById(id);
        if (!record) {
            throw new Error(`产量记录不存在: ${id}`);
        }
        if (record.status !== 'pending') {
            throw new Error(`产量记录状态不是待确认，无法确认: ${record.status}`);
        }
        const updated = {
            ...record,
            status: 'confirmed',
            updatedAt: new Date(),
            version: record.version + 1,
        };
        return inMemoryStore_1.store.saveProduction(updated);
    }
    confirmWaste(id) {
        const record = inMemoryStore_1.store.getWasteById(id);
        if (!record) {
            throw new Error(`废品记录不存在: ${id}`);
        }
        if (record.status !== 'pending') {
            throw new Error(`废品记录状态不是待确认，无法确认: ${record.status}`);
        }
        const updated = {
            ...record,
            status: 'confirmed',
            updatedAt: new Date(),
            version: record.version + 1,
        };
        return inMemoryStore_1.store.saveWaste(updated);
    }
    getShiftProductions(shiftId) {
        const records = inMemoryStore_1.store.getProductionsByShift(shiftId);
        const statuses = {
            pending: 0,
            confirmed: 0,
            revised: 0,
        };
        let total = 0;
        records.forEach((r) => {
            statuses[r.status]++;
            total += r.quantity;
        });
        return { records, statuses, total };
    }
    getShiftWastes(shiftId) {
        const records = inMemoryStore_1.store.getWastesByShift(shiftId);
        const statuses = {
            pending: 0,
            confirmed: 0,
            revised: 0,
        };
        let total = 0;
        records.forEach((r) => {
            statuses[r.status]++;
            total += r.quantity;
        });
        return { records, statuses, total };
    }
    calculateShiftSummary(shiftId) {
        const productions = this.getShiftProductions(shiftId);
        const wastes = this.getShiftWastes(shiftId);
        const productionTotal = productions.records
            .filter((r) => r.status !== 'pending')
            .reduce((sum, r) => sum + r.quantity, 0);
        const wasteTotal = wastes.records
            .filter((r) => r.status !== 'pending')
            .reduce((sum, r) => sum + r.quantity, 0);
        const netProduction = productionTotal - wasteTotal;
        const wasteRate = productionTotal > 0
            ? (wasteTotal / productionTotal) * 100
            : 0;
        return {
            productionTotal,
            wasteTotal,
            netProduction,
            wasteRate,
        };
    }
    getProductionRecord(id) {
        return inMemoryStore_1.store.getProductionById(id);
    }
    getWasteRecord(id) {
        return inMemoryStore_1.store.getWasteById(id);
    }
}
exports.ProductionService = ProductionService;
exports.productionService = new ProductionService();
//# sourceMappingURL=productionService.js.map
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.differenceCalculator = exports.DifferenceCalculator = void 0;
const uuid_1 = require("uuid");
const data_store_1 = require("./data-store");
class DifferenceCalculator {
    determineDifferenceType(bookQty, actualQty, hasBook, hasActual) {
        if (!hasBook && hasActual)
            return 'over_counted';
        if (hasBook && !hasActual)
            return 'not_counted';
        if (actualQty > bookQty)
            return 'profit';
        if (actualQty < bookQty)
            return 'loss';
        return 'matched';
    }
    getOwnerForLocation(location, owners) {
        const owner = owners.find(o => o.location === location);
        return owner ? owner.owner : '未分配';
    }
    calculateDifferences(auditId) {
        const errors = [];
        const bookInventory = data_store_1.dataStore.getBookInventory(auditId);
        const actualCount = data_store_1.dataStore.getActualCount(auditId);
        const locationOwners = data_store_1.dataStore.getLocationOwners();
        if (bookInventory.length === 0) {
            errors.push({
                type: 'sku_missing',
                message: '账面库存数据为空，请先导入账面库存'
            });
            return {
                success: false,
                totalItems: 0,
                matchedItems: 0,
                profitItems: 0,
                lossItems: 0,
                notCountedItems: 0,
                overCountedItems: 0,
                errors
            };
        }
        const bookMap = new Map();
        for (const item of bookInventory) {
            const key = `${item.location}-${item.sku}`;
            bookMap.set(key, item);
        }
        const actualMap = new Map();
        for (const item of actualCount) {
            const key = `${item.location}-${item.sku}`;
            actualMap.set(key, item);
        }
        const allKeys = new Set();
        bookMap.forEach((_, key) => allKeys.add(key));
        actualMap.forEach((_, key) => allKeys.add(key));
        const differences = [];
        const now = new Date().toISOString();
        let matched = 0;
        let profit = 0;
        let loss = 0;
        let notCounted = 0;
        let overCounted = 0;
        for (const key of allKeys) {
            const [location, sku] = key.split('-');
            const hasBook = bookMap.has(key);
            const hasActual = actualMap.has(key);
            const bookItem = bookMap.get(key);
            const actualItem = actualMap.get(key);
            if (!hasBook && !hasActual)
                continue;
            const bookQty = bookItem ? bookItem.quantity : 0;
            const actualQty = actualItem ? actualItem.quantity : 0;
            const diffQty = actualQty - bookQty;
            const diffType = this.determineDifferenceType(bookQty, actualQty, hasBook, hasActual);
            switch (diffType) {
                case 'matched':
                    matched++;
                    break;
                case 'profit':
                    profit++;
                    break;
                case 'loss':
                    loss++;
                    break;
                case 'not_counted':
                    notCounted++;
                    break;
                case 'over_counted':
                    overCounted++;
                    break;
            }
            const locationOwnersMap = new Map();
            for (const owner of locationOwners) {
                locationOwnersMap.set(owner.location, owner.owner);
            }
            differences.push({
                id: (0, uuid_1.v4)(),
                auditId,
                location,
                sku,
                bookQuantity: bookQty,
                actualQuantity: actualQty,
                differenceQuantity: diffQty,
                differenceType: diffType,
                owner: locationOwnersMap.get(location) || '未分配',
                approvalStatus: 'pending',
                createdAt: now,
                updatedAt: now
            });
        }
        data_store_1.dataStore.saveDifferences(auditId, differences);
        const session = data_store_1.dataStore.getAuditSession(auditId);
        if (session) {
            session.status = 'calculated';
            session.updatedAt = now;
            data_store_1.dataStore.saveAuditSession(session);
        }
        return {
            success: true,
            totalItems: differences.length,
            matchedItems: matched,
            profitItems: profit,
            lossItems: loss,
            notCountedItems: notCounted,
            overCountedItems: overCounted,
            errors
        };
    }
    getDifferencesByLocation(auditId, location) {
        const differences = data_store_1.dataStore.getDifferences(auditId);
        if (location) {
            return differences.filter(d => d.location === location);
        }
        return differences;
    }
    getDifferencesByOwner(auditId, owner) {
        const differences = data_store_1.dataStore.getDifferences(auditId);
        return differences.filter(d => d.owner === owner);
    }
    getDifferencesByType(auditId, type) {
        const differences = data_store_1.dataStore.getDifferences(auditId);
        return differences.filter(d => d.differenceType === type);
    }
    getUnmatchedDifferences(auditId) {
        const differences = data_store_1.dataStore.getDifferences(auditId);
        return differences.filter(d => d.differenceType !== 'matched');
    }
    validateAuditNotCalculated(auditId) {
        const differences = data_store_1.dataStore.getDifferences(auditId);
        return differences.length === 0;
    }
}
exports.DifferenceCalculator = DifferenceCalculator;
exports.differenceCalculator = new DifferenceCalculator();

"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InventoryManager = void 0;
class InventoryManager {
    constructor(inventory, existingGrants = []) {
        this.inventory = new Map();
        for (const item of inventory) {
            this.inventory.set(item.giftSku, { ...item });
        }
        this.grants = [...existingGrants];
    }
    hasGift(giftSku) {
        return this.inventory.has(giftSku);
    }
    getAvailableQuantity(giftSku) {
        const item = this.inventory.get(giftSku);
        if (!item)
            return 0;
        const granted = this.getGrantedQuantity(giftSku);
        return Math.max(0, item.totalQuantity - granted);
    }
    getGrantedQuantity(giftSku) {
        return this.grants
            .filter((g) => g.giftSku === giftSku)
            .reduce((sum, g) => sum + g.quantity, 0);
    }
    getTotalQuantity(giftSku) {
        const item = this.inventory.get(giftSku);
        return item?.totalQuantity ?? 0;
    }
    canReserve(giftSku, quantity) {
        if (!this.hasGift(giftSku)) {
            return { can: false, reason: `赠品 ${giftSku} 不存在` };
        }
        const available = this.getAvailableQuantity(giftSku);
        if (available < quantity) {
            return {
                can: false,
                reason: `库存不足: 赠品 ${giftSku} 可用数量 ${available} < 请求数量 ${quantity}`,
            };
        }
        return { can: true, reason: '' };
    }
    reserveGift(giftSku, quantity, orderId, ruleId, replayId) {
        if (this.isOrderAlreadyGranted(orderId, giftSku)) {
            return { success: false, reason: `订单 ${orderId} 已领取过赠品 ${giftSku}` };
        }
        const check = this.canReserve(giftSku, quantity);
        if (!check.can) {
            return { success: false, reason: check.reason };
        }
        const item = this.inventory.get(giftSku);
        this.grants.push({
            orderId,
            giftSku,
            giftName: item.giftName,
            quantity,
            grantedAt: new Date().toISOString(),
            ruleId,
            replayId,
        });
        return { success: true, reason: `成功预留赠品 ${giftSku} x${quantity}` };
    }
    isOrderAlreadyGranted(orderId, giftSku) {
        return this.grants.some((g) => g.orderId === orderId && (!giftSku || g.giftSku === giftSku));
    }
    getGrantsByOrder(orderId) {
        return this.grants.filter((g) => g.orderId === orderId);
    }
    getAllGrants() {
        return [...this.grants];
    }
    getInventorySnapshot() {
        const snapshot = [];
        for (const [giftSku, item] of this.inventory.entries()) {
            snapshot.push({
                giftSku,
                giftName: item.giftName,
                totalQuantity: item.totalQuantity,
                availableQuantity: this.getAvailableQuantity(giftSku),
            });
        }
        return snapshot;
    }
    resetGrants() {
        this.grants = [];
    }
}
exports.InventoryManager = InventoryManager;
//# sourceMappingURL=InventoryManager.js.map
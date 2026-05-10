import { Inventory, GiftGrantRecord } from '../types';
export declare class InventoryManager {
    private inventory;
    private grants;
    constructor(inventory: Inventory[], existingGrants?: GiftGrantRecord[]);
    hasGift(giftSku: string): boolean;
    getAvailableQuantity(giftSku: string): number;
    getGrantedQuantity(giftSku: string): number;
    getTotalQuantity(giftSku: string): number;
    canReserve(giftSku: string, quantity: number): {
        can: boolean;
        reason: string;
    };
    reserveGift(giftSku: string, quantity: number, orderId: string, ruleId: string, replayId: string): {
        success: boolean;
        reason: string;
    };
    isOrderAlreadyGranted(orderId: string, giftSku?: string): boolean;
    getGrantsByOrder(orderId: string): GiftGrantRecord[];
    getAllGrants(): GiftGrantRecord[];
    getInventorySnapshot(): Inventory[];
    resetGrants(): void;
}
//# sourceMappingURL=InventoryManager.d.ts.map
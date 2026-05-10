import { Inventory, GiftGrantRecord } from '../types';

export class InventoryManager {
  private inventory: Map<string, Inventory>;
  private grants: GiftGrantRecord[];

  constructor(inventory: Inventory[], existingGrants: GiftGrantRecord[] = []) {
    this.inventory = new Map();
    for (const item of inventory) {
      this.inventory.set(item.giftSku, { ...item });
    }
    this.grants = [...existingGrants];
  }

  public hasGift(giftSku: string): boolean {
    return this.inventory.has(giftSku);
  }

  public getAvailableQuantity(giftSku: string): number {
    const item = this.inventory.get(giftSku);
    if (!item) return 0;
    const granted = this.getGrantedQuantity(giftSku);
    return Math.max(0, item.totalQuantity - granted);
  }

  public getGrantedQuantity(giftSku: string): number {
    return this.grants
      .filter((g) => g.giftSku === giftSku)
      .reduce((sum, g) => sum + g.quantity, 0);
  }

  public getTotalQuantity(giftSku: string): number {
    const item = this.inventory.get(giftSku);
    return item?.totalQuantity ?? 0;
  }

  public canReserve(giftSku: string, quantity: number): { can: boolean; reason: string } {
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

  public reserveGift(
    giftSku: string,
    quantity: number,
    orderId: string,
    ruleId: string,
    replayId: string
  ): { success: boolean; reason: string } {
    if (this.isOrderAlreadyGranted(orderId, giftSku)) {
      return { success: false, reason: `订单 ${orderId} 已领取过赠品 ${giftSku}` };
    }

    const check = this.canReserve(giftSku, quantity);
    if (!check.can) {
      return { success: false, reason: check.reason };
    }

    const item = this.inventory.get(giftSku)!;
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

  public isOrderAlreadyGranted(orderId: string, giftSku?: string): boolean {
    return this.grants.some((g) => g.orderId === orderId && (!giftSku || g.giftSku === giftSku));
  }

  public getGrantsByOrder(orderId: string): GiftGrantRecord[] {
    return this.grants.filter((g) => g.orderId === orderId);
  }

  public getAllGrants(): GiftGrantRecord[] {
    return [...this.grants];
  }

  public getInventorySnapshot(): Inventory[] {
    const snapshot: Inventory[] = [];
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

  public resetGrants(): void {
    this.grants = [];
  }
}

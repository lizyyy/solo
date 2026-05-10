import db from '../database';
import { Inventory, BusinessResponse, StatusType, OfflineReason, SourceType } from '../types';
import { generateId, now, successResponse, errorResponse, formatBusinessTime } from '../utils/business';
import channelStatusService from './channelStatusService';

export const inventoryService = {
  setInventory: (
    storeId: string,
    itemId: string,
    quantity: number,
    minThreshold: number,
    operator: string
  ): BusinessResponse => {
    if (quantity < 0) {
      return errorResponse('ERR-INV-001', '库存数量不能为负数');
    }
    if (minThreshold < 0) {
      return errorResponse('ERR-INV-002', '最低预警阈值不能为负数');
    }

    const existing = db.inventories.find(inv => inv.storeId === storeId && inv.itemId === itemId);
    const currentQty = existing?.quantity ?? 0;
    const currentThreshold = existing?.minThreshold ?? 0;

    const isStockout = quantity <= minThreshold;
    const wasStockout = existing ? currentQty <= currentThreshold : false;

    try {
      if (existing) {
        existing.quantity = quantity;
        existing.minThreshold = minThreshold;
        existing.updatedAt = now();
        existing.updatedBy = operator;
      } else {
        const newInv: Inventory = {
          id: generateId('inv'),
          storeId,
          itemId,
          quantity,
          minThreshold,
          updatedAt: now(),
          updatedBy: operator
        };
        db.addInventory(newInv);
      }
      db.save();

      const messages: string[] = [];
      let triggeredAutoOffline = false;
      let triggeredAutoOnline = false;

      if (isStockout && !wasStockout) {
        const channels = db.channels.filter(ch => ch.isActive);
        for (const ch of channels) {
          const result = channelStatusService.changeStatus(
            storeId, itemId, ch.id,
            StatusType.OFFLINE,
            OfflineReason.OUT_OF_STOCK,
            SourceType.AUTO,
            '系统-库存监控',
            `库存由${currentQty}降至${quantity}，低于阈值${minThreshold}`
          );
          if (result.success) triggeredAutoOffline = true;
        }
        messages.push(`库存不足已触发自动下架`);
      }

      if (!isStockout && wasStockout) {
        triggeredAutoOnline = true;
        messages.push(`库存已恢复，可执行恢复上架`);
      }

      return successResponse(
        `库存更新成功${messages.length > 0 ? '，' + messages.join('，') : ''}`,
        {
          门店ID: storeId,
          商品ID: itemId,
          更新前: `${currentQty}件（阈值${currentThreshold}）`,
          更新后: `${quantity}件（阈值${minThreshold}）`,
          库存状态: isStockout ? '库存不足' : '库存充足',
          自动下架: triggeredAutoOffline ? '已触发' : '未触发',
          可恢复上架: triggeredAutoOnline ? '是' : '否',
          操作人: operator,
          更新时间: formatBusinessTime(now())
        }
      );
    } catch (e: any) {
      return errorResponse('ERR-INV-003', `库存更新失败：${e.message}`);
    }
  },

  getInventory: (storeId: string, itemId: string): Inventory | null => {
    const found = db.inventories.find(inv => inv.storeId === storeId && inv.itemId === itemId);
    return found || null;
  },

  getAllInventories: (storeId?: string): Inventory[] => {
    let result = [...db.inventories];
    if (storeId) result = result.filter(inv => inv.storeId === storeId);
    return result;
  },

  checkStockout: (storeId: string, itemId: string): boolean => {
    const found = db.inventories.find(inv => inv.storeId === storeId && inv.itemId === itemId);
    if (!found) return true;
    return found.quantity <= found.minThreshold;
  },

  getStockoutItems: (storeId?: string): Inventory[] => {
    let result = [...db.inventories].filter(inv => inv.quantity <= inv.minThreshold);
    if (storeId) result = result.filter(inv => inv.storeId === storeId);
    return result;
  }
};

export default inventoryService;

const Wave = require('../models/Wave');
const Order = require('../models/Order');
const InventoryLock = require('../models/InventoryLock');

class InventoryManager {
  constructor(store) {
    this.store = store;
  }

  confirmWave(waveId) {
    const wave = this.store.getWaveById(waveId);
    if (!wave) {
      return { success: false, error: `波次不存在: ${waveId}` };
    }

    if (!wave.isPreview) {
      return { success: false, error: `波次状态不是 PREVIEW，当前状态: ${wave.status}` };
    }

    const existingLocks = this.store.getActiveLocksByWave(waveId);
    if (existingLocks.length > 0) {
      return {
        success: false,
        error: `波次 ${waveId} 已存在库存锁定，不能重复锁定`
      };
    }

    const createdLocks = [];
    const failedAllocations = [];

    for (const allocation of wave.allocations) {
      const lockCheck = this._checkExistingLock(
        waveId,
        allocation.orderId,
        allocation.sku,
        allocation.locationCode
      );

      if (lockCheck.exists) {
        failedAllocations.push({
          ...allocation,
          reason: '该商品已被其他波次锁定'
        });
        continue;
      }

      const inventory = this.store.getInventoryByLocationCode(allocation.locationCode);
      if (!inventory) {
        failedAllocations.push({
          ...allocation,
          reason: '库存记录不存在'
        });
        continue;
      }

      const available = Math.max(0, inventory.availableQty - inventory.lockedQty);
      if (available < allocation.qty) {
        failedAllocations.push({
          ...allocation,
          reason: `可用库存不足，需要 ${allocation.qty}，实际可用 ${available}`
        });
        continue;
      }

      const lock = this.store.addLock({
        waveId,
        orderId: allocation.orderId,
        sku: allocation.sku,
        locationCode: allocation.locationCode,
        qty: allocation.qty,
        status: InventoryLock.STATUS.ACTIVE
      });

      inventory.lockedQty += allocation.qty;
      inventory.updatedAt = new Date().toISOString();

      createdLocks.push(lock);
    }

    if (failedAllocations.length > 0) {
      for (const lock of createdLocks) {
        const inventory = this.store.getInventoryByLocationCode(lock.locationCode);
        if (inventory) {
          inventory.lockedQty = Math.max(0, inventory.lockedQty - lock.qty);
        }
        lock.status = InventoryLock.STATUS.RELEASED;
      }

      return {
        success: false,
        error: '库存锁定失败，已回滚',
        failedAllocations
      };
    }

    wave.status = Wave.STATUS.CONFIRMED;
    wave.confirmedAt = new Date().toISOString();
    wave.updatedAt = new Date().toISOString();

    for (const orderId of wave.orderIds) {
      const order = this.store.getOrderById(orderId);
      if (order) {
        order.status = Order.STATUS.ALLOCATED;
        order.waveId = waveId;
        order.updatedAt = new Date().toISOString();
      }
    }

    this.store.save();

    return {
      success: true,
      waveId,
      lockCount: createdLocks.length,
      orderCount: wave.orderIds.length
    };
  }

  _checkExistingLock(waveId, orderId, sku, locationCode) {
    const lockKey = InventoryLock.generateKey(waveId, orderId, sku, locationCode);
    const existing = this.store.getLockById(
      InventoryLock.generateId(waveId, orderId, sku, locationCode)
    );

    if (existing && existing.isActive) {
      return { exists: true, lock: existing };
    }

    const allLocks = this.store.getAllLocks();
    for (const lock of allLocks) {
      if (
        lock.orderId === orderId &&
        lock.sku === sku.toUpperCase() &&
        lock.locationCode === locationCode.toUpperCase() &&
        lock.isActive &&
        lock.waveId !== waveId
      ) {
        return { exists: true, lock };
      }
    }

    return { exists: false };
  }

  releaseWave(waveId) {
    const wave = this.store.getWaveById(waveId);
    if (!wave) {
      return { success: false, error: `波次不存在: ${waveId}` };
    }

    const activeLocks = this.store.getActiveLocksByWave(waveId);
    if (activeLocks.length === 0) {
      return { success: false, error: `波次 ${waveId} 没有活动的库存锁定` };
    }

    let releasedCount = 0;
    for (const lock of activeLocks) {
      const inventory = this.store.getInventoryByLocationCode(lock.locationCode);
      if (inventory) {
        inventory.lockedQty = Math.max(0, inventory.lockedQty - lock.qty);
        inventory.updatedAt = new Date().toISOString();
      }
      lock.status = InventoryLock.STATUS.RELEASED;
      lock.updatedAt = new Date().toISOString();
      releasedCount++;
    }

    wave.status = Wave.STATUS.RELEASED;
    wave.releasedAt = new Date().toISOString();
    wave.updatedAt = new Date().toISOString();

    for (const orderId of wave.orderIds) {
      const order = this.store.getOrderById(orderId);
      if (order && order.waveId === waveId) {
        order.status = Order.STATUS.PENDING;
        order.waveId = null;
        order.updatedAt = new Date().toISOString();
      }
    }

    this.store.save();

    return {
      success: true,
      waveId,
      releasedCount
    };
  }

  releaseFailedWaves() {
    const allWaves = this.store.getAllWaves();
    const failedOrPreviewWaves = allWaves.filter(
      w => w.isPreview || w.isFailed
    );

    const results = [];
    for (const wave of failedOrPreviewWaves) {
      const result = this.releaseWave(wave.waveId);
      results.push(result);
    }

    return {
      totalProcessed: failedOrPreviewWaves.length,
      successfullyReleased: results.filter(r => r.success).length,
      details: results
    };
  }

  checkOrderLockStatus(orderNumber) {
    const order = this.store.getOrderByNumber(orderNumber);
    if (!order) {
      return { exists: false, message: `订单不存在: ${orderNumber}` };
    }

    const locks = this.store.getActiveLocksByOrder(order.orderId);
    return {
      exists: true,
      orderNumber: order.orderNumber,
      orderId: order.orderId,
      status: order.status,
      waveId: order.waveId,
      activeLockCount: locks.length,
      locks: locks.map(l => ({
        lockId: l.lockId,
        waveId: l.waveId,
        sku: l.sku,
        locationCode: l.locationCode,
        qty: l.qty
      }))
    };
  }
}

module.exports = InventoryManager;

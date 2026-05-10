const Wave = require('../models/Wave');
const Order = require('../models/Order');
const Location = require('../models/Location');
const InventoryLock = require('../models/InventoryLock');

class WaveGenerator {
  constructor(store) {
    this.store = store;
  }

  generateWaves() {
    const pendingOrders = this._getEligibleOrders();
    const { orders: preCheckedOrders, exceptions } = this._preCheckOrders(pendingOrders);
    const groupedOrders = this._groupOrders(preCheckedOrders);
    const waves = this._createWaves(groupedOrders);
    const result = this._calculateAllocations(waves, preCheckedOrders);

    return {
      waves: result.waves,
      exceptions: exceptions.concat(result.exceptions),
      orders: preCheckedOrders
    };
  }

  _getEligibleOrders() {
    const allOrders = this.store.getAllOrders();
    return allOrders.filter(order => {
      const activeLocks = this.store.getActiveLocksByOrder(order.orderId);
      if (activeLocks.length > 0) return false;
      if (order.isAllocated) return false;
      return true;
    });
  }

  _preCheckOrders(orders) {
    const exceptions = [];
    const validOrders = [];

    for (const order of orders) {
      const orderExceptions = [];

      if (order.isCancelled) {
        orderExceptions.push({
          code: 'ORDER_CANCELLED',
          message: `订单已取消`,
          orderNumber: order.orderNumber
        });
      }

      const carrier = this.store.getCarrierByCode(order.carrierCode);
      if (carrier && this._isCutoffPassed(carrier.cutoffTime)) {
        orderExceptions.push({
          code: 'CUTOFF_PASSED',
          message: `已过承运商 ${carrier.name} 截单时间 ${carrier.cutoffTime}`,
          orderNumber: order.orderNumber,
          carrierCode: carrier.carrierCode,
          cutoffTime: carrier.cutoffTime
        });
      }

      for (const item of order.items) {
        const locations = this.store.getLocationsBySku(item.sku);
        if (locations.length === 0) {
          orderExceptions.push({
            code: 'LOCATION_MISSING',
            message: `商品 SKU:${item.sku} 没有配置库位`,
            orderNumber: order.orderNumber,
            sku: item.sku
          });
        }
      }

      if (orderExceptions.length > 0) {
        order.status = Order.STATUS.EXCEPTION;
        order.exceptionReasons = orderExceptions;
        exceptions.push({
          orderNumber: order.orderNumber,
          orderId: order.orderId,
          reasons: orderExceptions
        });
      } else {
        validOrders.push(order);
      }
    }

    return { orders: validOrders, exceptions };
  }

  _isCutoffPassed(cutoffTime) {
    if (!cutoffTime) return false;
    const now = new Date();
    const [hours, minutes] = cutoffTime.split(':').map(Number);
    const cutoff = new Date();
    cutoff.setHours(hours, minutes, 0, 0);
    return now > cutoff;
  }

  _groupOrders(orders) {
    const groups = new Map();

    for (const order of orders) {
      const zone = this._getPrimaryZone(order);
      const key = Wave.generateKey(zone, order.carrierCode);

      if (!groups.has(key)) {
        groups.set(key, {
          zone,
          carrierCode: order.carrierCode,
          carrierName: order.carrierName || null,
          orders: []
        });
      }
      groups.get(key).orders.push(order);
    }

    return groups;
  }

  _getPrimaryZone(order) {
    const skuZones = new Map();

    for (const item of order.items) {
      const locations = this.store.getLocationsBySku(item.sku);
      if (locations.length > 0) {
        const zone = locations[0].zone;
        skuZones.set(item.sku, zone);
      }
    }

    const zoneCounts = {};
    for (const zone of skuZones.values()) {
      zoneCounts[zone] = (zoneCounts[zone] || 0) + 1;
    }

    if (Object.keys(zoneCounts).length === 0) return 'UNKNOWN';

    const sortedZones = Object.entries(zoneCounts).sort((a, b) => b[1] - a[1]);
    return sortedZones[0][0];
  }

  _createWaves(groupedOrders) {
    const waves = [];
    const sequenceByKey = new Map();

    for (const [key, group] of groupedOrders.entries()) {
      const seq = (sequenceByKey.get(key) || 0) + 1;
      sequenceByKey.set(key, seq);

      const waveId = Wave.generateId(group.zone, group.carrierCode, seq);
      const carrier = this.store.getCarrierByCode(group.carrierCode);

      const wave = new Wave({
        waveId,
        zone: group.zone,
        carrierCode: group.carrierCode,
        carrierName: group.carrierName || (carrier ? carrier.name : null),
        status: Wave.STATUS.PREVIEW,
        orderIds: group.orders.map(o => o.orderId),
        cutoffTime: carrier ? carrier.cutoffTime : null
      });

      waves.push(wave);
    }

    return waves;
  }

  _calculateAllocations(waves, orders) {
    const exceptions = [];
    const inventorySnapshot = this._createInventorySnapshot();

    const orderMap = new Map();
    for (const order of orders) {
      orderMap.set(order.orderId, order);
    }

    for (const wave of waves) {
      const allocations = [];
      const waveExceptions = [];

      for (const orderId of wave.orderIds) {
        const order = orderMap.get(orderId);
        if (!order) continue;

        for (const item of order.items) {
          const allocation = this._findAllocation(
            item.sku,
            item.qty,
            inventorySnapshot
          );

          if (allocation) {
            allocations.push({
              orderId,
              orderNumber: order.orderNumber,
              sku: item.sku,
              locationCode: allocation.locationCode,
              qty: allocation.qty
            });
            inventorySnapshot[allocation.inventoryId].allocated += allocation.qty;
          } else {
            waveExceptions.push({
              code: 'INVENTORY_SHORTAGE',
              message: `商品 SKU:${item.sku} 库存不足，需要 ${item.qty}`,
              orderNumber: order.orderNumber,
              sku: item.sku,
              requiredQty: item.qty
            });
          }
        }
      }

      wave.allocations = allocations;

      if (waveExceptions.length > 0) {
        exceptions.push({
          waveId: wave.waveId,
          reasons: waveExceptions
        });
      }
    }

    return { waves, exceptions };
  }

  _createInventorySnapshot() {
    const snapshot = {};
    const inventories = this.store.getAllInventories();

    for (const inv of inventories) {
      const available = Math.max(0, inv.availableQty - inv.lockedQty);
      snapshot[inv.inventoryId] = {
        inventoryId: inv.inventoryId,
        locationCode: inv.locationCode,
        sku: inv.sku,
        available,
        allocated: 0
      };
    }

    return snapshot;
  }

  _findAllocation(sku, qty, snapshot) {
    const matchingItems = Object.values(snapshot).filter(
      item => item.sku === sku && (item.available - item.allocated) > 0
    );

    matchingItems.sort((a, b) => {
      const parsedA = Location.parseLocation(a.locationCode);
      const parsedB = Location.parseLocation(b.locationCode);
      if (parsedA.aisle !== parsedB.aisle) {
        return parsedA.aisle - parsedB.aisle;
      }
      return parsedA.bin - parsedB.bin;
    });

    for (const item of matchingItems) {
      const remaining = item.available - item.allocated;
      if (remaining >= qty) {
        return {
          inventoryId: item.inventoryId,
          locationCode: item.locationCode,
          qty
        };
      }
    }

    return null;
  }

  getWaveGroupingReason(wave) {
    const reasons = [];

    if (wave.zone !== 'UNKNOWN') {
      reasons.push(`库区：${wave.zone}（按库位区域合并）`);
    }

    reasons.push(`承运商：${wave.carrierCode}${wave.carrierName ? ` (${wave.carrierName})` : ''}`);

    if (wave.cutoffTime) {
      reasons.push(`截单时间：${wave.cutoffTime}`);
    }

    return reasons.join(' | ');
  }
}

module.exports = WaveGenerator;

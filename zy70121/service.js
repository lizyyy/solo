const { DataStore } = require('./data');

class AllergenRecallService {
  constructor() {
    this.store = new DataStore();
    this.recallCounter = 0;
    this.notificationCounter = 0;
    this.reportCounter = 0;
  }

  addAllergenRule(rule) {
    this.store.allergenRules.set(rule.ruleId, { ...rule });
  }

  addSkuBatch(batch) {
    this.store.skuBatches.set(batch.batchId, { ...batch });
  }

  addOrder(order) {
    this.store.orders.set(order.orderId, { ...order, recallStatus: '未召回' });
  }

  addInventory(item) {
    const key = `${item.skuId}:${item.batchId}`;
    this.store.inventory.set(key, { ...item });
  }

  getOrder(orderId) {
    return this.store.orders.get(orderId);
  }

  getInventory(skuId, batchId) {
    const key = `${skuId}:${batchId}`;
    return this.store.inventory.get(key);
  }

  getRecall(recallId) {
    return this.store.recalls.get(recallId);
  }

  getAllRecalls() {
    return Array.from(this.store.recalls.values());
  }

  acquireLock(resourceType, resourceId, ownerId) {
    const lockKey = `${resourceType}:${resourceId}`;
    if (this.store.locks.has(lockKey)) {
      const currentOwner = this.store.lockOwners.get(lockKey);
      if (currentOwner === ownerId) {
        return true;
      }
      return false;
    }
    this.store.locks.set(lockKey, true);
    this.store.lockOwners.set(lockKey, ownerId);
    return true;
  }

  releaseLock(resourceType, resourceId, ownerId) {
    const lockKey = `${resourceType}:${resourceId}`;
    const currentOwner = this.store.lockOwners.get(lockKey);
    if (currentOwner === ownerId) {
      this.store.locks.delete(lockKey);
      this.store.lockOwners.delete(lockKey);
      return true;
    }
    return false;
  }

  validateRecallInputs(ruleId, batchId) {
    const rule = this.store.allergenRules.get(ruleId);
    if (!rule) {
      throw new Error(`过敏源规则不存在: ${ruleId}`);
    }

    const batch = this.store.skuBatches.get(batchId);
    if (!batch) {
      throw new Error(`SKU批次不存在: ${batchId}`);
    }

    const batchHasAllergen = batch.actualAllergens.includes(rule.allergenName);
    if (!batchHasAllergen) {
      throw new Error(`批次 ${batchId} 不包含过敏源 ${rule.allergenName}`);
    }

    const recallExists = Array.from(this.store.recalls.values()).some(
      r => r.batchId === batchId && r.ruleId === ruleId && r.status !== '已取消'
    );
    if (recallExists) {
      throw new Error(`该批次已存在针对此过敏源的召回流程`);
    }

    return { rule, batch };
  }

  matchAffectedOrders(batchId) {
    const affectedOrders = [];
    
    for (const [orderId, order] of this.store.orders) {
      const affectedItems = order.items.filter(
        item => item.batchId === batchId
      );
      
      if (affectedItems.length > 0) {
        const affectedQuantity = affectedItems.reduce((sum, item) => sum + item.quantity, 0);
        const affectedAmount = affectedItems.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
        
        affectedOrders.push({
          orderId,
          customerName: order.customerName,
          customerPhone: order.customerPhone,
          customerEmail: order.customerEmail,
          orderDate: order.orderDate,
          orderStatus: order.status,
          affectedItems,
          affectedQuantity,
          affectedAmount
        });
      }
    }
    
    return affectedOrders;
  }

  generateRecallNotifications(recallId, rule, batch, affectedOrders) {
    const notifications = [];
    
    for (const order of affectedOrders) {
      this.notificationCounter++;
      const notification = {
        notificationId: `NOTICE-${String(this.notificationCounter).padStart(4, '0')}`,
        recallId,
        orderId: order.orderId,
        allergenName: rule.allergenName,
        severity: rule.severity,
        productName: batch.skuName,
        batchId: batch.batchId,
        customerName: order.customerName,
        customerPhone: order.customerPhone,
        customerEmail: order.customerEmail,
        affectedQuantity: order.affectedQuantity,
        affectedAmount: order.affectedAmount,
        symptoms: rule.affectedSymptoms,
        notificationType: order.orderStatus === '待发货' ? '取消发货通知' : '召回通知',
        sentAt: new Date().toISOString(),
        status: '已发送'
      };
      
      notifications.push(notification);
    }
    
    return notifications;
  }

  freezeInventory(batchId, recallId) {
    const frozenItems = [];
    
    for (const [key, inventory] of this.store.inventory) {
      if (inventory.batchId === batchId && inventory.status === '正常') {
        inventory.status = '已冻结';
        inventory.frozenAt = new Date().toISOString();
        inventory.frozenByRecall = recallId;
        frozenItems.push({
          skuId: inventory.skuId,
          batchId: inventory.batchId,
          warehouseId: inventory.warehouseId,
          frozenQuantity: inventory.availableQuantity,
          previousStatus: '正常'
        });
      }
    }
    
    return frozenItems;
  }

  updateOrderRecallStatus(affectedOrders, recallId) {
    for (const order of affectedOrders) {
      const storedOrder = this.store.orders.get(order.orderId);
      if (storedOrder) {
        if (storedOrder.status === '待发货') {
          storedOrder.status = '已拦截';
        }
        storedOrder.recallStatus = '已通知';
        storedOrder.recallId = recallId;
        storedOrder.notifiedAt = new Date().toISOString();
      }
    }
  }

  generateExecutionReport(recallId, rule, batch, affectedOrders, notifications, frozenInventory, reason) {
    this.reportCounter++;
    
    const totalAffectedQuantity = affectedOrders.reduce((sum, o) => sum + o.affectedQuantity, 0);
    const totalAffectedAmount = affectedOrders.reduce((sum, o) => sum + o.affectedAmount, 0);
    const totalFrozenQuantity = frozenInventory.reduce((sum, i) => sum + i.frozenQuantity, 0);
    
    const report = {
      reportId: `RPT-${String(this.reportCounter).padStart(4, '0')}`,
      recallId,
      generatedAt: new Date().toISOString(),
      summary: {
        ruleId: rule.ruleId,
        allergenName: rule.allergenName,
        severity: rule.severity,
        batchId: batch.batchId,
        skuId: batch.skuId,
        skuName: batch.skuName,
        reason,
        labelError: batch.labelError,
        actualAllergens: batch.actualAllergens,
        labeledAllergens: batch.labeledAllergens
      },
      orderRecallSummary: {
        totalAffectedOrders: affectedOrders.length,
        totalAffectedQuantity,
        totalAffectedAmount,
        ordersToShip: affectedOrders.filter(o => o.orderStatus === '待发货').length,
        ordersShipped: affectedOrders.filter(o => o.orderStatus !== '待发货').length,
        notificationsSent: notifications.length
      },
      inventoryFreezeSummary: {
        warehousesAffected: new Set(frozenInventory.map(i => i.warehouseId)).size,
        totalFrozenQuantity,
        items: frozenInventory
      },
      notifications: notifications.map(n => ({
        notificationId: n.notificationId,
        orderId: n.orderId,
        customerName: n.customerName,
        notificationType: n.notificationType,
        sentAt: n.sentAt
      })),
      status: '已完成'
    };
    
    return report;
  }

  initiateRecall(ruleId, batchId, reason) {
    const processId = `proc-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    if (!this.acquireLock('batch', batchId, processId)) {
      throw new Error(`批次 ${batchId} 正在被其他召回流程处理，请稍后重试`);
    }
    
    try {
      const { rule, batch } = this.validateRecallInputs(ruleId, batchId);
      
      this.recallCounter++;
      const recallId = `RECALL-${String(this.recallCounter).padStart(4, '0')}`;
      
      const recall = {
        recallId,
        ruleId,
        batchId,
        skuId: batch.skuId,
        skuName: batch.skuName,
        allergenName: rule.allergenName,
        severity: rule.severity,
        reason,
        initiatedAt: new Date().toISOString(),
        status: '处理中'
      };
      
      this.store.recalls.set(recallId, recall);
      
      const affectedOrders = this.matchAffectedOrders(batchId);
      recall.affectedOrdersCount = affectedOrders.length;
      
      const notifications = this.generateRecallNotifications(recallId, rule, batch, affectedOrders);
      recall.notificationsSent = notifications.length;
      
      this.updateOrderRecallStatus(affectedOrders, recallId);
      
      const frozenInventory = this.freezeInventory(batchId, recallId);
      recall.inventoryFrozen = frozenInventory.length > 0;
      
      const report = this.generateExecutionReport(recallId, rule, batch, affectedOrders, notifications, frozenInventory, reason);
      recall.report = report;
      recall.status = '已完成';
      recall.completedAt = new Date().toISOString();
      
      return {
        recallId,
        status: recall.status,
        summary: {
          allergen: rule.allergenName,
          product: batch.skuName,
          batch: batchId,
          affectedOrders: affectedOrders.length,
          notificationsSent: notifications.length,
          inventoryFrozen: frozenInventory.length > 0 ? frozenInventory[0].frozenQuantity : 0
        },
        report
      };
    } catch (error) {
      throw error;
    } finally {
      this.releaseLock('batch', batchId, processId);
    }
  }

  retryRecall(recallId) {
    const recall = this.store.recalls.get(recallId);
    if (!recall) {
      throw new Error(`召回记录不存在: ${recallId}`);
    }
    
    if (recall.status === '已完成') {
      return {
        recallId,
        status: recall.status,
        message: '该召回已完成，无需重试',
        report: recall.report
      };
    }
    
    if (recall.status === '已取消') {
      throw new Error('该召回已被取消，无法重试');
    }
    
    return this.initiateRecall(recall.ruleId, recall.batchId, recall.reason);
  }
}

module.exports = { AllergenRecallService };

const { v4: uuidv4 } = require('uuid');
const { ECN_STATUS, ITEM_STATUS, URGENCY_LEVEL } = require('./types');

class DataStore {
  constructor() {
    this.ecns = new Map();
    this.materialImpacts = new Map();
    this.productionOrders = new Map();
    this.purchaseOrders = new Map();
    this.customerOrders = new Map();
    this.history = new Map();
    this.callbacks = new Map();
    this.processedEvents = new Set();
  }

  generateId() {
    return uuidv4();
  }

  createECN(data) {
    const ecnId = `ECN-${Date.now().toString(36).toUpperCase()}`;
    const ecn = {
      id: ecnId,
      ...data,
      status: ECN_STATUS.DRAFT,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      version: 1
    };
    this.ecns.set(ecnId, ecn);
    this.addHistory(ecnId, 'CREATE', {
      action: '创建工程变更单',
      status: ECN_STATUS.DRAFT,
      operator: data.createdBy || 'SYSTEM',
      timestamp: new Date().toISOString()
    });
    return ecn;
  }

  updateECN(ecnId, updates, operator) {
    const ecn = this.ecns.get(ecnId);
    if (!ecn) return null;
    
    const oldStatus = ecn.status;
    const beforeData = { ...ecn };
    
    const updatedECN = {
      ...ecn,
      ...updates,
      updatedAt: new Date().toISOString(),
      version: ecn.version + 1
    };
    
    this.ecns.set(ecnId, updatedECN);
    
    if (updates.status && updates.status !== oldStatus) {
      this.addHistory(ecnId, 'STATUS_CHANGE', {
        action: `状态变更: ${oldStatus} -> ${updates.status}`,
        beforeStatus: oldStatus,
        afterStatus: updates.status,
        operator: operator || 'SYSTEM',
        timestamp: new Date().toISOString(),
        beforeData,
        afterData: { ...updatedECN }
      });
    }
    
    return updatedECN;
  }

  getECN(ecnId) {
    return this.ecns.get(ecnId) || null;
  }

  getAllECNs(filter = {}) {
    let results = Array.from(this.ecns.values());
    
    if (filter.status) {
      results = results.filter(e => e.status === filter.status);
    }
    if (filter.urgency) {
      results = results.filter(e => e.urgency === filter.urgency);
    }
    
    return results.sort((a, b) => 
      new Date(b.createdAt) - new Date(a.createdAt)
    );
  }

  addMaterialImpact(ecnId, materials) {
    const existing = this.materialImpacts.get(ecnId) || [];
    const newMaterials = materials.map(m => ({
      ...m,
      id: m.id || this.generateId(),
      status: ITEM_STATUS.PENDING,
      ecnId,
      addedAt: new Date().toISOString()
    }));
    
    const all = [...existing, ...newMaterials];
    this.materialImpacts.set(ecnId, all);
    return all;
  }

  getMaterialImpacts(ecnId) {
    return this.materialImpacts.get(ecnId) || [];
  }

  updateMaterialImpact(ecnId, materialId, updates) {
    const materials = this.materialImpacts.get(ecnId);
    if (!materials) return null;
    
    const index = materials.findIndex(m => m.id === materialId);
    if (index === -1) return null;
    
    const beforeData = { ...materials[index] };
    materials[index] = {
      ...materials[index],
      ...updates,
      updatedAt: new Date().toISOString()
    };
    
    this.addHistory(ecnId, 'MATERIAL_UPDATE', {
      action: `物料更新: ${materials[index].materialCode}`,
      beforeData,
      afterData: materials[index],
      diff: this.calculateDiff(beforeData, materials[index]),
      operator: updates.operator || 'SYSTEM',
      timestamp: new Date().toISOString()
    });
    
    return materials[index];
  }

  addProductionOrder(ecnId, orders) {
    const existing = this.productionOrders.get(ecnId) || [];
    const newOrders = orders.map(o => ({
      ...o,
      id: o.id || this.generateId(),
      status: ITEM_STATUS.PENDING,
      ecnId,
      addedAt: new Date().toISOString()
    }));
    
    const all = [...existing, ...newOrders];
    this.productionOrders.set(ecnId, all);
    return all;
  }

  getProductionOrders(ecnId) {
    return this.productionOrders.get(ecnId) || [];
  }

  updateProductionOrder(ecnId, orderId, updates) {
    const orders = this.productionOrders.get(ecnId);
    if (!orders) return null;
    
    const index = orders.findIndex(o => o.id === orderId);
    if (index === -1) return null;
    
    const beforeData = { ...orders[index] };
    orders[index] = {
      ...orders[index],
      ...updates,
      updatedAt: new Date().toISOString()
    };
    
    this.addHistory(ecnId, 'PRODUCTION_UPDATE', {
      action: `在制单更新: ${orders[index].orderNo}`,
      beforeData,
      afterData: orders[index],
      diff: this.calculateDiff(beforeData, orders[index]),
      operator: updates.operator || 'SYSTEM',
      timestamp: new Date().toISOString()
    });
    
    return orders[index];
  }

  addPurchaseOrder(ecnId, orders) {
    const existing = this.purchaseOrders.get(ecnId) || [];
    const newOrders = orders.map(o => ({
      ...o,
      id: o.id || this.generateId(),
      status: ITEM_STATUS.PENDING,
      ecnId,
      addedAt: new Date().toISOString()
    }));
    
    const all = [...existing, ...newOrders];
    this.purchaseOrders.set(ecnId, all);
    return all;
  }

  getPurchaseOrders(ecnId) {
    return this.purchaseOrders.get(ecnId) || [];
  }

  updatePurchaseOrder(ecnId, orderId, updates) {
    const orders = this.purchaseOrders.get(ecnId);
    if (!orders) return null;
    
    const index = orders.findIndex(o => o.id === orderId);
    if (index === -1) return null;
    
    const beforeData = { ...orders[index] };
    orders[index] = {
      ...orders[index],
      ...updates,
      updatedAt: new Date().toISOString()
    };
    
    this.addHistory(ecnId, 'PURCHASE_UPDATE', {
      action: `采购单更新: ${orders[index].poNumber}`,
      beforeData,
      afterData: orders[index],
      diff: this.calculateDiff(beforeData, orders[index]),
      operator: updates.operator || 'SYSTEM',
      timestamp: new Date().toISOString()
    });
    
    return orders[index];
  }

  addCustomerOrder(ecnId, orders) {
    const existing = this.customerOrders.get(ecnId) || [];
    const newOrders = orders.map(o => ({
      ...o,
      id: o.id || this.generateId(),
      status: ITEM_STATUS.PENDING,
      ecnId,
      addedAt: new Date().toISOString()
    }));
    
    const all = [...existing, ...newOrders];
    this.customerOrders.set(ecnId, all);
    return all;
  }

  getCustomerOrders(ecnId) {
    return this.customerOrders.get(ecnId) || [];
  }

  updateCustomerOrder(ecnId, orderId, updates) {
    const orders = this.customerOrders.get(ecnId);
    if (!orders) return null;
    
    const index = orders.findIndex(o => o.id === orderId);
    if (index === -1) return null;
    
    const beforeData = { ...orders[index] };
    orders[index] = {
      ...orders[index],
      ...updates,
      updatedAt: new Date().toISOString()
    };
    
    this.addHistory(ecnId, 'CUSTOMER_UPDATE', {
      action: `客户订单更新: ${orders[index].orderNo}`,
      beforeData,
      afterData: orders[index],
      diff: this.calculateDiff(beforeData, orders[index]),
      operator: updates.operator || 'SYSTEM',
      timestamp: new Date().toISOString()
    });
    
    return orders[index];
  }

  addHistory(ecnId, type, data) {
    const existing = this.history.get(ecnId) || [];
    existing.push({
      id: this.generateId(),
      type,
      ...data,
      createdAt: new Date().toISOString()
    });
    this.history.set(ecnId, existing);
  }

  getHistory(ecnId) {
    const records = this.history.get(ecnId) || [];
    return records.sort((a, b) => 
      new Date(a.createdAt) - new Date(b.createdAt)
    );
  }

  recordEvent(eventKey) {
    if (this.processedEvents.has(eventKey)) {
      return { isDuplicate: true };
    }
    this.processedEvents.add(eventKey);
    return { isDuplicate: false, timestamp: new Date().toISOString() };
  }

  hasEvent(eventKey) {
    return this.processedEvents.has(eventKey);
  }

  calculateDiff(before, after) {
    const diff = {};
    const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
    
    for (const key of keys) {
      if (JSON.stringify(before[key]) !== JSON.stringify(after[key])) {
        diff[key] = {
          before: before[key],
          after: after[key]
        };
      }
    }
    
    return diff;
  }

  getStatistics(ecnId) {
    const materials = this.getMaterialImpacts(ecnId);
    const production = this.getProductionOrders(ecnId);
    const purchases = this.getPurchaseOrders(ecnId);
    const customers = this.getCustomerOrders(ecnId);
    
    const countByStatus = (items) => {
      const counts = {};
      Object.values(ITEM_STATUS).forEach(s => counts[s] = 0);
      items.forEach(i => {
        if (counts[i.status] !== undefined) {
          counts[i.status]++;
        }
      });
      return counts;
    };
    
    return {
      ecnId,
      total: {
        materials: materials.length,
        productionOrders: production.length,
        purchaseOrders: purchases.length,
        customerOrders: customers.length
      },
      byStatus: {
        materials: countByStatus(materials),
        productionOrders: countByStatus(production),
        purchaseOrders: countByStatus(purchases),
        customerOrders: countByStatus(customers)
      }
    };
  }
}

module.exports = new DataStore();

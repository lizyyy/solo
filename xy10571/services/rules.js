const { 
  ECN_STATUS, 
  URGENCY_LEVEL, 
  ITEM_STATUS, 
  SHIPMENT_STATUS, 
  PURCHASE_CONFIRM_STATUS,
  PRODUCTION_STATUS 
} = require('../models/types');

class BusinessRules {

  static isUrgent(urgency) {
    return urgency === URGENCY_LEVEL.URGENT || urgency === URGENCY_LEVEL.CRITICAL;
  }

  static validateStatusTransition(fromStatus, toStatus) {
    const validTransitions = {
      [ECN_STATUS.DRAFT]: [ECN_STATUS.SUBMITTED, ECN_STATUS.CANCELLED],
      [ECN_STATUS.SUBMITTED]: [ECN_STATUS.IMPACT_ANALYZED, ECN_STATUS.REJECTED],
      [ECN_STATUS.IMPACT_ANALYZED]: [ECN_STATUS.APPROVED, ECN_STATUS.REJECTED],
      [ECN_STATUS.APPROVED]: [ECN_STATUS.IN_PROGRESS, ECN_STATUS.REJECTED],
      [ECN_STATUS.IN_PROGRESS]: [ECN_STATUS.COMPLETED, ECN_STATUS.FAILED],
      [ECN_STATUS.FAILED]: [ECN_STATUS.IN_PROGRESS],
      [ECN_STATUS.REJECTED]: [],
      [ECN_STATUS.COMPLETED]: [],
      [ECN_STATUS.CANCELLED]: []
    };

    return validTransitions[fromStatus]?.includes(toStatus) || false;
  }

  static canCloseECN(ecn, dataStore) {
    if (!this.isUrgent(ecn.urgency)) {
      return {
        canClose: true,
        reason: '非紧急变更，可正常关闭'
      };
    }

    const purchases = dataStore.getPurchaseOrders(ecn.id);
    const unconfirmedPurchases = purchases.filter(p => 
      p.confirmStatus === PURCHASE_CONFIRM_STATUS.NOT_CONFIRMED
    );

    if (unconfirmedPurchases.length > 0) {
      return {
        canClose: false,
        reason: `存在 ${unconfirmedPurchases.length} 个未确认的采购单，紧急变更需要采购确认后才能关闭`,
        unconfirmedPurchases: unconfirmedPurchases.map(p => p.poNumber)
      };
    }

    const pendingItems = this.getPendingItems(ecn.id, dataStore);
    if (pendingItems.total > 0) {
      return {
        canClose: false,
        reason: `存在 ${pendingItems.total} 个待处理项目`,
        pendingItems
      };
    }

    return {
      canClose: true,
      reason: '所有采购单已确认，可关闭'
    };
  }

  static getPendingItems(ecnId, dataStore) {
    const materials = dataStore.getMaterialImpacts(ecnId);
    const production = dataStore.getProductionOrders(ecnId);
    const purchases = dataStore.getPurchaseOrders(ecnId);
    const customers = dataStore.getCustomerOrders(ecnId);

    const isPending = status => 
      status === ITEM_STATUS.PENDING || 
      status === ITEM_STATUS.NOTIFIED ||
      status === ITEM_STATUS.FAILED;

    return {
      total: 
        materials.filter(m => isPending(m.status)).length +
        production.filter(p => isPending(p.status)).length +
        purchases.filter(p => isPending(p.status)).length +
        customers.filter(c => isPending(c.status)).length,
      materials: materials.filter(m => isPending(m.status)).map(m => m.materialCode),
      productionOrders: production.filter(p => isPending(p.status)).map(p => p.orderNo),
      purchaseOrders: purchases.filter(p => isPending(p.status)).map(p => p.poNumber),
      customerOrders: customers.filter(c => isPending(c.status)).map(c => c.orderNo)
    };
  }

  static handleUrgentFreeze(ecn, dataStore) {
    if (!this.isUrgent(ecn.urgency)) {
      return {
        frozen: false,
        reason: '非紧急变更，无需立即冻结'
      };
    }

    const productionOrders = dataStore.getProductionOrders(ecn.id);
    const frozenOrders = [];
    const skippedOrders = [];

    productionOrders.forEach(order => {
      if (order.shipmentStatus === SHIPMENT_STATUS.FULLY_SHIPPED) {
        dataStore.updateProductionOrder(ecn.id, order.id, {
          status: ITEM_STATUS.TRACE_ONLY,
          note: '已完全出货，仅追溯'
        }, 'SYSTEM');
        skippedOrders.push({
          orderNo: order.orderNo,
          reason: '已完全出货，仅追溯，不冻结'
        });
      } else if (order.shipmentStatus === SHIPMENT_STATUS.PARTIALLY_SHIPPED) {
        dataStore.updateProductionOrder(ecn.id, order.id, {
          status: ITEM_STATUS.NOTIFIED,
          frozen: true,
          note: '部分出货，剩余部分冻结'
        }, 'SYSTEM');
        frozenOrders.push({
          orderNo: order.orderNo,
          action: '部分出货，剩余冻结'
        });
      } else {
        dataStore.updateProductionOrder(ecn.id, order.id, {
          status: ITEM_STATUS.NOTIFIED,
          frozen: true,
          productionStatus: PRODUCTION_STATUS.FROZEN,
          note: '紧急变更，立即冻结'
        }, 'SYSTEM');
        frozenOrders.push({
          orderNo: order.orderNo,
          action: '完全冻结'
        });
      }
    });

    return {
      frozen: true,
      urgentLevel: ecn.urgency,
      frozenOrders,
      skippedOrders
    };
  }

  static handleShippedOrders(ecn, dataStore) {
    const customerOrders = dataStore.getCustomerOrders(ecn.id);
    const tracedOrders = [];

    customerOrders.forEach(order => {
      if (order.shipmentStatus === SHIPMENT_STATUS.FULLY_SHIPPED) {
        dataStore.updateCustomerOrder(ecn.id, order.id, {
          status: ITEM_STATUS.TRACE_ONLY,
          note: '已完全出货，仅做追溯记录，不做变更处理'
        }, 'SYSTEM');
        tracedOrders.push({
          orderNo: order.orderNo,
          action: '已出货，仅追溯'
        });
      } else if (order.shipmentStatus === SHIPMENT_STATUS.PARTIALLY_SHIPPED) {
        dataStore.updateCustomerOrder(ecn.id, order.id, {
          status: ITEM_STATUS.NOTIFIED,
          note: '部分出货，需要通知客户后续批次变更'
        }, 'SYSTEM');
        tracedOrders.push({
          orderNo: order.orderNo,
          action: '部分出货，已通知后续变更'
        });
      }
    });

    return {
      total: customerOrders.length,
      tracedOrders
    };
  }

  static checkIdempotency(eventKey, dataStore) {
    return dataStore.recordEvent(eventKey);
  }

  static generateEventKey(ecnId, action, itemType, itemId) {
    return `${ecnId}:${action}:${itemType}:${itemId}`;
  }

  static validateManualUpdate(beforeData, afterData, operator) {
    if (!operator) {
      return {
        valid: false,
        reason: '人工修正必须指定操作者'
      };
    }

    const diff = this.calculateDiff(beforeData, afterData);
    
    return {
      valid: true,
      diff,
      operator,
      timestamp: new Date().toISOString()
    };
  }

  static calculateDiff(before, after) {
    const diff = {};
    const keys = new Set([...Object.keys(before || {}), ...Object.keys(after || {})]);
    
    for (const key of keys) {
      const beforeVal = JSON.stringify(before?.[key]);
      const afterVal = JSON.stringify(after?.[key]);
      
      if (beforeVal !== afterVal) {
        diff[key] = {
          before: before?.[key],
          after: after?.[key]
        };
      }
    }
    
    return diff;
  }

  static identifyResponsiblePersons(ecn, dataStore) {
    const materials = dataStore.getMaterialImpacts(ecn.id);
    const production = dataStore.getProductionOrders(ecn.id);
    const purchases = dataStore.getPurchaseOrders(ecn.id);
    const customers = dataStore.getCustomerOrders(ecn.id);

    const pendingMaterials = materials.filter(m => 
      m.status === ITEM_STATUS.PENDING || m.status === ITEM_STATUS.NOTIFIED
    );
    const pendingProduction = production.filter(p => 
      p.status === ITEM_STATUS.PENDING || p.status === ITEM_STATUS.NOTIFIED
    );
    const pendingPurchases = purchases.filter(p => 
      p.status === ITEM_STATUS.PENDING || p.status === ITEM_STATUS.NOTIFIED
    );
    const pendingCustomers = customers.filter(c => 
      c.status === ITEM_STATUS.PENDING || c.status === ITEM_STATUS.NOTIFIED
    );

    return {
      ecnId: ecn.id,
      ecnTitle: ecn.title,
      responsible: {
        materials: {
          count: pendingMaterials.length,
          owner: '物料经理',
          items: pendingMaterials.map(m => ({
            materialCode: m.materialCode,
            status: m.status
          }))
        },
        production: {
          count: pendingProduction.length,
          owner: '生产主管',
          items: pendingProduction.map(p => ({
            orderNo: p.orderNo,
            status: p.status
          }))
        },
        purchases: {
          count: pendingPurchases.length,
          owner: '采购经理',
          items: pendingPurchases.map(p => ({
            poNumber: p.poNumber,
            status: p.status
          }))
        },
        customers: {
          count: pendingCustomers.length,
          owner: '销售经理',
          items: pendingCustomers.map(c => ({
            orderNo: c.orderNo,
            status: c.status
          }))
        }
      }
    };
  }
}

module.exports = BusinessRules;

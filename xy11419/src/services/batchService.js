const { v4: uuidv4 } = require('uuid');
const db = require('../database/store');
const OrderService = require('./orderService');
const { MERGE_STRATEGIES, ORDER_STATUS, BATCH_STATUS } = require('../utils/constants');

class BatchService {
  static createBatch(batchData, operator) {
    const batch = {
      id: uuidv4(),
      batch_no: batchData.batch_no || `BATCH${Date.now()}`,
      source_type: batchData.source_type || 'manual',
      source_name: batchData.source_name || '',
      description: batchData.description || '',
      merge_strategy: batchData.merge_strategy || MERGE_STRATEGIES.APPEND,
      status: BATCH_STATUS.DRAFT,
      total_orders: 0,
      imported_by: operator?.id || 'system',
      imported_by_name: operator?.name || '系统',
      remark: batchData.remark || '',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    
    db.insert('batches', batch);
    return batch;
  }

  static getBatches(filters = {}, page = 1, pageSize = 20) {
    let batches = db.findAll('batches');
    
    if (filters.status) {
      batches = batches.filter(b => b.status === filters.status);
    }
    if (filters.source_type) {
      batches = batches.filter(b => b.source_type === filters.source_type);
    }
    
    const total = batches.length;
    const start = (page - 1) * pageSize;
    batches = batches.slice(start, start + pageSize);
    
    return {
      total,
      page,
      pageSize,
      data: batches
    };
  }

  static getBatchWithDetails(batchId) {
    const batch = db.findById('batches', batchId);
    if (!batch) return null;
    
    return {
      ...batch,
      orders: db.findAll('work_orders', { batch_id: batchId }),
      evidences: db.findAll('evidences', { batch_id: batchId })
    };
  }

  static importOrders(batchId, ordersData, operator) {
    const batch = db.findById('batches', batchId);
    if (!batch) throw new Error('批次不存在');
    
    const results = {
      batch_id: batchId,
      created: [],
      updated: [],
      skipped: [],
      errors: []
    };
    
    ordersData.forEach((orderData, idx) => {
      try {
        orderData.batch_id = batchId;
        
        let existing = null;
        if (orderData.order_no) {
          existing = db.findOne('work_orders', { order_no: orderData.order_no });
        }
        
        if (existing) {
          const result = this.handleExistingOrder(existing, orderData, batch.merge_strategy, operator);
          results[result.action].push({
            order_no: orderData.order_no,
            ...result
          });
        } else {
          const order = OrderService.createOrder(orderData, operator);
          results.created.push({
            order_id: order.id,
            order_no: order.order_no
          });
        }
      } catch (err) {
        results.errors.push({
          index: idx,
          order_no: orderData.order_no,
          error: err.message
        });
      }
    });
    
    const total = db.query('work_orders', o => o.batch_id === batchId).length;
    db.update('batches', batchId, {
      total_orders: total,
      updated_at: new Date().toISOString()
    });
    
    return results;
  }

  static handleExistingOrder(existing, newData, mergeStrategy, operator) {
    switch (mergeStrategy) {
      case MERGE_STRATEGIES.IGNORE:
        return { action: 'skipped', reason: '已存在，忽略' };
      
      case MERGE_STRATEGIES.OVERWRITE:
        OrderService.updateOrder(existing.id, {
          ...newData,
          id: undefined,
          batch_id: undefined,
          order_no: undefined
        }, operator, '批次合并：覆盖更新');
        return { action: 'updated', reason: '已存在，覆盖更新' };
      
      case MERGE_STRATEGIES.APPEND:
        const merged = { ...existing };
        Object.keys(newData).forEach(key => {
          if (newData[key] && !existing[key]) {
            merged[key] = newData[key];
          } else if (newData[key] && existing[key] && typeof newData[key] === 'string') {
            merged[key] = existing[key] + '; ' + newData[key];
          }
        });
        OrderService.updateOrder(existing.id, merged, operator, '批次合并：追加补充');
        return { action: 'updated', reason: '已存在，追加补充' };
      
      default:
        return { action: 'skipped', reason: '未知策略' };
    }
  }

  static addEvidence(batchId, orderId, evidenceData, operator) {
    const evidence = {
      id: uuidv4(),
      batch_id: batchId,
      order_id: orderId,
      type: evidenceData.type || 'other',
      file_name: evidenceData.file_name || '',
      file_path: evidenceData.file_path || '',
      file_size: evidenceData.file_size || 0,
      description: evidenceData.description || '',
      uploaded_by: operator?.id || 'system',
      uploaded_by_name: operator?.name || '系统',
      created_at: new Date().toISOString()
    };
    db.insert('evidences', evidence);
    return evidence;
  }

  static addMaterial(orderId, materialData) {
    const material = {
      id: uuidv4(),
      order_id: orderId,
      material_name: materialData.material_name,
      quantity: materialData.quantity || 1,
      unit: materialData.unit || '个',
      unit_price: materialData.unit_price || 0,
      total_price: (materialData.quantity || 1) * (materialData.unit_price || 0),
      created_at: new Date().toISOString()
    };
    db.insert('materials', material);
    return material;
  }

  static deleteBatch(batchId) {
    db.remove('batches', batchId);
    
    const orders = db.findAll('work_orders', { batch_id: batchId });
    orders.forEach(o => db.remove('work_orders', o.id));
    
    const evidences = db.findAll('evidences', { batch_id: batchId });
    evidences.forEach(e => db.remove('evidences', e.id));
    
    return true;
  }
}

module.exports = BatchService;

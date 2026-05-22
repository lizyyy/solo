const { v4: uuidv4 } = require('uuid');
const db = require('../database/store');
const { ORDER_STATUS, STATUS_TRANSITIONS, SENSITIVE_FIELDS } = require('../utils/constants');
const { maskSensitiveData } = require('../utils/helpers');

class OrderService {
  static createOrder(orderData, operator) {
    const order = {
      id: uuidv4(),
      batch_id: orderData.batch_id || null,
      order_no: orderData.order_no || `WO${Date.now()}`,
      resident_name: orderData.resident_name || '',
      resident_phone: orderData.resident_phone || '',
      building: orderData.building || '',
      unit: orderData.unit || '',
      room: orderData.room || '',
      repair_type: orderData.repair_type || 'general',
      description: orderData.description || '',
      status: ORDER_STATUS.DRAFT,
      assignee_id: null,
      assignee_name: null,
      priority: orderData.priority || 'normal',
      estimated_cost: orderData.estimated_cost || 0,
      actual_cost: orderData.actual_cost || 0,
      created_at: new Date().toISOString(),
      created_by: operator?.id || 'system',
      created_by_name: operator?.name || '系统',
      updated_at: new Date().toISOString()
    };
    
    db.insert('work_orders', order);
    
    this.logStatusTransition(order.id, null, order.status, operator, '创建工单');
    
    return order;
  }

  static getOrders(filters = {}, page = 1, pageSize = 20) {
    let orders = db.findAll('work_orders');
    
    if (filters.status) {
      orders = orders.filter(o => o.status === filters.status);
    }
    if (filters.batch_id) {
      orders = orders.filter(o => o.batch_id === filters.batch_id);
    }
    if (filters.assignee_id) {
      orders = orders.filter(o => o.assignee_id === filters.assignee_id);
    }
    if (filters.repair_type) {
      orders = orders.filter(o => o.repair_type === filters.repair_type);
    }
    
    const total = orders.length;
    const start = (page - 1) * pageSize;
    orders = orders.slice(start, start + pageSize);
    
    return {
      total,
      page,
      pageSize,
      data: orders
    };
  }

  static getOrderWithDetails(orderId) {
    const order = db.findById('work_orders', orderId);
    if (!order) return null;
    
    return {
      ...order,
      transitions: db.findAll('status_transitions', { order_id: orderId }),
      audits: db.findAll('audit_logs', { order_id: orderId }),
      evidences: db.findAll('evidences', { order_id: orderId }),
      materials: db.findAll('materials', { order_id: orderId })
    };
  }

  static transitionStatus(orderId, toStatus, operator, reason, remark = '') {
    const order = db.findById('work_orders', orderId);
    if (!order) throw new Error('工单不存在');
    
    const fromStatus = order.status;
    const allowed = STATUS_TRANSITIONS[fromStatus] || [];
    if (!allowed.includes(toStatus)) {
      throw new Error(`不允许从 ${fromStatus} 转换到 ${toStatus}`);
    }
    
    const updated = db.update('work_orders', orderId, {
      status: toStatus,
      updated_at: new Date().toISOString()
    });
    
    this.logStatusTransition(orderId, fromStatus, toStatus, operator, reason, remark);
    
    return updated;
  }

  static logStatusTransition(orderId, fromStatus, toStatus, operator, reason, remark = '') {
    const transition = {
      id: uuidv4(),
      order_id: orderId,
      from_status: fromStatus,
      to_status: toStatus,
      operator_id: operator?.id || 'system',
      operator_name: operator?.name || '系统',
      reason: reason,
      remark: remark,
      created_at: new Date().toISOString()
    };
    db.insert('status_transitions', transition);
    return transition;
  }

  static assignOrder(orderId, assignee, operator) {
    const order = db.findById('work_orders', orderId);
    if (!order) throw new Error('工单不存在');
    
    const updated = db.update('work_orders', orderId, {
      assignee_id: assignee.id,
      assignee_name: assignee.name,
      status: ORDER_STATUS.ASSIGNED,
      updated_at: new Date().toISOString()
    });
    
    this.logStatusTransition(orderId, order.status, ORDER_STATUS.ASSIGNED, operator, `派单给 ${assignee.name}`);
    
    return updated;
  }

  static updateOrder(orderId, updates, operator, reason) {
    const order = db.findById('work_orders', orderId);
    if (!order) throw new Error('工单不存在');
    
    const auditData = {};
    SENSITIVE_FIELDS.forEach(field => {
      if (updates[field] !== undefined && updates[field] !== order[field]) {
        auditData[field] = {
          old: order[field],
          new: updates[field]
        };
      }
    });
    
    Object.keys(auditData).forEach(field => {
      this.logAudit(orderId, field, auditData[field].old, auditData[field].new, operator, reason);
    });
    
    return db.update('work_orders', orderId, {
      ...updates,
      updated_at: new Date().toISOString()
    });
  }

  static logAudit(orderId, field, oldValue, newValue, operator, reason) {
    const audit = {
      id: uuidv4(),
      order_id: orderId,
      field_name: field,
      old_value: oldValue,
      new_value: newValue,
      changed_by: operator?.id || 'system',
      changed_by_name: operator?.name || '系统',
      change_reason: reason,
      created_at: new Date().toISOString()
    };
    db.insert('audit_logs', audit);
    return audit;
  }

  static getAuditLogs(orderId) {
    return db.findAll('audit_logs', { order_id: orderId });
  }
}

module.exports = OrderService;

const fs = require('fs');
const path = require('path');
const { Parser } = require('json2csv');
const archiver = require('archiver');
const db = require('../database/store');
const { ORDER_STATUS, TASK_STATUS, FAIL_TYPES, ROLES } = require('../utils/constants');
const { maskSensitiveData } = require('../utils/helpers');

class ReportService {
  static getProjectManagerView(filters = {}) {
    const orders = db.findAll('work_orders');
    const tasks = db.findAll('async_tasks');
    const audits = db.findAll('audit_logs');
    
    const statusCounts = {};
    Object.values(ORDER_STATUS).forEach(s => statusCounts[s] = 0);
    orders.forEach(o => statusCounts[o.status] = (statusCounts[o.status] || 0) + 1);
    
    const byRepairType = {};
    orders.forEach(o => {
      byRepairType[o.repair_type] = (byRepairType[o.repair_type] || 0) + 1;
    });
    
    const totalCost = orders.reduce((sum, o) => sum + (o.actual_cost || 0), 0);
    
    const recentChanges = db.query('audit_logs', 
      a => new Date(a.created_at) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    ).slice(-20).reverse();
    
    const failedTasks = db.query('async_tasks', t => t.status === TASK_STATUS.FAILED).map(t => ({
      id: t.id,
      task_type: t.task_type,
      fail_type: t.fail_type,
      last_error: t.last_error,
      retry_count: t.retry_count,
      destination: this.getTaskDestination(t)
    }));
    
    const sensitiveChanges = audits.filter(a => 
      ['resident_name', 'resident_phone', 'actual_cost'].includes(a.field_name)
    ).slice(-10);
    
    return {
      overview: {
        total_orders: orders.length,
        completed_count: statusCounts[ORDER_STATUS.COMPLETED] || 0,
        completion_rate: orders.length ? ((statusCounts[ORDER_STATUS.COMPLETED] || 0) / orders.length * 100).toFixed(1) + '%' : '0%',
        repair_count: statusCounts.repair || 0,
        replacement_count: statusCounts.replacement || 0,
        total_cost: totalCost.toFixed(2)
      },
      by_status: statusCounts,
      by_repair_type: byRepairType,
      recent_changes: recentChanges.map(c => ({
        ...c,
        old_value: maskSensitiveData(c.old_value),
        new_value: maskSensitiveData(c.new_value)
      })),
      failed_tasks: failedTasks,
      sensitive_field_changes: sensitiveChanges.map(c => ({
        ...c,
        old_value: maskSensitiveData(c.old_value),
        new_value: maskSensitiveData(c.new_value)
      }))
    };
  }

  static getTaskDestination(task) {
    switch (task.fail_type) {
      case FAIL_TYPES.WAITING_RETRY:
        return '等待系统自动重试';
      case FAIL_TYPES.WAITING_MANUAL:
        return '等待人工处理';
      case FAIL_TYPES.PERMANENT:
        return '已标记为永久失败，需新建工单';
      default:
        return '处理中';
    }
  }

  static getTechnicianView(technicianId, filters = {}) {
    const orders = db.query('work_orders', o => o.assignee_id === technicianId);
    const pending = orders.filter(o => 
      [ORDER_STATUS.ASSIGNED, ORDER_STATUS.IN_PROGRESS].includes(o.status)
    );
    const completed = orders.filter(o => o.status === ORDER_STATUS.COMPLETED);
    
    return {
      technician_id: technicianId,
      total_assigned: orders.length,
      pending_tasks: pending.length,
      completed_tasks: completed.length,
      pending_orders: pending,
      recent_completed: completed.slice(-10).reverse()
    };
  }

  static getAuditorView(filters = {}) {
    const audits = db.findAll('audit_logs');
    const transitions = db.findAll('status_transitions');
    
    return {
      total_audits: audits.length,
      total_transitions: transitions.length,
      recent_audits: audits.slice(-30).reverse(),
      recent_transitions: transitions.slice(-30).reverse()
    };
  }

  static getChangeHistory(orderId) {
    const transitions = db.findAll('status_transitions', { order_id: orderId });
    const audits = db.findAll('audit_logs', { order_id: orderId });
    
    const history = [
      ...transitions.map(t => ({
        type: 'status_change',
        timestamp: t.created_at,
        operator: t.operator_name,
        description: `状态从 ${t.from_status || '(初始)'} 变为 ${t.to_status}`,
        reason: t.reason,
        remark: t.remark
      })),
      ...audits.map(a => ({
        type: 'field_change',
        timestamp: a.created_at,
        operator: a.changed_by_name,
        description: `修改字段 ${a.field_name}`,
        reason: a.change_reason,
        old_value: a.old_value,
        new_value: a.new_value
      }))
    ];
    
    return history.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  }

  static exportOrders(filters = {}, options = {}) {
    let orders = db.findAll('work_orders');
    
    if (filters.status) {
      orders = orders.filter(o => o.status === filters.status);
    }
    
    const fields = [
      'id', 'order_no', 'batch_id', 'resident_name', 'resident_phone',
      'building', 'unit', 'room', 'repair_type', 'description',
      'status', 'assignee_name', 'priority', 'actual_cost',
      'created_at', 'created_by_name'
    ];
    
    let data = orders.map(o => {
      const record = {};
      fields.forEach(f => record[f] = o[f]);
      if (options.desensitized) {
        record.resident_name = maskSensitiveData(record.resident_name);
        record.resident_phone = maskSensitiveData(record.resident_phone);
      }
      return record;
    });
    
    try {
      const parser = new Parser({ fields });
      return {
        total: data.length,
        desensitized: options.desensitized || false,
        csv_data: parser.parse(data),
        data: data
      };
    } catch (err) {
      return { total: data.length, data: data };
    }
  }

  static exportFailedItems(filters = {}) {
    const failed = db.query('async_tasks', t => t.status === TASK_STATUS.FAILED);
    
    return {
      total: failed.length,
      by_type: {
        waiting_retry: failed.filter(t => t.fail_type === FAIL_TYPES.WAITING_RETRY).length,
        waiting_manual: failed.filter(t => t.fail_type === FAIL_TYPES.WAITING_MANUAL).length,
        permanent: failed.filter(t => t.fail_type === FAIL_TYPES.PERMANENT).length
      },
      items: failed.map(t => ({
        id: t.id,
        task_type: t.task_type,
        related_type: t.related_type,
        related_id: t.related_id,
        fail_type: t.fail_type,
        last_error: t.last_error,
        retry_count: t.retry_count,
        max_retries: t.max_retries,
        destination: this.getTaskDestination(t),
        created_at: t.created_at
      }))
    };
  }

  static exportBatch(batchId, options = {}) {
    const batch = db.findById('batches', batchId);
    if (!batch) throw new Error('批次不存在');
    
    const orders = db.findAll('work_orders', { batch_id: batchId });
    const evidences = db.findAll('evidences', { batch_id: batchId });
    
    const exportDir = path.join(__dirname, '../../exports');
    if (!fs.existsSync(exportDir)) {
      fs.mkdirSync(exportDir, { recursive: true });
    }
    
    const filePath = path.join(exportDir, `batch_${batchId}.json`);
    fs.writeFileSync(filePath, JSON.stringify({
      batch,
      orders: options.desensitized ? orders.map(maskSensitiveData) : orders,
      evidences
    }, null, 2), 'utf8');
    
    return filePath;
  }
}

module.exports = ReportService;

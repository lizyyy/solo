const database = require('../database');
const { generateId, now, AuditLog } = require('../utils');

class RepairOrderService {
  createOrder(data, operator = 'system') {
    const { product_sn, product_name, repair_type, description } = data;
    
    if (!product_sn || !product_name || !repair_type) {
      throw new Error('产品序列号、产品名称和返修类型不能为空');
    }

    const id = generateId();
    const nowTime = now();

    return database.runTransaction(() => {
      const stmt = database.prepare(`
        INSERT INTO repair_orders 
        (id, product_sn, product_name, repair_type, description, status, created_at, updated_at, version)
        VALUES (?, ?, ?, ?, ?, 'PENDING', ?, ?, 1)
      `);
      stmt.run(id, product_sn, product_name, repair_type, description || null, nowTime, nowTime);

      AuditLog.log('REPAIR_ORDER', 'CREATE', id, operator, {
        product_sn,
        product_name,
        repair_type
      });

      return this.getOrder(id);
    });
  }

  getOrder(id) {
    const order = database.prepare('SELECT * FROM repair_orders WHERE id = ?').get(id);
    if (!order) return null;
    
    const freezes = database.prepare('SELECT * FROM liability_freezes WHERE repair_order_id = ? ORDER BY frozen_at DESC').all(id);
    const evidences = database.prepare('SELECT * FROM evidence_attachments WHERE repair_order_id = ? ORDER BY uploaded_at DESC').all(id);
    const rejudges = database.prepare('SELECT * FROM rejudge_records WHERE repair_order_id = ? ORDER BY operated_at DESC').all(id);
    const costs = database.prepare('SELECT * FROM cost_records WHERE repair_order_id = ? ORDER BY recorded_at DESC').all(id);
    const logs = AuditLog.getLogs(id, 20);

    return {
      ...order,
      freezes,
      evidences,
      rejudges,
      costs,
      operation_logs: logs
    };
  }

  listOrders(filter = {}) {
    let sql = 'SELECT * FROM repair_orders WHERE 1=1';
    const params = [];

    if (filter.status) {
      sql += ' AND status = ?';
      params.push(filter.status);
    }
    if (filter.product_sn) {
      sql += ' AND product_sn LIKE ?';
      params.push(`%${filter.product_sn}%`);
    }
    if (filter.current_responsibility) {
      sql += ' AND current_responsibility = ?';
      params.push(filter.current_responsibility);
    }

    sql += ' ORDER BY created_at DESC';
    let results = database.prepare(sql).all(...params);
    
    const offset = filter.offset || 0;
    const limit = filter.limit || 20;
    return results.slice(offset, offset + limit);
  }

  updateOrderStatus(id, status, operator = 'system') {
    return database.runTransaction(() => {
      const existing = database.prepare('SELECT * FROM repair_orders WHERE id = ?').get(id);
      if (!existing) {
        throw new Error('返修单不存在');
      }

      const stmt = database.prepare(`
        UPDATE repair_orders 
        SET status = ?, updated_at = ?, version = version + 1
        WHERE id = ?
      `);
      stmt.run(status, now(), id);

      AuditLog.log('REPAIR_ORDER', 'UPDATE_STATUS', id, operator, {
        from_status: existing.status,
        to_status: status
      });

      return this.getOrder(id);
    });
  }

  deleteOrder(id, operator = 'system') {
    return database.runTransaction(() => {
      const order = this.getOrder(id);
      if (!order) {
        throw new Error('返修单不存在');
      }

      database.prepare('DELETE FROM evidence_attachments WHERE repair_order_id = ?').run(id);
      database.prepare('DELETE FROM rejudge_records WHERE repair_order_id = ?').run(id);
      database.prepare('DELETE FROM cost_records WHERE repair_order_id = ?').run(id);
      database.prepare('DELETE FROM liability_freezes WHERE repair_order_id = ?').run(id);
      database.prepare('DELETE FROM repair_orders WHERE id = ?').run(id);

      AuditLog.log('REPAIR_ORDER', 'DELETE', id, operator, {
        product_sn: order.product_sn
      });

      return { success: true, message: '返修单已删除' };
    });
  }
}

module.exports = new RepairOrderService();

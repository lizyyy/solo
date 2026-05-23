const db = require('../config/database');

function dbRun(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) {
        reject(err);
      } else {
        resolve({ lastID: this.lastID, changes: this.changes });
      }
    });
  });
}

function dbGet(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) {
        reject(err);
      } else {
        resolve(row);
      }
    });
  });
}

function dbAll(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) {
        reject(err);
      } else {
        resolve(rows);
      }
    });
  });
}

const TIMEOUT_HOURS = {
  urgent: 2,
  normal: 24,
  low: 72
};

class RepairOrderService {
  generateOrderNo() {
    const date = new Date();
    const prefix = `BX${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    return `${prefix}${random}`;
  }

  calculateExpectedCompletion(priority, reportedAt) {
    const hours = TIMEOUT_HOURS[priority] || TIMEOUT_HOURS.normal;
    const expected = new Date(reportedAt);
    expected.setHours(expected.getHours() + hours);
    return expected;
  }

  checkTimeout(expectedCompletionAt) {
    return new Date() > new Date(expectedCompletionAt);
  }

  async findDuplicateOrder(roomId, repairType, description) {
    const sql = `
      SELECT * FROM repair_orders 
      WHERE room_id = ? AND repair_type = ? AND status NOT IN ('completed', 'cancelled')
      AND reported_at >= datetime('now', '-24 hours')
      ORDER BY reported_at DESC
      LIMIT 1
    `;
    return await dbGet(sql, [roomId, repairType]);
  }

  async createOrder(orderData) {
    const { buildingNo, roomNo, repairType, description, priority, reportedBy, reportedPhone } = orderData;

    const building = await dbGet('SELECT id FROM buildings WHERE building_no = ?', [buildingNo]);
    if (!building) {
      throw new Error('楼栋不存在');
    }

    const room = await dbGet('SELECT id FROM rooms WHERE building_id = ? AND room_no = ?', [building.id, roomNo]);
    if (!room) {
      throw new Error('房号不存在');
    }

    const duplicateOrder = await this.findDuplicateOrder(room.id, repairType, description);
    const orderNo = this.generateOrderNo();
    const reportedAt = new Date().toISOString();
    const expectedCompletionAt = this.calculateExpectedCompletion(priority || 'normal', reportedAt);

    if (duplicateOrder) {
      return await this.handleDuplicateOrder(duplicateOrder, orderData);
    }

    await dbRun('BEGIN TRANSACTION');
    const result = await dbRun(
      `INSERT INTO repair_orders 
       (order_no, room_id, repair_type, description, priority, reported_by, reported_phone, reported_at, expected_completion_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [orderNo, room.id, repairType, description, priority || 'normal', reportedBy, reportedPhone, reportedAt, expectedCompletionAt.toISOString()]
    );

    const orderId = result.lastID;

    await dbRun(
      'INSERT INTO status_history (repair_order_id, new_status, change_reason) VALUES (?, ?, ?)',
      [orderId, 'pending', '创建报修单']
    );

    await dbRun('COMMIT');

    return await this.getOrderById(orderId);
  }

  async handleDuplicateOrder(existingOrder, newOrderData) {
    await dbRun('BEGIN TRANSACTION');

    await dbRun(
      `INSERT INTO reminder_records 
       (repair_order_id, reminder_type, reminder_content, reminded_by, is_duplicate, merged_to)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [existingOrder.id, 'repeat', newOrderData.description, newOrderData.reportedBy, 1, existingOrder.id]
    );

    await dbRun(
      'UPDATE repair_orders SET priority = ? WHERE id = ?',
      ['urgent', existingOrder.id]
    );

    await dbRun('COMMIT');

    return {
      isDuplicate: true,
      mergedTo: existingOrder.order_no,
      message: '该报修已存在，已合并到原有工单，优先级已提升'
    };
  }

  async getOrderById(id) {
    const sql = `
      SELECT ro.*, b.building_no, r.room_no, r.owner_name, h.name as handler_name
      FROM repair_orders ro
      JOIN rooms r ON ro.room_id = r.id
      JOIN buildings b ON r.building_id = b.id
      LEFT JOIN handlers h ON ro.handler_id = h.id
      WHERE ro.id = ?
    `;
    return await dbGet(sql, [id]);
  }

  async getOrders(filters = {}) {
    let sql = `
      SELECT ro.*, b.building_no, r.room_no, r.owner_name, h.name as handler_name,
             CASE WHEN ro.expected_completion_at < datetime('now') AND ro.status NOT IN ('completed', 'cancelled') THEN 1 ELSE 0 END as current_timeout
      FROM repair_orders ro
      JOIN rooms r ON ro.room_id = r.id
      JOIN buildings b ON r.building_id = b.id
      LEFT JOIN handlers h ON ro.handler_id = h.id
      WHERE 1=1
    `;
    const params = [];

    if (filters.status) {
      sql += ' AND ro.status = ?';
      params.push(filters.status);
    }
    if (filters.isTimeout) {
      sql += ' AND (ro.is_timeout = 1 OR (ro.expected_completion_at < datetime(\'now\') AND ro.status NOT IN (\'completed\', \'cancelled\')))';
    }
    if (filters.buildingNo) {
      sql += ' AND b.building_no = ?';
      params.push(filters.buildingNo);
    }
    if (filters.repairType) {
      sql += ' AND ro.repair_type = ?';
      params.push(filters.repairType);
    }
    if (filters.isOutsourced) {
      sql += ' AND EXISTS (SELECT 1 FROM outsource_assignments oa WHERE oa.repair_order_id = ro.id)';
    }

    sql += ' ORDER BY ro.created_at DESC';

    const orders = await dbAll(sql, params);

    for (const order of orders) {
      if (order.current_timeout && !order.is_timeout && order.status !== 'completed' && order.status !== 'cancelled') {
        await dbRun('UPDATE repair_orders SET is_timeout = 1 WHERE id = ?', [order.id]);
        order.is_timeout = 1;
      }
    }

    return orders;
  }

  async updateStatus(orderId, newStatus, changeReason, changedBy) {
    const order = await this.getOrderById(orderId);
    if (!order) {
      throw new Error('报修单不存在');
    }

    const validTransitions = {
      pending: ['assigned', 'processing', 'cancelled'],
      assigned: ['processing', 'outsourced', 'cancelled'],
      processing: ['completed', 'cancelled'],
      outsourced: ['completed', 'cancelled'],
      completed: ['verified'],
      verified: []
    };

    if (!validTransitions[order.status]?.includes(newStatus)) {
      throw new Error(`无效的状态流转: ${order.status} -> ${newStatus}`);
    }

    await dbRun('BEGIN TRANSACTION');

    await dbRun(
      'UPDATE repair_orders SET status = ? WHERE id = ?',
      [newStatus, orderId]
    );

    await dbRun(
      'INSERT INTO status_history (repair_order_id, old_status, new_status, changed_by, change_reason) VALUES (?, ?, ?, ?, ?)',
      [orderId, order.status, newStatus, changedBy, changeReason]
    );

    if (newStatus === 'completed') {
      await dbRun(
        'UPDATE repair_orders SET completed_at = datetime(\'now\') WHERE id = ?',
        [orderId]
      );
    }

    await dbRun('COMMIT');

    return await this.getOrderById(orderId);
  }

  async assignHandler(orderId, handlerId) {
    const order = await this.getOrderById(orderId);
    if (!order) {
      throw new Error('报修单不存在');
    }

    await dbRun('BEGIN TRANSACTION');

    await dbRun(
      'UPDATE repair_orders SET handler_id = ?, status = ? WHERE id = ?',
      [handlerId, 'assigned', orderId]
    );

    await dbRun(
      'INSERT INTO status_history (repair_order_id, old_status, new_status, change_reason) VALUES (?, ?, ?, ?)',
      [orderId, order.status, 'assigned', '分配处理人']
    );

    await dbRun('COMMIT');

    return await this.getOrderById(orderId);
  }

  async assignOutsource(orderId, outsourceData) {
    const { outsourceCompany, outsourceContact, outsourcePhone, promisedCompletionAt, cost } = outsourceData;

    await dbRun('BEGIN TRANSACTION');

    await dbRun(
      `INSERT INTO outsource_assignments 
       (repair_order_id, outsource_company, outsource_contact, outsource_phone, promised_completion_at, cost)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [orderId, outsourceCompany, outsourceContact, outsourcePhone, promisedCompletionAt, cost]
    );

    await dbRun(
      'UPDATE repair_orders SET status = ? WHERE id = ?',
      ['outsourced', orderId]
    );

    await dbRun(
      'INSERT INTO status_history (repair_order_id, old_status, new_status, change_reason) VALUES (?, ?, ?, ?)',
      [orderId, 'pending', 'outsourced', '转外包处理']
    );

    await dbRun('COMMIT');

    return await this.getOrderById(orderId);
  }

  async getStatusHistory(orderId) {
    const sql = `
      SELECT sh.*, h.name as changed_by_name
      FROM status_history sh
      LEFT JOIN handlers h ON sh.changed_by = h.id
      WHERE sh.repair_order_id = ?
      ORDER BY sh.changed_at ASC
    `;
    return await dbAll(sql, [orderId]);
  }

  async getOutsourceInfo(orderId) {
    const sql = `
      SELECT * FROM outsource_assignments
      WHERE repair_order_id = ?
      ORDER BY assigned_at DESC
      LIMIT 1
    `;
    return await dbGet(sql, [orderId]);
  }

  async submitCompletionProof(orderId, proofData) {
    const order = await this.getOrderById(orderId);
    if (!order) {
      throw new Error('报修单不存在');
    }

    const { proofType, proofContent, submittedBy } = proofData;

    await dbRun('BEGIN TRANSACTION');

    await dbRun(
      `INSERT INTO completion_proofs 
       (repair_order_id, proof_type, proof_content, created_at)
       VALUES (?, ?, ?, datetime('now'))`,
      [orderId, proofType, proofContent]
    );

    if (order.status !== 'completed') {
      await dbRun(
        'UPDATE repair_orders SET status = ?, completed_at = datetime(\'now\') WHERE id = ?',
        ['completed', orderId]
      );

      await dbRun(
        'INSERT INTO status_history (repair_order_id, old_status, new_status, changed_by, change_reason) VALUES (?, ?, ?, ?, ?)',
        [orderId, order.status, 'completed', submittedBy, '提交完工证明，工单完成']
      );
    }

    await dbRun('COMMIT');

    return await this.getOrderById(orderId);
  }

  async getCompletionProofs(orderId) {
    const sql = `
      SELECT cp.*, h.name as verified_by_name
      FROM completion_proofs cp
      LEFT JOIN handlers h ON cp.verified_by = h.id
      WHERE cp.repair_order_id = ?
      ORDER BY cp.created_at DESC
    `;
    return await dbAll(sql, [orderId]);
  }

  async verifyCompletion(orderId, proofId, verifiedBy, isVerified, verifyRemark) {
    const order = await this.getOrderById(orderId);
    if (!order) {
      throw new Error('报修单不存在');
    }

    if (order.status !== 'completed') {
      throw new Error('只有已完成的工单才能复核');
    }

    const proof = await dbGet('SELECT * FROM completion_proofs WHERE id = ? AND repair_order_id = ?', [proofId, orderId]);
    if (!proof) {
      throw new Error('完工证明不存在');
    }

    if (proof.is_verified) {
      throw new Error('该完工证明已复核');
    }

    await dbRun('BEGIN TRANSACTION');

    await dbRun(
      'UPDATE completion_proofs SET is_verified = ?, verified_by = ?, verified_at = datetime(\'now\') WHERE id = ?',
      [isVerified ? 1 : 0, verifiedBy, proofId]
    );

    if (isVerified) {
      await dbRun(
        'UPDATE repair_orders SET status = ? WHERE id = ?',
        ['verified', orderId]
      );

      await dbRun(
        'INSERT INTO status_history (repair_order_id, old_status, new_status, changed_by, change_reason) VALUES (?, ?, ?, ?, ?)',
        [orderId, 'completed', 'verified', verifiedBy, '完工复核通过']
      );
    }

    await dbRun('COMMIT');

    return await this.getOrderById(orderId);
  }

  async manualCorrect(orderId, updateData, correctedBy) {
    const order = await this.getOrderById(orderId);
    if (!order) {
      throw new Error('报修单不存在');
    }

    const allowedFields = ['repair_type', 'description', 'priority', 'status', 'handler_id'];
    const updates = [];
    const values = [];

    for (const field of allowedFields) {
      if (updateData[field] !== undefined) {
        updates.push(`${field} = ?`);
        values.push(updateData[field]);
      }
    }

    if (updates.length === 0) {
      throw new Error('没有需要更新的字段');
    }

    values.push(orderId);

    await dbRun('BEGIN TRANSACTION');

    await dbRun(
      `UPDATE repair_orders SET ${updates.join(', ')} WHERE id = ?`,
      values
    );

    await dbRun(
      'INSERT INTO status_history (repair_order_id, old_status, new_status, changed_by, change_reason) VALUES (?, ?, ?, ?, ?)',
      [orderId, order.status, updateData.status || order.status, correctedBy, '人工修正']
    );

    await dbRun('COMMIT');

    return await this.getOrderById(orderId);
  }

  async recordException(originalInput, exceptionType, handlingResult, repairOrderId) {
    return await dbRun(
      `INSERT INTO exception_records 
       (original_input, exception_type, handling_result, repair_order_id)
       VALUES (?, ?, ?, ?)`,
      [JSON.stringify(originalInput), exceptionType, handlingResult, repairOrderId]
    );
  }

  async getExceptions() {
    return await dbAll('SELECT * FROM exception_records ORDER BY created_at DESC');
  }

  async exportReport(filters = {}) {
    const orders = await this.getOrders(filters);
    
    const exportData = [];
    
    for (const order of orders) {
      const statusHistory = await this.getStatusHistory(order.id);
      const outsourceInfo = await this.getOutsourceInfo(order.id);
      const proofs = await this.getCompletionProofs(order.id);
      
      exportData.push({
        工单编号: order.order_no,
        楼栋: order.building_no,
        房号: order.room_no,
        业主姓名: order.owner_name,
        报修类型: order.repair_type,
        描述: order.description,
        优先级: order.priority,
        状态: order.status,
        处理人: order.handler_name,
        报修人: order.reported_by,
        报修时间: order.reported_at,
        预计完成时间: order.expected_completion_at,
        实际完成时间: order.completed_at,
        是否超时: order.is_timeout ? '是' : '否',
        是否已外包: outsourceInfo ? '是' : '否',
        外包公司: outsourceInfo?.outsource_company || '',
        完工证明数量: proofs.length,
        是否已复核: order.status === 'verified' ? '是' : '否',
        状态变更次数: statusHistory.length
      });
    }

    return exportData;
  }
}

module.exports = new RepairOrderService();

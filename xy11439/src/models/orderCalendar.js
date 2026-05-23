const { v4: uuidv4 } = require('uuid');
const dayjs = require('dayjs');
const { getDatabase } = require('../database');
const config = require('../config');
const { recordChanges } = require('../utils/audit');

const TABLE_NAME = 'order_calendars';

function createOrderCalendar(data, operator, batchId = null) {
  const db = getDatabase();
  
  const order = {
    id: uuidv4(),
    batch_id: batchId,
    order_no: data.order_no,
    room_no: data.room_no,
    guest_name: data.guest_name || null,
    guest_phone: data.guest_phone || null,
    guest_id_card: data.guest_id_card || null,
    check_in_date: dayjs(data.check_in_date).valueOf(),
    check_out_date: dayjs(data.check_out_date).valueOf(),
    is_extended: data.is_extended ? 1 : 0,
    linen_change_required: data.linen_change_required !== false ? 1 : 0,
    cleaning_type: data.cleaning_type || 'normal',
    cleaning_time: data.cleaning_time || null,
    room_password: data.room_password || null,
    status: data.status || 'active',
    workflow_status: data.workflow_status || config.workflow.DRAFT,
    is_conflict: data.is_conflict ? 1 : 0,
    conflict_reason: data.conflict_reason || null,
    is_missed: data.is_missed ? 1 : 0,
    missed_reason: data.missed_reason || null,
    operator_id: operator.id,
    operator_name: operator.name,
    created_at: dayjs().valueOf(),
    updated_at: dayjs().valueOf(),
  };

  const stmt = db.prepare(`
    INSERT INTO order_calendars (
      id, batch_id, order_no, room_no, guest_name, guest_phone, guest_id_card,
      check_in_date, check_out_date, is_extended, linen_change_required,
      cleaning_type, cleaning_time, room_password, status, workflow_status,
      is_conflict, conflict_reason, is_missed, missed_reason,
      operator_id, operator_name, created_at, updated_at
    ) VALUES (
      @id, @batch_id, @order_no, @room_no, @guest_name, @guest_phone, @guest_id_card,
      @check_in_date, @check_out_date, @is_extended, @linen_change_required,
      @cleaning_type, @cleaning_time, @room_password, @status, @workflow_status,
      @is_conflict, @conflict_reason, @is_missed, @missed_reason,
      @operator_id, @operator_name, @created_at, @updated_at
    )
  `);

  stmt.run(order);
  
  recordChanges(TABLE_NAME, order.id, null, order, operator, '创建订单', batchId, ['id', 'created_at', 'updated_at']);
  
  return order;
}

function findExistingOrder(orderNo, roomNo, checkInDate) {
  const db = getDatabase();
  
  const checkInTs = dayjs(checkInDate).valueOf();
  
  const stmt = db.prepare(`
    SELECT * FROM order_calendars
    WHERE order_no = ? OR (room_no = ? AND check_in_date = ?)
    LIMIT 1
  `);

  return stmt.get(orderNo, roomNo, checkInTs);
}

function updateOrderCalendar(id, data, operator, changeReason = '更新订单', batchId = null) {
  const db = getDatabase();
  
  const oldOrder = getOrderCalendarById(id);
  if (!oldOrder) {
    throw new Error('订单不存在');
  }

  const updateData = {
    ...data,
    updated_at: dayjs().valueOf(),
    operator_id: operator.id,
    operator_name: operator.name,
  };

  if (data.check_in_date) {
    updateData.check_in_date = dayjs(data.check_in_date).valueOf();
  }
  if (data.check_out_date) {
    updateData.check_out_date = dayjs(data.check_out_date).valueOf();
  }

  const fields = Object.keys(updateData);
  const setClauses = fields.map(f => `${f} = ?`).join(', ');
  const values = [...fields.map(f => updateData[f]), id];

  const stmt = db.prepare(`UPDATE order_calendars SET ${setClauses} WHERE id = ?`);
  stmt.run(...values);

  const newOrder = getOrderCalendarById(id);
  recordChanges(TABLE_NAME, id, oldOrder, newOrder, operator, changeReason, batchId, ['updated_at']);

  return newOrder;
}

function getOrderCalendarById(id) {
  const db = getDatabase();
  
  const stmt = db.prepare('SELECT * FROM order_calendars WHERE id = ?');
  const order = stmt.get(id);
  
  if (order) {
    order.check_in_date = dayjs(order.check_in_date).format('YYYY-MM-DD');
    order.check_out_date = dayjs(order.check_out_date).format('YYYY-MM-DD');
    order.created_at = dayjs(order.created_at).format('YYYY-MM-DD HH:mm:ss');
    order.updated_at = dayjs(order.updated_at).format('YYYY-MM-DD HH:mm:ss');
  }
  
  return order;
}

function getOrderCalendarList(filters = {}) {
  const db = getDatabase();
  let sql = 'SELECT * FROM order_calendars WHERE 1=1';
  const params = [];

  if (filters.room_no) {
    sql += ' AND room_no = ?';
    params.push(filters.room_no);
  }
  if (filters.start_date) {
    sql += ' AND check_out_date >= ?';
    params.push(dayjs(filters.start_date).valueOf());
  }
  if (filters.end_date) {
    sql += ' AND check_in_date <= ?';
    params.push(dayjs(filters.end_date).valueOf());
  }
  if (filters.workflow_status) {
    sql += ' AND workflow_status = ?';
    params.push(filters.workflow_status);
  }
  if (filters.is_conflict) {
    sql += ' AND is_conflict = 1';
  }
  if (filters.is_missed) {
    sql += ' AND is_missed = 1';
  }

  sql += ' ORDER BY check_in_date DESC LIMIT ? OFFSET ?';
  params.push(filters.limit || 50, filters.offset || 0);

  const stmt = db.prepare(sql);
  const orders = stmt.all(...params);

  return orders.map(order => ({
    ...order,
    check_in_date: dayjs(order.check_in_date).format('YYYY-MM-DD'),
    check_out_date: dayjs(order.check_out_date).format('YYYY-MM-DD'),
    created_at: dayjs(order.created_at).format('YYYY-MM-DD HH:mm:ss'),
    updated_at: dayjs(order.updated_at).format('YYYY-MM-DD HH:mm:ss'),
  }));
}

function updateWorkflowStatus(id, newStatus, operator, remark = null) {
  return updateOrderCalendar(id, { workflow_status: newStatus }, operator, remark || `状态变更为${newStatus}`);
}

function detectConflicts() {
  const db = getDatabase();
  
  const stmt = db.prepare(`
    SELECT o1.*, o2.id as conflict_order_id, o2.order_no as conflict_order_no
    FROM order_calendars o1
    INNER JOIN order_calendars o2 ON o1.room_no = o2.room_no
    WHERE o1.id != o2.id
      AND o1.check_in_date < o2.check_out_date
      AND o1.check_out_date > o2.check_in_date
      AND o1.status = 'active'
      AND o2.status = 'active'
  `);

  const conflicts = stmt.all();
  
  return conflicts.map(c => ({
    room_no: c.room_no,
    order1: {
      id: c.id,
      order_no: c.order_no,
      check_in: dayjs(c.check_in_date).format('YYYY-MM-DD'),
      check_out: dayjs(c.check_out_date).format('YYYY-MM-DD'),
    },
    order2: {
      id: c.conflict_order_id,
      order_no: c.conflict_order_no,
    },
  }));
}

function batchImportOrders(orders, operator, mergeStrategy = config.mergeStrategy.APPEND) {
  const results = {
    total: orders.length,
    success: 0,
    failed: 0,
    skipped: 0,
    errors: [],
  };

  for (let i = 0; i < orders.length; i++) {
    try {
      const orderData = orders[i];
      const existing = findExistingOrder(orderData.order_no, orderData.room_no, orderData.check_in_date);

      if (existing) {
        if (mergeStrategy === config.mergeStrategy.IGNORE) {
          results.skipped++;
          continue;
        } else if (mergeStrategy === config.mergeStrategy.OVERWRITE) {
          updateOrderCalendar(existing.id, orderData, operator, '批量导入-覆盖');
          results.success++;
        } else {
          createOrderCalendar(orderData, operator);
          results.success++;
        }
      } else {
        createOrderCalendar(orderData, operator);
        results.success++;
      }
    } catch (err) {
      results.failed++;
      results.errors.push({ index: i, error: err.message, data: orders[i] });
    }
  }

  return results;
}

module.exports = {
  createOrderCalendar,
  updateOrderCalendar,
  getOrderCalendarById,
  getOrderCalendarList,
  updateWorkflowStatus,
  findExistingOrder,
  detectConflicts,
  batchImportOrders,
  TABLE_NAME,
};

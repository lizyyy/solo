const { v4: uuidv4 } = require('uuid');
const db = require('./database');

/**
 * 派工单数据模型
 */

// 派工单状态常量
const WORK_ORDER_STATUSES = {
  CREATED: 'created',
  ASSIGNED: 'assigned',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled'
};

// 获取所有派工单
async function getAllWorkOrders() {
  return await db.allQuery(
    `SELECT wo.*, rm.recall_id, rm.equipment_id, rm.batch_number,
            r.recall_code, r.manufacturer, r.recall_reason,
            e.equipment_code, e.equipment_type, e.model, e.location
     FROM work_orders wo
     LEFT JOIN recall_matches rm ON wo.recall_match_id = rm.id
     LEFT JOIN recalls r ON rm.recall_id = r.id
     LEFT JOIN equipment e ON rm.equipment_id = e.id
     ORDER BY wo.created_at DESC`
  );
}

// 根据ID获取派工单
async function getWorkOrderById(id) {
  return await db.getQuery(
    `SELECT wo.*, rm.recall_id, rm.equipment_id, rm.batch_number,
            r.recall_code, r.manufacturer, r.recall_reason,
            e.equipment_code, e.equipment_type, e.model, e.location
     FROM work_orders wo
     LEFT JOIN recall_matches rm ON wo.recall_match_id = rm.id
     LEFT JOIN recalls r ON rm.recall_id = r.id
     LEFT JOIN equipment e ON rm.equipment_id = e.id
     WHERE wo.id = ?`,
    [id]
  );
}

// 根据召回匹配ID获取派工单
async function getWorkOrdersByRecallMatchId(recallMatchId) {
  return await db.allQuery(
    `SELECT * FROM work_orders WHERE recall_match_id = ? ORDER BY created_at DESC`,
    [recallMatchId]
  );
}

// 根据状态获取派工单
async function getWorkOrdersByStatus(status) {
  return await db.allQuery(
    `SELECT wo.*, rm.recall_id, rm.equipment_id, rm.batch_number,
            r.recall_code, r.manufacturer, r.recall_reason,
            e.equipment_code, e.equipment_type, e.model, e.location
     FROM work_orders wo
     LEFT JOIN recall_matches rm ON wo.recall_match_id = rm.id
     LEFT JOIN recalls r ON rm.recall_id = r.id
     LEFT JOIN equipment e ON rm.equipment_id = e.id
     WHERE wo.status = ?
     ORDER BY wo.created_at DESC`,
    [status]
  );
}

// 获取逾期派工单
async function getOverdueWorkOrders(currentDate = null) {
  const date = currentDate || new Date().toISOString().split('T')[0];
  return await db.allQuery(
    `SELECT wo.*, rm.recall_id, rm.equipment_id, rm.batch_number,
            r.recall_code, r.manufacturer, r.recall_reason,
            e.equipment_code, e.equipment_type, e.model, e.location
     FROM work_orders wo
     LEFT JOIN recall_matches rm ON wo.recall_match_id = rm.id
     LEFT JOIN recalls r ON rm.recall_id = r.id
     LEFT JOIN equipment e ON rm.equipment_id = e.id
     WHERE wo.status NOT IN ('completed', 'cancelled')
       AND wo.deadline_date < ?
     ORDER BY wo.deadline_date ASC`,
    [date]
  );
}

// 创建派工单
async function createWorkOrder(workOrderData) {
  const id = uuidv4();
  const now = new Date().toISOString();
  const today = now.split('T')[0];
  
  const {
    recall_match_id,
    order_code,
    assigned_to = null,
    assigned_date = assigned_to ? today : null,
    deadline_date,
    status = WORK_ORDER_STATUSES.CREATED,
    actual_completion_date = null,
    notes = null
  } = workOrderData;

  // 生成订单编号（如果未提供）
  const finalOrderCode = order_code || `WO-${today.replace(/-/g, '')}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

  await db.runQuery(
    `INSERT INTO work_orders (
      id, recall_match_id, order_code, assigned_to, assigned_date,
      deadline_date, status, actual_completion_date, notes,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id, recall_match_id, finalOrderCode, assigned_to, assigned_date,
      deadline_date, status, actual_completion_date, notes,
      now, now
    ]
  );

  return await getWorkOrderById(id);
}

// 批量创建派工单
async function batchCreateWorkOrders(workOrderList) {
  const results = [];
  for (const workOrder of workOrderList) {
    try {
      const created = await createWorkOrder(workOrder);
      results.push({ success: true, data: created });
    } catch (error) {
      results.push({ success: false, error: error.message, data: workOrder });
    }
  }
  return results;
}

// 更新派工单
async function updateWorkOrder(id, updateData) {
  const now = new Date().toISOString();
  
  const updates = [];
  const values = [];
  
  const allowedFields = [
    'recall_match_id', 'order_code', 'assigned_to', 'assigned_date',
    'deadline_date', 'status', 'actual_completion_date', 'notes'
  ];
  
  for (const [key, value] of Object.entries(updateData)) {
    if (allowedFields.includes(key) && value !== undefined) {
      updates.push(`${key} = ?`);
      values.push(value);
    }
  }
  
  if (updates.length === 0) {
    throw new Error('没有需要更新的字段');
  }
  
  updates.push('updated_at = ?');
  values.push(now);
  values.push(id);
  
  await db.runQuery(
    `UPDATE work_orders SET ${updates.join(', ')} WHERE id = ?`,
    values
  );
  
  return await getWorkOrderById(id);
}

// 分配派工单
async function assignWorkOrder(id, assignedTo, assignedDate = null) {
  const date = assignedDate || new Date().toISOString().split('T')[0];
  return await updateWorkOrder(id, {
    assigned_to: assignedTo,
    assigned_date: date,
    status: WORK_ORDER_STATUSES.ASSIGNED
  });
}

// 开始处理派工单
async function startWorkOrder(id) {
  return await updateWorkOrder(id, {
    status: WORK_ORDER_STATUSES.IN_PROGRESS
  });
}

// 完成派工单
async function completeWorkOrder(id, completionDate = null) {
  const date = completionDate || new Date().toISOString().split('T')[0];
  return await updateWorkOrder(id, {
    status: WORK_ORDER_STATUSES.COMPLETED,
    actual_completion_date: date
  });
}

// 取消派工单
async function cancelWorkOrder(id) {
  return await updateWorkOrder(id, {
    status: WORK_ORDER_STATUSES.CANCELLED
  });
}

// 删除派工单
async function deleteWorkOrder(id) {
  return await db.runQuery('DELETE FROM work_orders WHERE id = ?', [id]);
}

// 获取派工单统计信息
async function getWorkOrderStats() {
  const total = await db.getQuery('SELECT COUNT(*) as count FROM work_orders');
  const created = await db.getQuery(`SELECT COUNT(*) as count FROM work_orders WHERE status = '${WORK_ORDER_STATUSES.CREATED}'`);
  const assigned = await db.getQuery(`SELECT COUNT(*) as count FROM work_orders WHERE status = '${WORK_ORDER_STATUSES.ASSIGNED}'`);
  const inProgress = await db.getQuery(`SELECT COUNT(*) as count FROM work_orders WHERE status = '${WORK_ORDER_STATUSES.IN_PROGRESS}'`);
  const completed = await db.getQuery(`SELECT COUNT(*) as count FROM work_orders WHERE status = '${WORK_ORDER_STATUSES.COMPLETED}'`);
  const cancelled = await db.getQuery(`SELECT COUNT(*) as count FROM work_orders WHERE status = '${WORK_ORDER_STATUSES.CANCELLED}'`);
  
  return {
    total: total.count,
    created: created.count,
    assigned: assigned.count,
    inProgress: inProgress.count,
    completed: completed.count,
    cancelled: cancelled.count
  };
}

module.exports = {
  WORK_ORDER_STATUSES,
  getAllWorkOrders,
  getWorkOrderById,
  getWorkOrdersByRecallMatchId,
  getWorkOrdersByStatus,
  getOverdueWorkOrders,
  createWorkOrder,
  batchCreateWorkOrders,
  updateWorkOrder,
  assignWorkOrder,
  startWorkOrder,
  completeWorkOrder,
  cancelWorkOrder,
  deleteWorkOrder,
  getWorkOrderStats
};

const { query, queryOne, toBoolean } = require('../database');

function getPendingShipments() {
  const applications = query(
    `SELECT a.*, w.product_name, w.warranty_expire_date
     FROM part_applications a
     LEFT JOIN warranties w ON a.warranty_id = w.id
     WHERE a.status IN ('approved', 'inventory_locked')
     ORDER BY a.created_at ASC`
  );

  return { 
    success: true, 
    count: applications.length, 
    applications 
  };
}

function getPendingRecycling() {
  const applications = query(
    `SELECT a.*, w.product_name, w.warranty_expire_date
     FROM part_applications a
     LEFT JOIN warranties w ON a.warranty_id = w.id
     WHERE a.requires_recycling = 1 AND a.status = 'delivered'
     ORDER BY a.recycling_deadline ASC`
  );

  return { 
    success: true, 
    count: applications.length, 
    applications 
  };
}

function getPartsConsumption(startDate, endDate) {
  const params = [];
  let whereClause = "WHERE il.status = 'consumed'";

  if (startDate) {
    whereClause += ' AND il.created_at >= ?';
    params.push(startDate);
  }
  if (endDate) {
    whereClause += ' AND il.created_at <= ?';
    params.push(endDate);
  }

  const consumption = query(
    `SELECT 
      a.part_code,
      a.part_name,
      COUNT(*) as application_count,
      SUM(a.quantity) as total_quantity,
      SUM(CASE WHEN a.is_in_warranty = 1 THEN a.quantity ELSE 0 END) as warranty_quantity,
      SUM(CASE WHEN a.is_in_warranty = 0 THEN a.quantity ELSE 0 END) as out_warranty_quantity
    FROM part_applications a
    JOIN inventory_locks il ON a.id = il.application_id
    ${whereClause}
    GROUP BY a.part_code, a.part_name
    ORDER BY total_quantity DESC`,
    params
  );

  const total = consumption.reduce((sum, item) => sum + (item.total_quantity || 0), 0);

  return { 
    success: true, 
    total_quantity: total,
    consumption 
  };
}

function getAbnormalApplications() {
  const today = new Date().toISOString();

  const overdueRecycling = query(
    `SELECT a.*, 'overdue_recycling' as abnormal_type,
            '旧件回收已逾期' as abnormal_reason
     FROM part_applications a
     WHERE a.requires_recycling = 1 
       AND a.status = 'delivered'
       AND a.recycling_deadline < ?`,
    [today]
  );

  const stuckInReview = query(
    `SELECT a.*, 'stuck_in_review' as abnormal_type,
            '申请待审核超过3天' as abnormal_reason
     FROM part_applications a
     WHERE a.status = 'pending_review'
       AND a.created_at < datetime('now', '-3 days')`
  );

  const stuckInInventory = query(
    `SELECT a.*, 'stuck_in_inventory' as abnormal_type,
            '库存锁定后未发货超过2天' as abnormal_reason
     FROM part_applications a
     WHERE a.status = 'inventory_locked'
       AND a.created_at < datetime('now', '-2 days')`
  );

  const tryCloseWithoutRecycling = query(
    `SELECT a.*, 'close_attempt_no_recycling' as abnormal_type,
            '尝试关闭但旧件未回收' as abnormal_reason
     FROM part_applications a
     WHERE a.requires_recycling = 1
       AND a.status = 'delivered'
       AND a.id IN (
         SELECT application_id FROM status_logs 
         WHERE new_status = 'closed'
       )`
  );

  const abnormal = [
    ...overdueRecycling,
    ...stuckInReview,
    ...stuckInInventory,
    ...tryCloseWithoutRecycling
  ];

  return { 
    success: true, 
    count: abnormal.length,
    categories: {
      overdue_recycling: overdueRecycling.length,
      stuck_in_review: stuckInReview.length,
      stuck_in_inventory: stuckInInventory.length
    },
    applications: abnormal 
  };
}

function getOverdueTodos(onlyPending = true) {
  let whereClause = '';
  const params = [];

  if (onlyPending) {
    whereClause = 'WHERE is_handled = 0';
  }

  const todos = query(
    `SELECT t.*, a.application_no, a.part_name, a.customer_name, a.customer_phone
     FROM overdue_todos t
     JOIN part_applications a ON t.application_id = a.id
     ${whereClause}
     ORDER BY t.due_date ASC`,
    params
  );

  return { 
    success: true, 
    count: todos.length,
    todos 
  };
}

function getInventoryStatus() {
  const inventory = query(
    `SELECT 
      p.part_code,
      p.part_name,
      p.category,
      p.requires_recycling,
      i.quantity,
      i.locked_quantity,
      (i.quantity - i.locked_quantity) as available_quantity,
      i.warehouse
    FROM inventory i
    JOIN parts p ON i.part_id = p.id
    ORDER BY (i.quantity - i.locked_quantity) ASC`
  );

  const lowStock = inventory.filter(item => (item.quantity - item.locked_quantity) < 10);
  const outOfStock = inventory.filter(item => (item.quantity - item.locked_quantity) === 0);

  return {
    success: true,
    total_items: inventory.length,
    low_stock_count: lowStock.length,
    out_of_stock_count: outOfStock.length,
    inventory,
    low_stock: lowStock,
    out_of_stock: outOfStock
  };
}

function getWarrantyInfo(productSN) {
  const warranty = queryOne(
    'SELECT * FROM warranties WHERE product_sn = ?',
    [productSN]
  );

  if (!warranty) {
    return { success: false, error: '未找到产品保修记录' };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expireDate = new Date(warranty.warranty_expire_date);
  expireDate.setHours(0, 0, 0, 0);
  const isExpired = expireDate < today;

  const diffDays = Math.ceil((expireDate - today) / (1000 * 60 * 60 * 24));

  const history = query(
    'SELECT * FROM part_applications WHERE product_sn = ? ORDER BY created_at DESC',
    [productSN]
  );

  return {
    success: true,
    warranty: {
      ...warranty,
      is_expired: isExpired,
      days_remaining: diffDays
    },
    application_history: history
  };
}

module.exports = {
  getPendingShipments,
  getPendingRecycling,
  getPartsConsumption,
  getAbnormalApplications,
  getOverdueTodos,
  getInventoryStatus,
  getWarrantyInfo
};

const { query, queryOne, exec, runInsert, getNow, formatDate, toBoolean, transaction } = require('../database');
const validation = require('./validationService');

const STATUS_FLOW = {
  pending_review: ['approved', 'rejected'],
  approved: ['inventory_locked'],
  inventory_locked: ['shipped'],
  shipped: ['delivered'],
  delivered: ['old_part_received', 'closed'],
  old_part_received: ['closed'],
  rejected: [],
  closed: []
};

function generateApplicationNo() {
  const date = new Date();
  const prefix = 'AP' + date.getFullYear() + 
    String(date.getMonth() + 1).padStart(2, '0') + 
    String(date.getDate()).padStart(2, '0');
  
  const result = queryOne(
    'SELECT COUNT(*) as count FROM part_applications WHERE application_no LIKE ?',
    [prefix + '%']
  );
  const count = result ? result.count : 0;
  
  return prefix + String(count + 1).padStart(4, '0');
}

function logStatus(applicationId, oldStatus, newStatus, operator, remark) {
  runInsert(
    'INSERT INTO status_logs (application_id, old_status, new_status, operator, remark, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    [applicationId, oldStatus, newStatus, operator || 'system', remark, getNow()]
  );
}

function createApplication(data) {
  const validationResult = validation.validateApplicationCreate(data);
  if (!validationResult.valid) {
    return { success: false, error: validationResult.errors.join('; ') };
  }

  const part = queryOne('SELECT * FROM parts WHERE part_code = ?', [data.part_code]);
  if (!part) {
    return { success: false, error: '未找到配件信息' };
  }

  const warrantyCheck = validation.isWarrantyValid(data.product_sn);
  const isInWarranty = warrantyCheck.valid ? 1 : 0;
  const warrantyId = warrantyCheck.warranty ? warrantyCheck.warranty.id : null;

  const duplicateCheck = validation.isDuplicateFaultApplication(data.product_sn, data.fault_type);
  if (duplicateCheck.duplicate) {
    return { 
      success: false, 
      error: duplicateCheck.reason,
      warning: duplicateCheck.reason
    };
  }

  const applicationNo = generateApplicationNo();
  const requiresRecycling = toBoolean(part.requires_recycling);

  let recyclingDeadline = null;
  if (requiresRecycling) {
    const deadline = new Date();
    deadline.setDate(deadline.getDate() + (part.recycling_days || 14) + 30);
    recyclingDeadline = deadline.toISOString();
  }

  const result = runInsert(
    `INSERT INTO part_applications (
      application_no, warranty_id, product_sn, part_id, part_code, part_name,
      quantity, reason, fault_type, customer_name, customer_phone,
      shipping_address, shipping_city, is_in_warranty, requires_recycling,
      recycling_deadline, status, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      applicationNo, warrantyId, data.product_sn, part.id, part.part_code, part.part_name,
      data.quantity || 1, data.reason, data.fault_type,
      data.customer_name, data.customer_phone,
      data.shipping_address, data.shipping_city || null,
      isInWarranty, requiresRecycling, recyclingDeadline,
      'pending_review', getNow(), getNow()
    ]
  );

  const application = queryOne('SELECT * FROM part_applications WHERE id = ?', [result.lastInsertRowid]);
  
  logStatus(result.lastInsertRowid, null, 'pending_review', data.operator || 'system', '创建申请');

  return { 
    success: true, 
    application,
    warnings: isInWarranty ? [] : ['产品不在保修期内']
  };
}

function reviewApplication(applicationNo, approved, data = {}) {
  const application = queryOne('SELECT * FROM part_applications WHERE application_no = ?', [applicationNo]);
  if (!application) {
    return { success: false, error: '申请不存在' };
  }

  if (application.status !== 'pending_review') {
    return { success: false, error: '申请当前状态不可审核' };
  }

  if (approved) {
    const inventoryCheck = validation.hasEnoughInventory(application.part_id, application.quantity);
    if (!inventoryCheck.available) {
      return { success: false, error: inventoryCheck.reason };
    }

    exec(
      'UPDATE part_applications SET status = ?, review_comment = ?, updated_at = ? WHERE id = ?',
      ['approved', data.comment || '', getNow(), application.id]
    );

    logStatus(application.id, 'pending_review', 'approved', data.operator || 'system', data.comment || '审核通过');
  } else {
    exec(
      'UPDATE part_applications SET status = ?, reject_reason = ?, updated_at = ? WHERE id = ?',
      ['rejected', data.reason || '审核未通过', getNow(), application.id]
    );

    logStatus(application.id, 'pending_review', 'rejected', data.operator || 'system', data.reason || '审核未通过');
  }

  const updated = queryOne('SELECT * FROM part_applications WHERE id = ?', [application.id]);
  return { success: true, application: updated };
}

function lockInventory(applicationNo, data = {}) {
  const application = queryOne('SELECT * FROM part_applications WHERE application_no = ?', [applicationNo]);
  if (!application) {
    return { success: false, error: '申请不存在' };
  }

  if (application.status !== 'approved') {
    return { success: false, error: '申请当前状态不可锁定库存' };
  }

  const inventoryCheck = validation.hasEnoughInventory(application.part_id, application.quantity);
  if (!inventoryCheck.available) {
    return { success: false, error: inventoryCheck.reason };
  }

  const inventory = inventoryCheck.inventory;

  transaction(() => {
    exec(
      'UPDATE inventory SET locked_quantity = locked_quantity + ?, updated_at = ? WHERE id = ?',
      [application.quantity, getNow(), inventory.id]
    );

    runInsert(
      'INSERT INTO inventory_locks (application_id, inventory_id, quantity, status, created_at) VALUES (?, ?, ?, ?, ?)',
      [application.id, inventory.id, application.quantity, 'locked', getNow()]
    );

    exec(
      'UPDATE part_applications SET status = ?, updated_at = ? WHERE id = ?',
      ['inventory_locked', getNow(), application.id]
    );
  });

  logStatus(application.id, 'approved', 'inventory_locked', data.operator || 'system', '锁定库存');

  const updated = queryOne('SELECT * FROM part_applications WHERE id = ?', [application.id]);
  return { success: true, application: updated };
}

function shipApplication(applicationNo, data = {}) {
  const application = queryOne('SELECT * FROM part_applications WHERE application_no = ?', [applicationNo]);
  if (!application) {
    return { success: false, error: '申请不存在' };
  }

  if (application.status !== 'inventory_locked') {
    return { success: false, error: '申请当前状态不可发货' };
  }

  if (!data.logistics_company || !data.tracking_no) {
    return { success: false, error: '物流公司和运单号不能为空' };
  }

  const inventoryLock = queryOne(
    `SELECT il.*, i.part_id FROM inventory_locks il
     JOIN inventory i ON il.inventory_id = i.id
     WHERE il.application_id = ? AND il.status = 'locked'`,
    [application.id]
  );

  if (!inventoryLock) {
    return { success: false, error: '未找到锁定的库存记录' };
  }

  transaction(() => {
    exec(
      'UPDATE inventory SET quantity = quantity - ?, locked_quantity = locked_quantity - ?, updated_at = ? WHERE id = ?',
      [application.quantity, application.quantity, getNow(), inventoryLock.inventory_id]
    );

    exec(
      "UPDATE inventory_locks SET status = 'consumed' WHERE id = ?",
      [inventoryLock.id]
    );

    exec(
      'UPDATE part_applications SET status = ?, logistics_company = ?, tracking_no = ?, updated_at = ? WHERE id = ?',
      ['shipped', data.logistics_company, data.tracking_no, getNow(), application.id]
    );
  });

  logStatus(application.id, 'inventory_locked', 'shipped', data.operator || 'system', 
    `发货: ${data.logistics_company} ${data.tracking_no}`);

  const updated = queryOne('SELECT * FROM part_applications WHERE id = ?', [application.id]);
  return { success: true, application: updated };
}

function confirmDelivery(applicationNo, data = {}) {
  const application = queryOne('SELECT * FROM part_applications WHERE application_no = ?', [applicationNo]);
  if (!application) {
    return { success: false, error: '申请不存在' };
  }

  if (application.status !== 'shipped') {
    return { success: false, error: '申请当前状态不可签收' };
  }

  exec(
    'UPDATE part_applications SET status = ?, updated_at = ? WHERE id = ?',
    ['delivered', getNow(), application.id]
  );

  logStatus(application.id, 'shipped', 'delivered', data.operator || 'system', '确认签收');

  if (toBoolean(application.requires_recycling)) {
    const part = queryOne('SELECT * FROM parts WHERE id = ?', [application.part_id]);
    const deadline = new Date();
    deadline.setDate(deadline.getDate() + (part?.recycling_days || 14));

    exec(
      'UPDATE part_applications SET recycling_deadline = ? WHERE id = ?',
      [deadline.toISOString(), application.id]
    );

    runInsert(
      'INSERT INTO overdue_todos (application_id, todo_type, todo_description, due_date, created_at) VALUES (?, ?, ?, ?, ?)',
      [application.id, 'recycling', `回收旧件: ${application.part_name}`, deadline.toISOString(), getNow()]
    );
  }

  const updated = queryOne('SELECT * FROM part_applications WHERE id = ?', [application.id]);
  return { success: true, application: updated };
}

function receiveOldPart(applicationNo, data = {}) {
  const application = queryOne('SELECT * FROM part_applications WHERE application_no = ?', [applicationNo]);
  if (!application) {
    return { success: false, error: '申请不存在' };
  }

  if (!toBoolean(application.requires_recycling)) {
    return { success: false, error: '该申请不需要回收旧件' };
  }

  if (application.status !== 'delivered') {
    return { success: false, error: '申请当前状态不可记录旧件回收' };
  }

  if (!data.old_part_logistics_company || !data.old_part_tracking_no) {
    return { success: false, error: '旧件物流公司和运单号不能为空' };
  }

  exec(
    `UPDATE part_applications 
     SET status = ?, old_part_logistics_company = ?, old_part_tracking_no = ?, updated_at = ?
     WHERE id = ?`,
    ['old_part_received', data.old_part_logistics_company, data.old_part_tracking_no, getNow(), application.id]
  );

  exec(
    `UPDATE overdue_todos 
     SET is_handled = 1, handled_at = ?
     WHERE application_id = ? AND todo_type = 'recycling' AND is_handled = 0`,
    [getNow(), application.id]
  );

  logStatus(application.id, 'delivered', 'old_part_received', data.operator || 'system', 
    `旧件回收: ${data.old_part_logistics_company} ${data.old_part_tracking_no}`);

  const updated = queryOne('SELECT * FROM part_applications WHERE id = ?', [application.id]);
  return { success: true, application: updated };
}

function closeApplication(applicationNo, data = {}) {
  const application = queryOne('SELECT * FROM part_applications WHERE application_no = ?', [applicationNo]);
  if (!application) {
    return { success: false, error: '申请不存在' };
  }

  const closeCheck = validation.canCloseApplication(application);
  if (!closeCheck.canClose) {
    return { success: false, error: closeCheck.reason };
  }

  exec(
    'UPDATE part_applications SET status = ?, closed_at = ?, updated_at = ? WHERE id = ?',
    ['closed', getNow(), getNow(), application.id]
  );

  logStatus(application.id, application.status, 'closed', data.operator || 'system', data.remark || '关闭申请');

  const updated = queryOne('SELECT * FROM part_applications WHERE id = ?', [application.id]);
  return { success: true, application: updated };
}

function modifyShippingAddress(applicationNo, data = {}) {
  const application = queryOne('SELECT * FROM part_applications WHERE application_no = ?', [applicationNo]);
  if (!application) {
    return { success: false, error: '申请不存在' };
  }

  const modifyCheck = validation.canModifyShippingAddress(application);
  if (!modifyCheck.canModify) {
    return { success: false, error: modifyCheck.reason };
  }

  if (!data.shipping_address) {
    return { success: false, error: '新收货地址不能为空' };
  }

  const originalAddress = toBoolean(application.shipping_address_modified) ? 
    application.original_shipping_address : application.shipping_address;

  exec(
    `UPDATE part_applications 
     SET shipping_address = ?, shipping_city = ?, shipping_address_modified = 1,
         original_shipping_address = ?, updated_at = ?
     WHERE id = ?`,
    [data.shipping_address, data.shipping_city || null, originalAddress, getNow(), application.id]
  );

  logStatus(application.id, application.status, application.status, data.operator || 'system', 
    `修改收货地址: ${originalAddress} -> ${data.shipping_address}`);

  const updated = queryOne('SELECT * FROM part_applications WHERE id = ?', [application.id]);
  return { success: true, application: updated };
}

function getApplication(applicationNo) {
  const application = queryOne('SELECT * FROM part_applications WHERE application_no = ?', [applicationNo]);
  if (!application) {
    return { success: false, error: '申请不存在' };
  }

  const logs = query('SELECT * FROM status_logs WHERE application_id = ? ORDER BY created_at', [application.id]);
  return { success: true, application, logs };
}

function listApplications(filters = {}) {
  let queryStr = 'SELECT * FROM part_applications WHERE 1=1';
  const params = [];

  if (filters.status) {
    queryStr += ' AND status = ?';
    params.push(filters.status);
  }
  if (filters.product_sn) {
    queryStr += ' AND product_sn = ?';
    params.push(filters.product_sn);
  }
  if (filters.part_code) {
    queryStr += ' AND part_code = ?';
    params.push(filters.part_code);
  }
  if (filters.is_in_warranty !== undefined) {
    queryStr += ' AND is_in_warranty = ?';
    params.push(filters.is_in_warranty ? 1 : 0);
  }

  queryStr += ' ORDER BY created_at DESC';

  const applications = query(queryStr, params);
  return { success: true, applications };
}

module.exports = {
  createApplication,
  reviewApplication,
  lockInventory,
  shipApplication,
  confirmDelivery,
  receiveOldPart,
  closeApplication,
  modifyShippingAddress,
  getApplication,
  listApplications
};

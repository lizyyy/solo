const { getDB } = require('../db');

const ORDER_STATUSES = [
  'pending',        // 待确认
  'quoted',         // 已报价
  'paid',           // 已收款
  'locked',         // 已锁料
  'scheduled',      // 排产中
  'ready',          // 待取件
  'completed',      // 已交付
  'cancelled'       // 已取消
];

const STATUS_NAMES = {
  pending: '待确认',
  quoted: '已报价',
  paid: '已收款',
  locked: '已锁料',
  scheduled: '排产中',
  ready: '待取件',
  completed: '已交付',
  cancelled: '已取消'
};

const ISSUE_TYPES = [
  'missing_file',      // 文件缺失
  'size_mismatch',     // 尺寸不符
  'low_resolution',    // 分辨率过低
  'no_bleed',          // 无出血
  'color_risk',        // 颜色模式风险
  'format_issue'       // 格式问题
];

const ISSUE_NAMES = {
  missing_file: '文件缺失',
  size_mismatch: '尺寸不符',
  low_resolution: '分辨率过低',
  no_bleed: '无出血',
  color_risk: '颜色模式风险',
  format_issue: '格式问题'
};

function generateOrderNo() {
  const date = new Date();
  const dateStr = date.getFullYear().toString().slice(-2) +
    (date.getMonth() + 1).toString().padStart(2, '0') +
    date.getDate().toString().padStart(2, '0');
  
  const db = getDB();
  const todayOrders = db.prepare(`
    SELECT COUNT(*) as count FROM orders 
    WHERE order_no LIKE ?
  `).get(`${dateStr}%`);
  
  const seq = (todayOrders.count + 1).toString().padStart(4, '0');
  return `${dateStr}${seq}`;
}

function calculatePaperUsage(spec, quantity) {
  const { width, height, sheet_size, sheets_per_sheet, waste_rate = 0.05 } = spec;
  
  if (!sheet_size || !sheets_per_sheet) {
    return {
      sheets: Math.ceil(quantity * (1 + waste_rate)),
      waste: Math.ceil(quantity * waste_rate),
      actual: quantity
    };
  }
  
  const sheetsNeeded = Math.ceil(quantity / sheets_per_sheet);
  const totalSheets = Math.ceil(sheetsNeeded * (1 + waste_rate));
  const wasteSheets = totalSheets - sheetsNeeded;
  
  return {
    sheets: totalSheets,
    waste: wasteSheets,
    actual: sheetsNeeded,
    itemsPerSheet: sheets_per_sheet
  };
}

function calculatePrice(order, paper, processes = []) {
  const db = getDB();
  let totalCost = 0;
  let totalPrice = 0;
  
  if (paper && order.paper_qty_est) {
    const paperCost = paper.unit_price * order.paper_qty_est;
    totalCost += paperCost;
    totalPrice += paperCost * 1.5;
  }
  
  const processIds = order.process_ids ? JSON.parse(order.process_ids) : [];
  for (const pid of processIds) {
    const process = db.prepare('SELECT * FROM processes WHERE id = ?').get(pid);
    if (process) {
      const processCost = process.cost_per_unit * order.quantity;
      totalCost += processCost;
      totalPrice += processCost * 1.8;
    }
  }
  
  if (totalPrice < 50) {
    totalPrice = 50;
  }
  
  return {
    totalCost: Math.round(totalCost * 100) / 100,
    totalPrice: Math.round(totalPrice * 100) / 100
  };
}

function createOrder(orderData) {
  const db = getDB();
  const orderNo = generateOrderNo();
  
  let spec = null;
  if (orderData.spec_template_id) {
    spec = db.prepare('SELECT * FROM spec_templates WHERE id = ?').get(orderData.spec_template_id);
  }
  
  const orderSpec = spec || {
    width: orderData.width,
    height: orderData.height,
    sheet_size: orderData.sheet_size,
    sheets_per_sheet: orderData.sheets_per_sheet || 1,
    waste_rate: orderData.waste_rate || 0.05
  };
  
  const paperUsage = calculatePaperUsage(orderSpec, orderData.quantity);
  
  const insertOrder = db.prepare(`
    INSERT INTO orders (
      order_no, customer_id, spec_template_id, product_type,
      width, height, quantity, paper_id, paper_qty_est,
      process_ids, pickup_time, status, notes
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  
  const processIds = orderData.process_ids ? JSON.stringify(orderData.process_ids) : null;
  
  const result = insertOrder.run(
    orderNo,
    orderData.customer_id || null,
    orderData.spec_template_id || null,
    orderData.product_type || (spec ? spec.product_type : null),
    orderSpec.width,
    orderSpec.height,
    orderData.quantity,
    orderData.paper_id || null,
    paperUsage.sheets,
    processIds,
    orderData.pickup_time || null,
    'pending',
    orderData.notes || null
  );
  
  const orderId = result.lastInsertRowid;
  
  db.prepare(`
    INSERT INTO order_status_history (order_id, from_status, to_status, reason, operator)
    VALUES (?, NULL, ?, ?, ?)
  `).run(orderId, 'pending', '新建订单', 'system');
  
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
  
  if (order.paper_id) {
    const paper = db.prepare('SELECT * FROM paper_stock WHERE id = ?').get(order.paper_id);
    const pricing = calculatePrice(order, paper);
    
    db.prepare(`
      UPDATE orders SET total_cost = ?, total_price = ? WHERE id = ?
    `).run(pricing.totalCost, pricing.totalPrice, orderId);
    
    order.total_cost = pricing.totalCost;
    order.total_price = pricing.totalPrice;
  }
  
  order.paper_usage = paperUsage;
  order.status_name = STATUS_NAMES[order.status];
  
  return order;
}

function updateOrderStatus(orderId, newStatus, reason = '', operator = 'system') {
  const db = getDB();
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
  
  if (!order) {
    throw new Error('订单不存在');
  }
  
  const currentIdx = ORDER_STATUSES.indexOf(order.status);
  const newIdx = ORDER_STATUSES.indexOf(newStatus);
  
  if (newIdx === -1) {
    throw new Error('无效的订单状态');
  }
  
  if (order.status !== 'cancelled' && 
      newStatus !== 'cancelled' && 
      newIdx < currentIdx && 
      newStatus !== 'pending') {
    throw new Error('订单状态不能回退');
  }
  
  db.prepare(`
    INSERT INTO order_status_history (order_id, from_status, to_status, reason, operator)
    VALUES (?, ?, ?, ?, ?)
  `).run(orderId, order.status, newStatus, reason, operator);
  
  db.prepare('UPDATE orders SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
    .run(newStatus, orderId);
  
  return db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
}

function simulatePrecheck(orderId, fileId = null) {
  const db = getDB();
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
  
  if (!order) {
    throw new Error('订单不存在');
  }
  
  const issues = [];
  const files = db.prepare('SELECT * FROM upload_files WHERE order_id = ?').all(orderId);
  
  if (files.length === 0) {
    const issueId = db.prepare(`
      INSERT INTO precheck_issues (order_id, file_id, issue_type, severity, description)
      VALUES (?, NULL, ?, ?, ?)
    `).run(orderId, 'missing_file', 'critical', '订单缺少来稿文件，请上传');
    
    issues.push({
      id: issueId.lastInsertRowid,
      order_id: orderId,
      issue_type: 'missing_file',
      severity: 'critical',
      description: '订单缺少来稿文件，请上传',
      status: 'pending',
      issue_name: ISSUE_NAMES['missing_file']
    });
  }
  
  const simulatedProblems = Math.random();
  if (simulatedProblems > 0.3) {
    const problemTypes = ['size_mismatch', 'low_resolution', 'no_bleed', 'color_risk'];
    const selectedProblem = problemTypes[Math.floor(Math.random() * problemTypes.length)];
    
    let description = '', severity = 'warning', expected = '', actual = '';
    
    switch (selectedProblem) {
      case 'size_mismatch':
        expected = `${order.width}x${order.height}mm`;
        actual = `${order.width - 5}x${order.height - 3}mm`;
        description = `文件尺寸不符，期望 ${expected}，实际 ${actual}`;
        severity = 'critical';
        break;
      case 'low_resolution':
        expected = '300 dpi';
        actual = '150 dpi';
        description = `分辨率过低，期望 ${expected}，实际 ${actual}，印刷可能模糊`;
        severity = 'warning';
        break;
      case 'no_bleed':
        expected = '3mm';
        actual = '0mm';
        description = '未设置出血位，裁切可能出现白边';
        severity = 'warning';
        break;
      case 'color_risk':
        expected = 'CMYK';
        actual = 'RGB';
        description = `颜色模式为 RGB，建议转换为 CMYK 以避免印刷色差`;
        severity = 'warning';
        break;
    }
    
    const targetFile = files.length > 0 ? files[0] : null;
    
    const issueId = db.prepare(`
      INSERT INTO precheck_issues 
      (order_id, file_id, issue_type, severity, description, expected_value, actual_value)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      orderId, 
      targetFile ? targetFile.id : null, 
      selectedProblem, 
      severity, 
      description,
      expected,
      actual
    );
    
    issues.push({
      id: issueId.lastInsertRowid,
      order_id: orderId,
      file_id: targetFile ? targetFile.id : null,
      issue_type: selectedProblem,
      severity,
      description,
      expected_value: expected,
      actual_value: actual,
      status: 'pending',
      issue_name: ISSUE_NAMES[selectedProblem]
    });
  }
  
  return issues;
}

function resolvePrecheckIssue(issueId, resolution, operator = 'system') {
  const db = getDB();
  const issue = db.prepare('SELECT * FROM precheck_issues WHERE id = ?').get(issueId);
  
  if (!issue) {
    throw new Error('问题记录不存在');
  }
  
  db.prepare(`
    UPDATE precheck_issues 
    SET status = 'resolved', resolved_at = CURRENT_TIMESTAMP, resolver = ?, resolution_notes = ?
    WHERE id = ?
  `).run(operator, resolution, issueId);
  
  return db.prepare('SELECT * FROM precheck_issues WHERE id = ?').get(issueId);
}

function lockStock(orderId) {
  const db = getDB();
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
  
  if (!order) {
    throw new Error('订单不存在');
  }
  
  if (!order.paper_id || !order.paper_qty_est) {
    throw new Error('订单未指定纸张或用量');
  }
  
  const paper = db.prepare('SELECT * FROM paper_stock WHERE id = ?').get(order.paper_id);
  const lockedQty = db.prepare(`
    SELECT SUM(quantity) as total FROM stock_locks 
    WHERE paper_id = ? AND is_released = 0
  `).get(order.paper_id);
  
  const available = paper.stock_qty - (lockedQty.total || 0);
  
  if (available < order.paper_qty_est) {
    throw new Error(`纸张库存不足，可用 ${available}，需要 ${order.paper_qty_est}`);
  }
  
  db.prepare(`
    INSERT INTO stock_locks (order_id, paper_id, quantity)
    VALUES (?, ?, ?)
  `).run(orderId, order.paper_id, order.paper_qty_est);
  
  return { success: true, locked: order.paper_qty_est, available: available - order.paper_qty_est };
}

function releaseStock(orderId) {
  const db = getDB();
  
  const locks = db.prepare(`
    SELECT * FROM stock_locks WHERE order_id = ? AND is_released = 0
  `).all(orderId);
  
  for (const lock of locks) {
    db.prepare(`
      UPDATE stock_locks SET is_released = 1, released_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(lock.id);
  }
  
  return { success: true, released: locks.length };
}

function getAvailableStock(paperId) {
  const db = getDB();
  const paper = db.prepare('SELECT * FROM paper_stock WHERE id = ?').get(paperId);
  
  if (!paper) return null;
  
  const lockedQty = db.prepare(`
    SELECT SUM(quantity) as total FROM stock_locks 
    WHERE paper_id = ? AND is_released = 0
  `).get(paperId);
  
  return {
    ...paper,
    available: paper.stock_qty - (lockedQty.total || 0),
    locked: lockedQty.total || 0
  };
}

function checkScheduleConflict(machineId, startTime, endTime) {
  const db = getDB();
  
  const conflicts = db.prepare(`
    SELECT * FROM schedule_entries 
    WHERE machine_id = ? 
    AND status != 'cancelled'
    AND (
      (start_time < ? AND end_time > ?) OR
      (start_time >= ? AND start_time < ?)
    )
  `).all(machineId, endTime, startTime, startTime, endTime);
  
  return conflicts;
}

function createScheduleEntry(scheduleData) {
  const db = getDB();
  const { orderId, machineId, processType, startTime, endTime, quantity, notes } = scheduleData;
  
  const conflicts = checkScheduleConflict(machineId, startTime, endTime);
  
  if (conflicts.length > 0) {
    return {
      success: false,
      conflicts,
      message: '该时段已有排产冲突'
    };
  }
  
  const result = db.prepare(`
    INSERT INTO schedule_entries 
    (order_id, machine_id, process_type, start_time, end_time, quantity, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(orderId, machineId, processType, startTime, endTime, quantity, notes);
  
  return {
    success: true,
    entryId: result.lastInsertRowid
  };
}

function recordOrderChange(orderId, changeType, fieldName, oldValue, newValue, reason, operator = 'system') {
  const db = getDB();
  
  db.prepare(`
    INSERT INTO order_changes 
    (order_id, change_type, field_name, old_value, new_value, reason, operator)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(orderId, changeType, fieldName, 
    oldValue !== null && oldValue !== undefined ? JSON.stringify(oldValue) : null,
    newValue !== null && newValue !== undefined ? JSON.stringify(newValue) : null,
    reason, operator
  );
}

module.exports = {
  ORDER_STATUSES,
  STATUS_NAMES,
  ISSUE_TYPES,
  ISSUE_NAMES,
  generateOrderNo,
  calculatePaperUsage,
  calculatePrice,
  createOrder,
  updateOrderStatus,
  simulatePrecheck,
  resolvePrecheckIssue,
  lockStock,
  releaseStock,
  getAvailableStock,
  checkScheduleConflict,
  createScheduleEntry,
  recordOrderChange
};

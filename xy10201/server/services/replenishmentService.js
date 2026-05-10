const { getDatabase } = require('../config/database');
const materialService = require('./materialService');

const db = getDatabase();

const STATUS_FLOW = {
  PENDING: {
    label: '待审核',
    color: '#e6a23c',
    can_transition_to: ['APPROVED', 'REJECTED'],
    actions: ['approve', 'reject']
  },
  APPROVED: {
    label: '已通过',
    color: '#67c23a',
    can_transition_to: ['FULFILLED'],
    actions: ['fulfill']
  },
  REJECTED: {
    label: '已拒绝',
    color: '#f56c6c',
    can_transition_to: [],
    actions: []
  },
  FULFILLED: {
    label: '已补货',
    color: '#409eff',
    can_transition_to: [],
    actions: []
  }
};

function generateRequestNo() {
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `RP-${dateStr}-${random}`;
}

function canTransition(fromStatus, toStatus) {
  const fromConfig = STATUS_FLOW[fromStatus];
  return fromConfig && fromConfig.can_transition_to.includes(toStatus);
}

function createRequest(data) {
  const { departmentId, materialId, requestedQuantity, reason, requester } = data;
  
  if (!requestedQuantity || requestedQuantity <= 0) {
    throw new Error('申请数量必须大于0');
  }
  
  const material = materialService.getMaterialById(materialId);
  if (!material) throw new Error('耗材不存在');
  
  const requestNo = generateRequestNo();
  
  const stmt = db.prepare(`
    INSERT INTO replenishment_requests 
      (request_no, department_id, material_id, requested_quantity, reason, requester, status)
    VALUES (?, ?, ?, ?, ?, ?, 'PENDING')
  `);
  
  const result = stmt.run(requestNo, departmentId, materialId, requestedQuantity, reason, requester);
  
  materialService.logOperation('REPLENISHMENT', 'CREATE', 'replenishment_requests', result.lastInsertRowid, null, {
    request_no: requestNo,
    material_name: material.name,
    quantity: requestedQuantity,
    requester
  });
  
  return getRequestById(result.lastInsertRowid);
}

function getRequestById(id) {
  return db.prepare(`
    SELECT r.*, 
      m.name as material_name, m.code as material_code, m.unit,
      m.current_stock, m.min_stock, m.max_stock,
      d.name as department_name, d.code as department_code
    FROM replenishment_requests r
    JOIN materials m ON m.id = r.material_id
    JOIN departments d ON d.id = r.department_id
    WHERE r.id = ?
  `).get(id);
}

function getRequests(filters = {}) {
  let sql = `
    SELECT r.*, 
      m.name as material_name, m.code as material_code, m.unit,
      m.current_stock, m.min_stock,
      d.name as department_name
    FROM replenishment_requests r
    JOIN materials m ON m.id = r.material_id
    JOIN departments d ON d.id = r.department_id
    WHERE 1=1
  `;
  const params = [];
  
  if (filters.status) {
    sql += ' AND r.status = ?';
    params.push(filters.status);
  }
  
  if (filters.materialId) {
    sql += ' AND r.material_id = ?';
    params.push(filters.materialId);
  }
  
  if (filters.departmentId) {
    sql += ' AND r.department_id = ?';
    params.push(filters.departmentId);
  }
  
  sql += ' ORDER BY r.created_at DESC';
  
  if (filters.limit) {
    sql += ' LIMIT ?';
    params.push(filters.limit);
  }
  
  return db.prepare(sql).all(...params);
}

function getRequestAuditHistory(requestId) {
  return db.prepare(`
    SELECT ar.*,
      CASE ar.action
        WHEN 'APPROVE' THEN '通过'
        WHEN 'REJECT' THEN '拒绝'
        WHEN 'FULFILL' THEN '补货完成'
        ELSE ar.action
      END as action_label
    FROM audit_records ar
    WHERE ar.request_id = ?
    ORDER BY ar.created_at ASC
  `).all(requestId);
}

function approveRequest(requestId, data) {
  const { auditor, approvedQuantity, comments } = data;
  
  const request = getRequestById(requestId);
  if (!request) throw new Error('补货申请不存在');
  
  if (!canTransition(request.status, 'APPROVED')) {
    throw new Error(`当前状态"${STATUS_FLOW[request.status]?.label || request.status}"不允许通过`);
  }
  
  const tx = db.transaction(() => {
    const finalApproved = approvedQuantity || request.requested_quantity;
    
    db.prepare(`
      UPDATE replenishment_requests 
      SET status = 'APPROVED', approved_quantity = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(finalApproved, requestId);
    
    db.prepare(`
      INSERT INTO audit_records (request_id, auditor, action, approved_quantity, comments)
      VALUES (?, ?, 'APPROVE', ?, ?)
    `).run(requestId, auditor, finalApproved, comments);
    
    materialService.logOperation('REPLENISHMENT', 'APPROVE', 'replenishment_requests', requestId, 
      { status: request.status }, 
      { status: 'APPROVED', approved_quantity: finalApproved },
      auditor);
  });
  
  tx();
  
  return getRequestById(requestId);
}

function rejectRequest(requestId, data) {
  const { auditor, comments } = data;
  
  const request = getRequestById(requestId);
  if (!request) throw new Error('补货申请不存在');
  
  if (!canTransition(request.status, 'REJECTED')) {
    throw new Error(`当前状态"${STATUS_FLOW[request.status]?.label || request.status}"不允许拒绝`);
  }
  
  const tx = db.transaction(() => {
    db.prepare(`
      UPDATE replenishment_requests 
      SET status = 'REJECTED', updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(requestId);
    
    db.prepare(`
      INSERT INTO audit_records (request_id, auditor, action, comments)
      VALUES (?, ?, 'REJECT', ?)
    `).run(requestId, auditor, comments || '审核未通过');
    
    materialService.logOperation('REPLENISHMENT', 'REJECT', 'replenishment_requests', requestId,
      { status: request.status }, { status: 'REJECTED' }, auditor);
  });
  
  tx();
  
  return getRequestById(requestId);
}

function fulfillRequest(requestId, data) {
  const { operator, comments } = data;
  
  const request = getRequestById(requestId);
  if (!request) throw new Error('补货申请不存在');
  
  if (!canTransition(request.status, 'FULFILLED')) {
    throw new Error(`当前状态"${STATUS_FLOW[request.status]?.label || request.status}"不允许完成补货`);
  }
  
  const fulfillQty = request.approved_quantity || request.requested_quantity;
  
  const tx = db.transaction(() => {
    db.prepare(`
      UPDATE replenishment_requests 
      SET status = 'FULFILLED', updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(requestId);
    
    db.prepare(`
      INSERT INTO audit_records (request_id, auditor, action, approved_quantity, comments)
      VALUES (?, ?, 'FULFILL', ?, ?)
    `).run(requestId, operator, fulfillQty, comments || '补货完成');
    
    materialService.updateStock(
      request.material_id, fulfillQty, 'REPLENISHMENT',
      'REPLENISHMENT_REQUEST', requestId, operator,
      `补货申请：${request.request_no}`
    );
    
    materialService.logOperation('REPLENISHMENT', 'FULFILL', 'replenishment_requests', requestId,
      { status: request.status }, { status: 'FULFILLED' }, operator);
  });
  
  tx();
  
  return getRequestById(requestId);
}

function getStatusCounts() {
  const result = db.prepare(`
    SELECT status, COUNT(*) as count
    FROM replenishment_requests
    GROUP BY status
  `).all();
  
  const counts = {};
  Object.keys(STATUS_FLOW).forEach(s => counts[s] = 0);
  result.forEach(r => counts[r.status] = r.count);
  
  return counts;
}

function getPendingSuggestions() {
  const lowStock = materialService.getLowStockMaterials();
  const pendingRequests = getRequests({ status: 'PENDING', limit: 10 });
  
  return {
    low_stock_count: lowStock.length,
    low_stock_items: lowStock,
    pending_requests_count: pendingRequests.length,
    pending_requests: pendingRequests,
    suggestions: [
      ...lowStock.slice(0, 3).map(m => ({
        type: 'STOCK_WARNING',
        priority: 'HIGH',
        title: `${m.name} 库存不足`,
        message: `当前库存 ${m.current_stock}${m.unit}，低于预警值 ${m.min_stock}${m.unit}`,
        action: '建议立即申请补货'
      })),
      ...pendingRequests.slice(0, 3).map(r => ({
        type: 'AUDIT_PENDING',
        priority: 'MEDIUM',
        title: `补货申请待审核：${r.request_no}`,
        message: `${r.requester} 申请 ${r.material_name} ${r.requested_quantity}${r.unit}`,
        action: '请及时处理审核'
      }))
    ]
  };
}

function getRequestWithFullHistory(requestId) {
  const request = getRequestById(requestId);
  if (!request) return null;
  
  return {
    ...request,
    status_label: STATUS_FLOW[request.status]?.label || request.status,
    status_color: STATUS_FLOW[request.status]?.color || '#909399',
    available_actions: STATUS_FLOW[request.status]?.actions || [],
    audit_history: getRequestAuditHistory(requestId),
    stock_history: materialService.getMaterialHistory(request.material_id, 10)
  };
}

module.exports = {
  STATUS_FLOW,
  canTransition,
  createRequest,
  getRequestById,
  getRequests,
  getRequestAuditHistory,
  approveRequest,
  rejectRequest,
  fulfillRequest,
  getStatusCounts,
  getPendingSuggestions,
  getRequestWithFullHistory
};

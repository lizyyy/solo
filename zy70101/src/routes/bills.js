const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../db/init');
const { generateBill, recalculateBill } = require('../services/billCalculation');
const { BILL_STATUS, canTransition, describeStatus, describeAvailableTransitions } = require('../services/billStateMachine');

const router = express.Router();

function getIdempotencyKey(req) {
  return req.headers['x-request-id'] || req.headers['x-idempotency-key'];
}

function checkIdempotency(req, res, next) {
  const key = getIdempotencyKey(req);
  if (!key) {
    return next();
  }
  
  const existing = db.prepare(`
    SELECT * FROM idempotency_keys WHERE key = ? AND request_type = ?
  `).get(key, req.path);
  
  if (existing) {
    return res.status(200).json({
      success: true,
      idempotent: true,
      data: JSON.parse(existing.response_data),
      message: '重复请求，返回上次结果'
    });
  }
  
  req.idempotencyKey = key;
  next();
}

function saveIdempotentResponse(key, requestType, data) {
  if (!key) return;
  db.prepare(`
    INSERT INTO idempotency_keys (id, key, request_type, response_data)
    VALUES (?, ?, ?, ?)
  `).run(uuidv4(), key, requestType, JSON.stringify(data));
}

function transitionStatus(billId, toStatus, operator, reason) {
  const bill = db.prepare('SELECT * FROM bills WHERE id = ?').get(billId);
  if (!bill) {
    return { success: false, error: '账单不存在' };
  }
  
  const transition = canTransition(bill.status, toStatus);
  if (!transition.allowed) {
    return { success: false, error: transition.reason };
  }
  
  const tx = db.transaction(() => {
    const logId = uuidv4();
    db.prepare(`
      INSERT INTO bill_status_logs 
        (id, bill_id, from_status, to_status, operator, reason)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(logId, billId, bill.status, toStatus, operator, reason);
    
    const updateFields = ['status = ?', "updated_at = datetime('now')"];
    const updateParams = [toStatus];
    
    if (toStatus === BILL_STATUS.CONFIRMED) {
      updateFields.push("confirmed_at = datetime('now')");
    } else if (toStatus === BILL_STATUS.DISPUTED) {
      updateFields.push("disputed_at = datetime('now')");
    }
    
    db.prepare(`UPDATE bills SET ${updateFields.join(', ')} WHERE id = ?`)
      .run(...updateParams, billId);
  });
  
  tx();
  
  return {
    success: true,
    data: {
      billId,
      from: describeStatus(bill.status),
      to: describeStatus(toStatus),
      reason
    }
  };
}

router.post('/generate', checkIdempotency, (req, res) => {
  const { period, meter_id } = req.body;
  const requestId = getIdempotencyKey(req);
  
  if (!period || !meter_id) {
    return res.status(400).json({
      success: false,
      error: '周期(period)和电表ID(meter_id)不能为空'
    });
  }
  
  try {
    const result = generateBill(period, meter_id, requestId);
    saveIdempotentResponse(requestId, req.path, result);
    
    res.json({
      success: true,
      data: {
        bill_id: result.billId,
        period,
        total_consumption: result.totalConsumption,
        total_amount: result.totalAmount,
        rule_version: result.ruleVersion,
        status: BILL_STATUS.GENERATED,
        status_desc: describeStatus(BILL_STATUS.GENERATED)
      }
    });
  } catch (e) {
    res.status(400).json({ success: false, error: e.message });
  }
});

router.get('/', (req, res) => {
  const { period, status, meter_id } = req.query;
  
  let sql = `SELECT * FROM bills WHERE 1=1`;
  const params = [];
  
  if (period) {
    sql += ' AND period = ?';
    params.push(period);
  }
  if (status) {
    sql += ' AND status = ?';
    params.push(status);
  }
  if (meter_id) {
    sql += ' AND meter_id = ?';
    params.push(meter_id);
  }
  
  sql += ' ORDER BY period DESC';
  
  const bills = db.prepare(sql).all(...params).map(b => ({
    ...b,
    status_desc: describeStatus(b.status)
  }));
  
  res.json({ success: true, data: bills });
});

router.get('/:id', (req, res) => {
  const { id } = req.params;
  
  const bill = db.prepare('SELECT * FROM bills WHERE id = ?').get(id);
  if (!bill) {
    return res.status(404).json({ success: false, error: '账单不存在' });
  }
  
  const items = db.prepare(`
    SELECT bi.*, t.code as tenant_code, t.name as tenant_name
    FROM bill_items bi
    JOIN tenants t ON bi.tenant_id = t.id
    WHERE bi.bill_id = ?
  `).all(id);
  
  const logs = db.prepare(`
    SELECT * FROM bill_status_logs WHERE bill_id = ? ORDER BY created_at DESC
  `).all(id).map(l => ({
    ...l,
    from_status_desc: describeStatus(l.from_status),
    to_status_desc: describeStatus(l.to_status)
  }));
  
  res.json({
    success: true,
    data: {
      ...bill,
      status_desc: describeStatus(bill.status),
      available_transitions: describeAvailableTransitions(bill.status),
      items,
      status_history: logs
    }
  });
});

router.post('/:id/submit', (req, res) => {
  const { id } = req.params;
  const { operator } = req.body;
  
  const result = transitionStatus(
    id, 
    BILL_STATUS.PENDING_CONFIRMATION, 
    operator, 
    '提交待确认'
  );
  
  if (!result.success) {
    return res.status(400).json(result);
  }
  
  res.json(result);
});

router.post('/:id/confirm', (req, res) => {
  const { id } = req.params;
  const { operator } = req.body;
  
  const result = transitionStatus(
    id, 
    BILL_STATUS.CONFIRMED, 
    operator, 
    '账单确认'
  );
  
  if (!result.success) {
    return res.status(400).json(result);
  }
  
  res.json(result);
});

router.post('/:id/dispute', (req, res) => {
  const { id } = req.params;
  const { operator, reason } = req.body;
  
  if (!reason) {
    return res.status(400).json({
      success: false,
      error: '请填写异议原因'
    });
  }
  
  const result = transitionStatus(
    id, 
    BILL_STATUS.DISPUTED, 
    operator, 
    `异议: ${reason}`
  );
  
  if (!result.success) {
    return res.status(400).json(result);
  }
  
  res.json(result);
});

router.post('/:id/resolve-dispute', (req, res) => {
  const { id } = req.params;
  const { operator, resolution } = req.body;
  
  if (!resolution) {
    return res.status(400).json({
      success: false,
      error: '请填写处理结果'
    });
  }
  
  const result = transitionStatus(
    id, 
    BILL_STATUS.DISPUTE_RESOLVED, 
    operator, 
    `异议处理: ${resolution}`
  );
  
  if (!result.success) {
    return res.status(400).json(result);
  }
  
  res.json(result);
});

router.post('/:id/request-recalculation', (req, res) => {
  const { id } = req.params;
  const { operator, reason } = req.body;
  
  const result = transitionStatus(
    id, 
    BILL_STATUS.PENDING_RECALCULATION, 
    operator, 
    reason || '申请重算'
  );
  
  if (!result.success) {
    return res.status(400).json(result);
  }
  
  res.json(result);
});

router.post('/:id/recalculate', checkIdempotency, (req, res) => {
  const { id } = req.params;
  const { operator } = req.body;
  const requestId = getIdempotencyKey(req);
  
  const bill = db.prepare('SELECT * FROM bills WHERE id = ?').get(id);
  if (!bill) {
    return res.status(404).json({ success: false, error: '账单不存在' });
  }
  
  const canStart = canTransition(bill.status, BILL_STATUS.RECALCULATING);
  if (!canStart.allowed) {
    return res.status(400).json({
      success: false,
      error: '当前状态不允许重算',
      detail: canStart.reason,
      current_status: describeStatus(bill.status),
      suggestion: bill.status === BILL_STATUS.RECALCULATION_FAILED
        ? '可以直接重试重算，或先设置为【待重算】再重算'
        : '请先调用【申请重算】接口'
    });
  }
  
  const markTx = db.transaction(() => {
    db.prepare(`
      UPDATE bills SET 
        status = ?,
        error_message = NULL,
        updated_at = datetime('now')
      WHERE id = ?
    `).run(BILL_STATUS.RECALCULATING, id);
    
    const logId = uuidv4();
    db.prepare(`
      INSERT INTO bill_status_logs 
        (id, bill_id, from_status, to_status, operator, reason)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(logId, id, bill.status, BILL_STATUS.RECALCULATING, operator, '开始重算');
  });
  markTx();
  
  try {
    const result = recalculateBill(id, requestId);
    
    const logId2 = uuidv4();
    db.prepare(`
      INSERT INTO bill_status_logs 
        (id, bill_id, from_status, to_status, operator, reason)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(logId2, id, BILL_STATUS.RECALCULATING, BILL_STATUS.GENERATED, operator, '重算完成');
    
    saveIdempotentResponse(requestId, req.path, result);
    
    res.json({
      success: true,
      data: {
        bill_id: id,
        message: '重算成功',
        total_consumption: result.totalConsumption,
        total_amount: result.totalAmount,
        rule_version: result.ruleVersion,
        status: BILL_STATUS.GENERATED,
        status_desc: describeStatus(BILL_STATUS.GENERATED)
      }
    });
  } catch (e) {
    db.prepare(`
      UPDATE bills SET 
        status = ?,
        error_message = ?,
        updated_at = datetime('now')
      WHERE id = ?
    `).run(BILL_STATUS.RECALCULATION_FAILED, e.message, id);
    
    const logId3 = uuidv4();
    db.prepare(`
      INSERT INTO bill_status_logs 
        (id, bill_id, from_status, to_status, operator, reason)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(logId3, id, BILL_STATUS.RECALCULATING, BILL_STATUS.RECALCULATION_FAILED, operator, `重算失败: ${e.message}`);
    
    res.status(500).json({
      success: false,
      error: '重算失败',
      detail: e.message,
      next_steps: [
        '1. 查看 error_message 修复问题',
        '2. 修复后可直接再次调用本接口重试',
        '3. 或调用 /bills/:id/request-recalculation 先标记为待重算'
      ]
    });
  }
});

router.get('/failed/recalculation', (req, res) => {
  const bills = db.prepare(`
    SELECT * FROM bills 
    WHERE status = ? 
    ORDER BY updated_at DESC
  `).all(BILL_STATUS.RECALCULATION_FAILED).map(b => ({
    ...b,
    status_desc: describeStatus(b.status)
  }));
  
  res.json({
    success: true,
    data: {
      count: bills.length,
      bills,
      retry_guide: '可直接对失败账单调用 /bills/:id/recalculate 重试'
    }
  });
});

module.exports = router;

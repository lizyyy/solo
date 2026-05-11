const express = require('express');
const router = express.Router();
const { db } = require('../database');
const { calculateSLA, canModifyWorkOrder, EVENT_TYPES } = require('../slaCalculator');

const { format } = require('date-fns');

router.get('/', (req, res) => {
  const { contract_id, status, is_settled } = req.query;
  
  let sql = `
    SELECT wo.*, c.name as contract_name, c.customer_name
    FROM work_orders wo
    JOIN contracts c ON wo.contract_id = c.id
    WHERE 1=1
  `;
  const params = [];
  
  if (contract_id) {
    sql += ' AND wo.contract_id = ?';
    params.push(contract_id);
  }
  
  if (status) {
    sql += ' AND wo.status = ?';
    params.push(status);
  }
  
  if (is_settled !== undefined) {
    sql += ' AND wo.is_settled = ?';
    params.push(is_settled === 'true' ? 1 : 0);
  }
  
  sql += ' ORDER BY wo.created_at DESC';
  
  const workOrders = db.prepare(sql).all(...params);
  res.json(workOrders);
});

router.get('/:id', (req, res) => {
  const workOrder = db.prepare(`
    SELECT wo.*, c.name as contract_name, c.customer_name
    FROM work_orders wo
    JOIN contracts c ON wo.contract_id = c.id
    WHERE wo.id = ?
  `).get(req.params.id);
  
  if (!workOrder) {
    return res.status(404).json({ error: '工单不存在' });
  }
  
  const slaResult = calculateSLA(req.params.id);
  res.json({
    ...workOrder,
    sla: slaResult
  });
});

router.post('/', (req, res) => {
  const { contract_id, work_order_number, description, event_time } = req.body;
  
  if (!contract_id || !work_order_number || !description) {
    return res.status(400).json({ error: '缺少必填字段' });
  }
  
  const contract = db.prepare('SELECT * FROM contracts WHERE id = ?').get(contract_id);
  if (!contract) {
    return res.status(400).json({ error: '合同不存在' });
  }
  
  const transaction = db.transaction(() => {
    const result = db.prepare(`
      INSERT INTO work_orders (contract_id, work_order_number, description, status)
      VALUES (?, ?, ?, 'created')
    `).run(contract_id, work_order_number, description);
    
    const workOrderId = result.lastInsertRowid;
    const eventTime = event_time || format(new Date(), 'yyyy-MM-dd HH:mm:ss');
    
    db.prepare(`
      INSERT INTO timing_events (work_order_id, event_type, event_time, reason)
      VALUES (?, ?, ?, '工单创建')
    `).run(workOrderId, EVENT_TYPES.CREATED, eventTime);
    
    return workOrderId;
  });
  
  const workOrderId = transaction();
  
  const workOrder = db.prepare(`
    SELECT wo.*, c.name as contract_name, c.customer_name
    FROM work_orders wo
    JOIN contracts c ON wo.contract_id = c.id
    WHERE wo.id = ?
  `).get(workOrderId);
  
  const slaResult = calculateSLA(workOrderId);
  
  res.status(201).json({
    ...workOrder,
    sla: slaResult
  });
});

router.post('/:id/respond', (req, res) => {
  const workOrderId = req.params.id;
  const { event_time, created_by } = req.body;
  
  if (!canModifyWorkOrder(workOrderId)) {
    return res.status(400).json({ error: '工单已结算，无法修改' });
  }
  
  const workOrder = db.prepare('SELECT * FROM work_orders WHERE id = ?').get(workOrderId);
  if (!workOrder) {
    return res.status(404).json({ error: '工单不存在' });
  }
  
  if (workOrder.status !== 'created') {
    return res.status(400).json({ error: '只能对已创建的工单进行响应' });
  }
  
  const transaction = db.transaction(() => {
    const eventTime = event_time || format(new Date(), 'yyyy-MM-dd HH:mm:ss');
    
    db.prepare(`
      INSERT INTO timing_events (work_order_id, event_type, event_time, reason, created_by)
      VALUES (?, ?, ?, '响应客户', ?)
    `).run(workOrderId, EVENT_TYPES.RESPONDED, eventTime, created_by || 'system');
    
    db.prepare(`
      UPDATE work_orders SET status = 'responded', updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(workOrderId);
  });
  
  transaction();
  
  const slaResult = calculateSLA(workOrderId);
  res.json(slaResult);
});

router.post('/:id/pause', (req, res) => {
  const workOrderId = req.params.id;
  const { event_time, reason, evidence_url, created_by } = req.body;
  
  if (!canModifyWorkOrder(workOrderId)) {
    return res.status(400).json({ error: '工单已结算，无法修改' });
  }
  
  if (!reason) {
    return res.status(400).json({ error: '暂停原因不能为空' });
  }
  
  const workOrder = db.prepare('SELECT * FROM work_orders WHERE id = ?').get(workOrderId);
  if (!workOrder) {
    return res.status(404).json({ error: '工单不存在' });
  }
  
  if (workOrder.status !== 'responded' && workOrder.status !== 'in_progress') {
    return res.status(400).json({ error: '只能在响应后或处理中暂停工单' });
  }
  
  const transaction = db.transaction(() => {
    const eventTime = event_time || format(new Date(), 'yyyy-MM-dd HH:mm:ss');
    
    db.prepare(`
      INSERT INTO timing_events (work_order_id, event_type, event_time, reason, evidence_url, created_by)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(workOrderId, EVENT_TYPES.PAUSED, eventTime, reason, evidence_url, created_by || 'system');
    
    db.prepare(`
      UPDATE work_orders SET status = 'paused', updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(workOrderId);
  });
  
  transaction();
  
  const slaResult = calculateSLA(workOrderId);
  res.json(slaResult);
});

router.post('/:id/resume', (req, res) => {
  const workOrderId = req.params.id;
  const { event_time, reason, created_by } = req.body;
  
  if (!canModifyWorkOrder(workOrderId)) {
    return res.status(400).json({ error: '工单已结算，无法修改' });
  }
  
  const workOrder = db.prepare('SELECT * FROM work_orders WHERE id = ?').get(workOrderId);
  if (!workOrder) {
    return res.status(404).json({ error: '工单不存在' });
  }
  
  if (workOrder.status !== 'paused') {
    return res.status(400).json({ error: '只能恢复已暂停的工单' });
  }
  
  const transaction = db.transaction(() => {
    const eventTime = event_time || format(new Date(), 'yyyy-MM-dd HH:mm:ss');
    
    db.prepare(`
      INSERT INTO timing_events (work_order_id, event_type, event_time, reason, created_by)
      VALUES (?, ?, ?, ?, ?)
    `).run(workOrderId, EVENT_TYPES.RESUMED, eventTime, reason || '恢复处理', created_by || 'system');
    
    db.prepare(`
      UPDATE work_orders SET status = 'in_progress', updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(workOrderId);
  });
  
  transaction();
  
  const slaResult = calculateSLA(workOrderId);
  res.json(slaResult);
});

router.post('/:id/repair', (req, res) => {
  const workOrderId = req.params.id;
  const { event_time, created_by } = req.body;
  
  if (!canModifyWorkOrder(workOrderId)) {
    return res.status(400).json({ error: '工单已结算，无法修改' });
  }
  
  const workOrder = db.prepare('SELECT * FROM work_orders WHERE id = ?').get(workOrderId);
  if (!workOrder) {
    return res.status(404).json({ error: '工单不存在' });
  }
  
  const validStatuses = ['responded', 'in_progress'];
  if (!validStatuses.includes(workOrder.status)) {
    return res.status(400).json({ error: '只能在响应后或处理中完成修复' });
  }
  
  const transaction = db.transaction(() => {
    const eventTime = event_time || format(new Date(), 'yyyy-MM-dd HH:mm:ss');
    
    db.prepare(`
      INSERT INTO timing_events (work_order_id, event_type, event_time, reason, created_by)
      VALUES (?, ?, ?, '修复完成', ?)
    `).run(workOrderId, EVENT_TYPES.REPAIRED, eventTime, created_by || 'system');
    
    db.prepare(`
      UPDATE work_orders SET status = 'repaired', updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(workOrderId);
  });
  
  transaction();
  
  const slaResult = calculateSLA(workOrderId);
  res.json(slaResult);
});

router.post('/:id/close', (req, res) => {
  const workOrderId = req.params.id;
  const { event_time, created_by } = req.body;
  
  if (!canModifyWorkOrder(workOrderId)) {
    return res.status(400).json({ error: '工单已结算，无法修改' });
  }
  
  const workOrder = db.prepare('SELECT * FROM work_orders WHERE id = ?').get(workOrderId);
  if (!workOrder) {
    return res.status(404).json({ error: '工单不存在' });
  }
  
  if (workOrder.status !== 'repaired') {
    return res.status(400).json({ error: '只能关闭已修复的工单' });
  }
  
  const transaction = db.transaction(() => {
    const eventTime = event_time || format(new Date(), 'yyyy-MM-dd HH:mm:ss');
    
    db.prepare(`
      INSERT INTO timing_events (work_order_id, event_type, event_time, reason, created_by)
      VALUES (?, ?, ?, '工单关闭', ?)
    `).run(workOrderId, EVENT_TYPES.CLOSED, eventTime, created_by || 'system');
    
    db.prepare(`
      UPDATE work_orders SET status = 'closed', updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(workOrderId);
  });
  
  transaction();
  
  const slaResult = calculateSLA(workOrderId);
  res.json(slaResult);
});

router.get('/:id/timeline', (req, res) => {
  const events = db.prepare(`
    SELECT * FROM timing_events
    WHERE work_order_id = ?
    ORDER BY event_time ASC
  `).all(req.params.id);
  
  res.json(events);
});

module.exports = router;

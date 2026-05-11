const express = require('express');
const router = express.Router();
const { db } = require('../database');
const { calculateSLA, canModifyWorkOrder } = require('../slaCalculator');
const { format } = require('date-fns');

router.get('/', (req, res) => {
  const { work_order_id, status } = req.query;
  
  let sql = `
    SELECT er.*, wo.work_order_number, wo.description, c.customer_name
    FROM exemption_requests er
    JOIN work_orders wo ON er.work_order_id = wo.id
    JOIN contracts c ON wo.contract_id = c.id
    WHERE 1=1
  `;
  const params = [];
  
  if (work_order_id) {
    sql += ' AND er.work_order_id = ?';
    params.push(work_order_id);
  }
  
  if (status) {
    sql += ' AND er.status = ?';
    params.push(status);
  }
  
  sql += ' ORDER BY er.created_at DESC';
  
  const exemptions = db.prepare(sql).all(...params);
  res.json(exemptions);
});

router.post('/', (req, res) => {
  const { work_order_id, exemption_type, reason, evidence_url, amount, created_by } = req.body;
  
  if (!work_order_id || !exemption_type || !reason || amount === undefined || amount === null) {
    return res.status(400).json({ error: '缺少必填字段' });
  }
  
  if (!canModifyWorkOrder(work_order_id)) {
    return res.status(400).json({ error: '工单已结算，无法创建免责申请' });
  }
  
  const workOrder = db.prepare('SELECT * FROM work_orders WHERE id = ?').get(work_order_id);
  if (!workOrder) {
    return res.status(404).json({ error: '工单不存在' });
  }
  
  const result = db.prepare(`
    INSERT INTO exemption_requests (
      work_order_id, exemption_type, reason, evidence_url, amount, created_by
    ) VALUES (?, ?, ?, ?, ?, ?)
  `).run(work_order_id, exemption_type, reason, evidence_url, amount, created_by || 'system');
  
  const exemption = db.prepare(`
    SELECT er.*, wo.work_order_number, wo.description, c.customer_name
    FROM exemption_requests er
    JOIN work_orders wo ON er.work_order_id = wo.id
    JOIN contracts c ON wo.contract_id = c.id
    WHERE er.id = ?
  `).get(result.lastInsertRowid);
  
  res.status(201).json(exemption);
});

router.post('/:id/approve', (req, res) => {
  const exemptionId = req.params.id;
  const { approved_by } = req.body;
  
  const exemption = db.prepare('SELECT * FROM exemption_requests WHERE id = ?').get(exemptionId);
  if (!exemption) {
    return res.status(404).json({ error: '免责申请不存在' });
  }
  
  if (exemption.status !== 'pending') {
    return res.status(400).json({ error: '只能审批待处理的免责申请' });
  }
  
  if (!canModifyWorkOrder(exemption.work_order_id)) {
    return res.status(400).json({ error: '工单已结算，无法审批免责申请' });
  }
  
  db.prepare(`
    UPDATE exemption_requests 
    SET status = 'approved', approved_by = ?, approved_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(approved_by || 'system', exemptionId);
  
  const updatedExemption = db.prepare(`
    SELECT er.*, wo.work_order_number, wo.description, c.customer_name
    FROM exemption_requests er
    JOIN work_orders wo ON er.work_order_id = wo.id
    JOIN contracts c ON wo.contract_id = c.id
    WHERE er.id = ?
  `).get(exemptionId);
  
  const slaResult = calculateSLA(exemption.work_order_id);
  
  res.json({
    exemption: updatedExemption,
    sla: slaResult
  });
});

router.post('/:id/reject', (req, res) => {
  const exemptionId = req.params.id;
  const { rejected_by, reject_reason } = req.body;
  
  const exemption = db.prepare('SELECT * FROM exemption_requests WHERE id = ?').get(exemptionId);
  if (!exemption) {
    return res.status(404).json({ error: '免责申请不存在' });
  }
  
  if (exemption.status !== 'pending') {
    return res.status(400).json({ error: '只能拒绝待处理的免责申请' });
  }
  
  if (!canModifyWorkOrder(exemption.work_order_id)) {
    return res.status(400).json({ error: '工单已结算，无法拒绝免责申请' });
  }
  
  db.prepare(`
    UPDATE exemption_requests 
    SET status = 'rejected', approved_by = ?, approved_at = CURRENT_TIMESTAMP,
        reason = reason || ' [拒绝原因: ' || ? || ']'
    WHERE id = ?
  `).run(rejected_by || 'system', reject_reason || '未提供原因', exemptionId);
  
  const updatedExemption = db.prepare(`
    SELECT er.*, wo.work_order_number, wo.description, c.customer_name
    FROM exemption_requests er
    JOIN work_orders wo ON er.work_order_id = wo.id
    JOIN contracts c ON wo.contract_id = c.id
    WHERE er.id = ?
  `).get(exemptionId);
  
  const slaResult = calculateSLA(exemption.work_order_id);
  
  res.json({
    exemption: updatedExemption,
    sla: slaResult
  });
});

module.exports = router;

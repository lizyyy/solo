const express = require('express');
const router = express.Router();
const { db } = require('../database');
const { calculateSLA, getWorkOrdersForSettlement } = require('../slaCalculator');
const { format } = require('date-fns');

function generateSettlementNumber(month, year) {
  const count = db.prepare(`
    SELECT COUNT(*) as count FROM settlements
    WHERE month = ? AND year = ?
  `).get(month, year);
  
  const paddedMonth = month.padStart(2, '0');
  const paddedCount = (count.count + 1).toString().padStart(3, '0');
  return `SETTLE-${year}${paddedMonth}-${paddedCount}`;
}

router.get('/', (req, res) => {
  const { month, year, status } = req.query;
  
  let sql = 'SELECT * FROM settlements WHERE 1=1';
  const params = [];
  
  if (month) {
    sql += ' AND month = ?';
    params.push(month);
  }
  
  if (year) {
    sql += ' AND year = ?';
    params.push(year);
  }
  
  if (status) {
    sql += ' AND status = ?';
    params.push(status);
  }
  
  sql += ' ORDER BY created_at DESC';
  
  const settlements = db.prepare(sql).all(...params);
  res.json(settlements);
});

router.get('/preview', (req, res) => {
  const { month, year } = req.query;
  
  if (!month || !year) {
    return res.status(400).json({ error: '缺少月份和年份参数' });
  }
  
  const workOrders = getWorkOrdersForSettlement(month, year);
  const workOrderDetails = workOrders.map(wo => {
    const sla = calculateSLA(wo.id);
    return {
      id: wo.id,
      work_order_number: wo.work_order_number,
      description: wo.description,
      contract_name: wo.contract_name,
      customer_name: wo.customer_name,
      status: wo.status,
      created_at: wo.created_at,
      sla
    };
  });
  
  let totalResponseFine = 0;
  let totalRepairFine = 0;
  let totalFine = 0;
  let totalExempted = 0;
  
  for (const wo of workOrderDetails) {
    if (wo.sla.responseSla) {
      totalResponseFine += wo.sla.responseSla.fine;
    }
    if (wo.sla.repairSla) {
      totalRepairFine += wo.sla.repairSla.fine;
    }
    totalFine += wo.sla.totalFine;
    totalExempted += wo.sla.approvedExemptionAmount;
  }
  
  const netFine = Math.max(0, totalFine - totalExempted);
  
  res.json({
    month,
    year,
    workOrders: workOrderDetails,
    summary: {
      totalResponseFine,
      totalRepairFine,
      totalFine,
      totalExempted,
      netFine
    }
  });
});

router.post('/', (req, res) => {
  const { month, year, created_by } = req.body;
  
  if (!month || !year) {
    return res.status(400).json({ error: '缺少月份和年份参数' });
  }
  
  const preview = db.prepare(`
    SELECT * FROM settlements WHERE month = ? AND year = ? AND status = 'draft'
  `).get(month, year);
  
  if (preview) {
    return res.status(400).json({ error: '该月份已有草稿结算单' });
  }
  
  const workOrders = getWorkOrdersForSettlement(month, year);
  
  let totalResponseFine = 0;
  let totalRepairFine = 0;
  let totalFine = 0;
  let totalExempted = 0;
  
  const transaction = db.transaction(() => {
    const settlementNumber = generateSettlementNumber(month, year);
    
    for (const wo of workOrders) {
      const sla = calculateSLA(wo.id);
      if (sla.responseSla) totalResponseFine += sla.responseSla.fine;
      if (sla.repairSla) totalRepairFine += sla.repairSla.fine;
      totalFine += sla.totalFine;
      totalExempted += sla.approvedExemptionAmount;
    }
    
    const netFine = Math.max(0, totalFine - totalExempted);
    
    const result = db.prepare(`
      INSERT INTO settlements (
        settlement_number, month, year, status,
        total_response_fine, total_repair_fine, total_fine,
        total_exempted, net_fine, created_by
      ) VALUES (?, ?, ?, 'draft', ?, ?, ?, ?, ?, ?)
    `).run(
      settlementNumber,
      month,
      year,
      totalResponseFine,
      totalRepairFine,
      totalFine,
      totalExempted,
      netFine,
      created_by || 'system'
    );
    
    const settlementId = result.lastInsertRowid;
    
    for (const wo of workOrders) {
      const sla = calculateSLA(wo.id);
      db.prepare(`
        INSERT INTO settlement_work_orders (
          settlement_id, work_order_id, response_fine, repair_fine, exempted_amount
        ) VALUES (?, ?, ?, ?, ?)
      `).run(
        settlementId,
        wo.id,
        sla.responseSla?.fine || 0,
        sla.repairSla?.fine || 0,
        sla.approvedExemptionAmount
      );
    }
    
    return settlementId;
  });
  
  const settlementId = transaction();
  
  const settlement = db.prepare('SELECT * FROM settlements WHERE id = ?').get(settlementId);
  const workOrderDetails = db.prepare(`
    SELECT swo.*, wo.work_order_number, wo.description, c.customer_name
    FROM settlement_work_orders swo
    JOIN work_orders wo ON swo.work_order_id = wo.id
    JOIN contracts c ON wo.contract_id = c.id
    WHERE swo.settlement_id = ?
  `).all(settlementId);
  
  res.status(201).json({
    ...settlement,
    workOrders: workOrderDetails
  });
});

router.post('/:id/submit', (req, res) => {
  const settlementId = req.params.id;
  const { submitted_by } = req.body;
  
  const settlement = db.prepare('SELECT * FROM settlements WHERE id = ?').get(settlementId);
  if (!settlement) {
    return res.status(404).json({ error: '结算单不存在' });
  }
  
  if (settlement.status !== 'draft') {
    return res.status(400).json({ error: '只能提交草稿状态的结算单' });
  }
  
  const transaction = db.transaction(() => {
    db.prepare(`
      UPDATE settlements SET status = 'submitted' WHERE id = ?
    `).run(settlementId);
    
    const workOrderIds = db.prepare(`
      SELECT work_order_id FROM settlement_work_orders WHERE settlement_id = ?
    `).all(settlementId).map(row => row.work_order_id);
    
    for (const woId of workOrderIds) {
      db.prepare(`
        UPDATE work_orders SET is_settled = 1, settled_at = CURRENT_TIMESTAMP WHERE id = ?
      `).run(woId);
    }
  });
  
  transaction();
  
  const updatedSettlement = db.prepare('SELECT * FROM settlements WHERE id = ?').get(settlementId);
  res.json(updatedSettlement);
});

router.get('/:id/workorders', (req, res) => {
  const settlementId = req.params.id;
  
  const workOrderDetails = db.prepare(`
    SELECT swo.*, wo.work_order_number, wo.description, c.customer_name, c.name as contract_name
    FROM settlement_work_orders swo
    JOIN work_orders wo ON swo.work_order_id = wo.id
    JOIN contracts c ON wo.contract_id = c.id
    WHERE swo.settlement_id = ?
  `).all(settlementId);
  
  const result = workOrderDetails.map(detail => {
    const sla = calculateSLA(detail.work_order_id);
    return {
      ...detail,
      sla
    };
  });
  
  res.json(result);
});

router.get('/:id/export', (req, res) => {
  const settlementId = req.params.id;
  
  const settlement = db.prepare('SELECT * FROM settlements WHERE id = ?').get(settlementId);
  if (!settlement) {
    return res.status(404).json({ error: '结算单不存在' });
  }
  
  const workOrders = db.prepare(`
    SELECT swo.*, wo.work_order_number, wo.description, c.customer_name, c.name as contract_name
    FROM settlement_work_orders swo
    JOIN work_orders wo ON swo.work_order_id = wo.id
    JOIN contracts c ON wo.contract_id = c.id
    WHERE swo.settlement_id = ?
  `).all(settlementId);
  
  const workOrderDetails = workOrders.map(detail => {
    const sla = calculateSLA(detail.work_order_id);
    return {
      ...detail,
      sla
    };
  });
  
  const exportData = {
    settlement_number: settlement.settlement_number,
    month: settlement.month,
    year: settlement.year,
    status: settlement.status,
    summary: {
      total_response_fine: settlement.total_response_fine,
      total_repair_fine: settlement.total_repair_fine,
      total_fine: settlement.total_fine,
      total_exempted: settlement.total_exempted,
      net_fine: settlement.net_fine
    },
    work_orders: workOrderDetails
  };
  
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename=settlement-${settlement.settlement_number}.json`);
  res.json(exportData);
});

module.exports = router;

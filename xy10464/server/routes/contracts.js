const express = require('express');
const router = express.Router();
const { db } = require('../database');

router.get('/', (req, res) => {
  const contracts = db.prepare(`
    SELECT * FROM contracts ORDER BY created_at DESC
  `).all();
  res.json(contracts);
});

router.get('/:id', (req, res) => {
  const contract = db.prepare(`
    SELECT * FROM contracts WHERE id = ?
  `).get(req.params.id);
  
  if (!contract) {
    return res.status(404).json({ error: '合同不存在' });
  }
  
  res.json(contract);
});

router.post('/', (req, res) => {
  const {
    name,
    customer_name,
    contract_number,
    start_date,
    end_date,
    response_sla_hours,
    repair_sla_hours,
    response_fine_rate,
    repair_fine_rate,
    max_response_fine,
    max_repair_fine,
    max_total_fine
  } = req.body;
  
  if (!name || !customer_name || !contract_number || !start_date || !end_date) {
    return res.status(400).json({ error: '缺少必填字段' });
  }
  
  const result = db.prepare(`
    INSERT INTO contracts (
      name, customer_name, contract_number, start_date, end_date,
      response_sla_hours, repair_sla_hours, response_fine_rate, repair_fine_rate,
      max_response_fine, max_repair_fine, max_total_fine
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    name,
    customer_name,
    contract_number,
    start_date,
    end_date,
    response_sla_hours || 4,
    repair_sla_hours || 8,
    response_fine_rate || 50,
    repair_fine_rate || 80,
    max_response_fine,
    max_repair_fine,
    max_total_fine
  );
  
  const contract = db.prepare('SELECT * FROM contracts WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(contract);
});

router.put('/:id', (req, res) => {
  const contract = db.prepare('SELECT * FROM contracts WHERE id = ?').get(req.params.id);
  if (!contract) {
    return res.status(404).json({ error: '合同不存在' });
  }
  
  const {
    name,
    customer_name,
    contract_number,
    start_date,
    end_date,
    response_sla_hours,
    repair_sla_hours,
    response_fine_rate,
    repair_fine_rate,
    max_response_fine,
    max_repair_fine,
    max_total_fine
  } = req.body;
  
  db.prepare(`
    UPDATE contracts SET
      name = COALESCE(?, name),
      customer_name = COALESCE(?, customer_name),
      contract_number = COALESCE(?, contract_number),
      start_date = COALESCE(?, start_date),
      end_date = COALESCE(?, end_date),
      response_sla_hours = COALESCE(?, response_sla_hours),
      repair_sla_hours = COALESCE(?, repair_sla_hours),
      response_fine_rate = COALESCE(?, response_fine_rate),
      repair_fine_rate = COALESCE(?, repair_fine_rate),
      max_response_fine = ?,
      max_repair_fine = ?,
      max_total_fine = ?,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(
    name,
    customer_name,
    contract_number,
    start_date,
    end_date,
    response_sla_hours,
    repair_sla_hours,
    response_fine_rate,
    repair_fine_rate,
    max_response_fine,
    max_repair_fine,
    max_total_fine,
    req.params.id
  );
  
  const updatedContract = db.prepare('SELECT * FROM contracts WHERE id = ?').get(req.params.id);
  res.json(updatedContract);
});

router.delete('/:id', (req, res) => {
  const contract = db.prepare('SELECT * FROM contracts WHERE id = ?').get(req.params.id);
  if (!contract) {
    return res.status(404).json({ error: '合同不存在' });
  }
  
  const workOrders = db.prepare('SELECT COUNT(*) as count FROM work_orders WHERE contract_id = ?').get(req.params.id);
  if (workOrders && workOrders.count > 0) {
    return res.status(400).json({ error: '该合同有关联工单，无法删除' });
  }
  
  db.prepare('DELETE FROM contracts WHERE id = ?').run(req.params.id);
  res.json({ message: '删除成功' });
});

module.exports = router;

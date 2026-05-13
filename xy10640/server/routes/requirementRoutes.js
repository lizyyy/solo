const express = require('express');
const router = express.Router();
const { get, run, all } = require('../database/db');
const TimelineService = require('../services/timelineService');

router.post('/', async (req, res) => {
  try {
    const { customer_name, customer_phone, address, service_type, requirements, budget_min, budget_max } = req.body;
    const reqId = `REQ-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
    
    await run(
      `INSERT INTO customer_requirements 
       (req_id, customer_name, customer_phone, address, service_type, requirements, budget_min, budget_max) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [reqId, customer_name, customer_phone, address, service_type, requirements, budget_min, budget_max]
    );

    await TimelineService.record(
      'requirement_create',
      'requirement',
      reqId,
      'success',
      'success',
      `创建客户需求: ${customer_name}`,
      req.body.operator || 'system',
      { customer_name, service_type }
    );

    res.json({ success: true, req_id: reqId });
  } catch (err) {
    await TimelineService.record(
      'requirement_create',
      'requirement',
      null,
      'failed',
      'failed',
      '创建客户需求失败',
      'system',
      req.body,
      err.message
    );
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/', async (req, res) => {
  try {
    const { status, service_type, keyword, limit, offset } = req.query;
    let sql = 'SELECT * FROM customer_requirements WHERE 1=1';
    const params = [];

    if (status) {
      sql += ' AND status = ?';
      params.push(status);
    }

    if (service_type) {
      sql += ' AND service_type = ?';
      params.push(service_type);
    }

    if (keyword) {
      sql += ' AND (customer_name LIKE ? OR customer_phone LIKE ?)';
      params.push(`%${keyword}%`, `%${keyword}%`);
    }

    sql += ' ORDER BY created_at DESC';

    if (limit) {
      sql += ' LIMIT ? OFFSET ?';
      params.push(parseInt(limit), parseInt(offset) || 0);
    }

    const requirements = await all(sql, params);
    res.json({ success: true, data: requirements });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/:reqId', async (req, res) => {
  try {
    const requirement = await get('SELECT * FROM customer_requirements WHERE req_id = ?', [req.params.reqId]);
    if (!requirement) {
      return res.status(404).json({ success: false, error: '客户需求不存在' });
    }
    res.json({ success: true, data: requirement });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.put('/:reqId', async (req, res) => {
  try {
    const { customer_name, customer_phone, address, service_type, requirements, budget_min, budget_max, status } = req.body;
    await run(
      `UPDATE customer_requirements 
       SET customer_name = ?, customer_phone = ?, address = ?, service_type = ?, requirements = ?, budget_min = ?, budget_max = ?, status = ?, updated_at = CURRENT_TIMESTAMP
       WHERE req_id = ?`,
      [customer_name, customer_phone, address, service_type, requirements, budget_min, budget_max, status, req.params.reqId]
    );

    await TimelineService.record(
      'requirement_update',
      'requirement',
      req.params.reqId,
      'success',
      'success',
      `更新客户需求: ${customer_name}`,
      req.body.operator || 'system',
      req.body
    );

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
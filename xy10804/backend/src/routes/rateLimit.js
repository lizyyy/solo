const express = require('express');
const router = express.Router();
const RateLimitService = require('../services/rateLimitService');
const BillingService = require('../services/billingService');
const db = require('../models/database');

router.post('/record', async (req, res) => {
  try {
    const { tenant_id, api_group_id, window_size } = req.body;
    if (!tenant_id || !api_group_id) {
      return res.status(400).json({ error: '租户ID和接口分组ID不能为空' });
    }
    const result = await RateLimitService.recordCall(tenant_id, api_group_id, window_size || 60);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/compensate', async (req, res) => {
  try {
    const { tenant_id, api_group_id, amount, reason, operator, rate_limit_event_id } = req.body;
    if (!tenant_id || !api_group_id || !amount || !reason || !operator) {
      return res.status(400).json({ error: '必填参数缺失' });
    }
    if (amount <= 0) {
      return res.status(400).json({ error: '补偿额度必须大于0' });
    }
    const result = await RateLimitService.compensateQuota(
      tenant_id, api_group_id, amount, reason, operator, rate_limit_event_id
    );
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/events', (req, res) => {
  const { tenant_id, resolved, limit = 50 } = req.query;
  let query = `
    SELECT rle.*, t.name as tenant_name, ag.name as api_group_name
    FROM rate_limit_events rle
    LEFT JOIN tenants t ON rle.tenant_id = t.id
    LEFT JOIN api_groups ag ON rle.api_group_id = ag.id
  `;
  const params = [];
  const conditions = [];
  
  if (tenant_id) {
    conditions.push('rle.tenant_id = ?');
    params.push(tenant_id);
  }
  if (resolved !== undefined) {
    conditions.push('rle.resolved = ?');
    params.push(resolved === 'true' ? 1 : 0);
  }
  
  if (conditions.length > 0) {
    query += ' WHERE ' + conditions.join(' AND ');
  }
  query += ' ORDER BY rle.triggered_at DESC LIMIT ?';
  params.push(parseInt(limit));
  
  db.all(query, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

router.get('/events/:id', (req, res) => {
  db.get(`
    SELECT rle.*, t.name as tenant_name, ag.name as api_group_name
    FROM rate_limit_events rle
    LEFT JOIN tenants t ON rle.tenant_id = t.id
    LEFT JOIN api_groups ag ON rle.api_group_id = ag.id
    WHERE rle.id = ?
  `, [req.params.id], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!row) return res.status(404).json({ error: '限流事件不存在' });
    res.json(row);
  });
});

router.put('/events/:id/resolve', (req, res) => {
  const { operator } = req.body;
  if (!operator) {
    return res.status(400).json({ error: '操作人不能为空' });
  }
  db.run(`
    UPDATE rate_limit_events
    SET resolved = 1, resolved_at = CURRENT_TIMESTAMP, resolved_by = ?
    WHERE id = ?
  `, [operator, req.params.id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    if (this.changes === 0) return res.status(404).json({ error: '限流事件不存在' });
    res.json({ id: req.params.id, resolved: true, resolved_by: operator });
  });
});

router.get('/compensations', (req, res) => {
  const { tenant_id, limit = 50 } = req.query;
  let query = `
    SELECT cr.*, t.name as tenant_name, ag.name as api_group_name
    FROM compensation_records cr
    LEFT JOIN tenants t ON cr.tenant_id = t.id
    LEFT JOIN api_groups ag ON cr.api_group_id = ag.id
  `;
  const params = [];
  
  if (tenant_id) {
    query += ' WHERE cr.tenant_id = ?';
    params.push(tenant_id);
  }
  query += ' ORDER BY cr.created_at DESC LIMIT ?';
  params.push(parseInt(limit));
  
  db.all(query, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

router.post('/billing/generate', async (req, res) => {
  try {
    const { tenant_id, period_type } = req.body;
    if (!tenant_id) {
      return res.status(400).json({ error: '租户ID不能为空' });
    }
    const result = await BillingService.generateBillingSummary(tenant_id, period_type || 'monthly');
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/billing/export/:id', async (req, res) => {
  try {
    const result = await BillingService.exportBillingToCSV(req.params.id);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="billing-${req.params.id}.csv"`);
    res.send(result.csv);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/billing', async (req, res) => {
  try {
    const { tenant_id } = req.query;
    const result = await BillingService.getBillingSummaries(tenant_id);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/overview', (req, res) => {
  db.serialize(() => {
    const result = {};
    
    db.get(`SELECT COUNT(*) as total_tenants FROM tenants`, (err, row) => {
      Object.assign(result, row);
    });
    
    db.get(`SELECT COUNT(*) as pending_events FROM rate_limit_events WHERE resolved = 0`, (err, row) => {
      Object.assign(result, row);
    });
    
    db.get(`SELECT COUNT(*) as total_events_today FROM rate_limit_events WHERE DATE(triggered_at) = DATE('now')`, (err, row) => {
      Object.assign(result, row);
    });
    
    db.get(`SELECT SUM(amount) as total_compensation FROM compensation_records`, (err, row) => {
      result.total_compensation = row.total_compensation || 0;
      res.json(result);
    });
  });
});

module.exports = router;

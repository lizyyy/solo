const express = require('express');
const router = express.Router();
const db = require('../models/database');
const { v4: uuidv4 } = require('uuid');

router.post('/', (req, res) => {
  const { tenant_id, api_group_id, daily_quota, monthly_quota } = req.body;
  if (!tenant_id || !api_group_id) {
    return res.status(400).json({ error: '租户ID和接口分组ID不能为空' });
  }
  const daily = daily_quota || 1000;
  const monthly = monthly_quota || 30000;
  const id = uuidv4();
  
  db.run(`
    INSERT INTO tenant_quotas (id, tenant_id, api_group_id, daily_quota, monthly_quota, remaining_daily, remaining_monthly)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `, [id, tenant_id, api_group_id, daily, monthly, daily, monthly], function(err) {
    if (err) {
      if (err.message.includes('UNIQUE constraint')) {
        return res.status(409).json({ error: '该租户配额已配置' });
      }
      return res.status(500).json({ error: err.message });
    }
    res.status(201).json({ id, tenant_id, api_group_id, daily_quota: daily, monthly_quota: monthly, remaining_daily: daily, remaining_monthly: monthly });
  });
});

router.get('/', (req, res) => {
  db.all(`
    SELECT tq.*, t.name as tenant_name, ag.name as api_group_name
    FROM tenant_quotas tq
    LEFT JOIN tenants t ON tq.tenant_id = t.id
    LEFT JOIN api_groups ag ON tq.api_group_id = ag.id
    ORDER BY tq.updated_at DESC
  `, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

router.get('/tenant/:tenantId', (req, res) => {
  db.all(`
    SELECT tq.*, ag.name as api_group_name
    FROM tenant_quotas tq
    LEFT JOIN api_groups ag ON tq.api_group_id = ag.id
    WHERE tq.tenant_id = ?
    ORDER BY tq.updated_at DESC
  `, [req.params.tenantId], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

module.exports = router;

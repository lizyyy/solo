const express = require('express');
const { db, initDB } = require('./src/db');
const engine = require('./src/quota-engine');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

initDB();

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'saas-quota-api', version: '1.0.0' });
});

app.post('/api/tenants', (req, res) => {
  const { id, name, planId = 'free' } = req.body;

  if (!id || !name) {
    return res.status(400).json({
      success: false,
      error: 'INVALID_PARAMS',
      message: '租户 ID 和名称为必填'
    });
  }

  const existing = db.prepare('SELECT id FROM tenants WHERE id = ?').get(id);
  if (existing) {
    return res.status(409).json({
      success: false,
      error: 'TENANT_EXISTS',
      message: `租户 ${id} 已存在`
    });
  }

  const plan = db.prepare('SELECT * FROM plans WHERE id = ?').get(planId);
  if (!plan) {
    return res.status(400).json({
      success: false,
      error: 'PLAN_NOT_FOUND',
      message: `套餐 ${planId} 不存在`
    });
  }

  const now = new Date().toISOString().slice(0, 19).replace('T', ' ');

  db.prepare(`
    INSERT INTO tenants (id, name, status, current_plan_id, plan_effective_at)
    VALUES (?, ?, 'active', ?, ?)
  `).run(id, name, planId, now);

  db.prepare(`
    INSERT INTO plan_history (tenant_id, old_plan_id, new_plan_id, effective_at, reason, operator)
    VALUES (?, NULL, ?, ?, '初始开通', 'system')
  `).run(id, planId, now);

  const ledger = engine.getQuotaLedger(id);

  res.status(201).json({
    success: true,
    tenant: {
      id,
      name,
      status: 'active',
      currentPlan: {
        id: planId,
        name: plan.name,
        effectiveAt: now
      }
    },
    ledger
  });
});

app.get('/api/tenants/:id', (req, res) => {
  const tenant = engine.getTenantWithPlan(req.params.id);
  if (!tenant) {
    return res.status(404).json({
      success: false,
      error: 'TENANT_NOT_FOUND',
      message: `租户不存在: ${req.params.id}`
    });
  }
  res.json({ success: true, tenant });
});

app.get('/api/tenants/:id/ledger', (req, res) => {
  try {
    const ledger = engine.getQuotaLedger(req.params.id);
    res.json({ success: true, ledger });
  } catch (e) {
    res.status(404).json({ success: false, error: 'TENANT_NOT_FOUND', message: e.message });
  }
});

app.post('/api/tenants/:id/usage', (req, res) => {
  const { resourceType, amount, usageDate, requestId, source, operator } = req.body;

  if (!resourceType || amount === undefined) {
    return res.status(400).json({
      success: false,
      error: 'INVALID_PARAMS',
      message: 'resourceType 和 amount 为必填'
    });
  }

  const result = engine.recordUsage(
    req.params.id,
    resourceType,
    amount,
    usageDate,
    requestId,
    source || 'api',
    operator || 'system'
  );

  if (!result.success) {
    const status = result.error === 'TENANT_NOT_FOUND' ? 404 : 400;
    return res.status(status).json(result);
  }

  if (result.idempotent) {
    return res.status(200).json(result);
  }

  res.status(201).json(result);
});

app.post('/api/tenants/:id/plan', (req, res) => {
  const { planId, reason, operator } = req.body;

  if (!planId) {
    return res.status(400).json({
      success: false,
      error: 'INVALID_PARAMS',
      message: 'planId 为必填'
    });
  }

  const result = engine.changePlan(req.params.id, planId, reason, operator || 'system');

  if (!result.success) {
    const status = result.error === 'TENANT_NOT_FOUND' || result.error === 'PLAN_NOT_FOUND' ? 404 : 400;
    return res.status(status).json(result);
  }

  res.json(result);
});

app.post('/api/tenants/:id/addons', (req, res) => {
  const { type, amount, effectiveDays, expiresDays, source, operator } = req.body;

  if (!type || amount === undefined) {
    return res.status(400).json({
      success: false,
      error: 'INVALID_PARAMS',
      message: 'type 和 amount 为必填'
    });
  }

  const result = engine.addAddon(
    req.params.id,
    type,
    amount,
    effectiveDays,
    expiresDays,
    source || 'purchase',
    operator || 'system'
  );

  if (!result.success) {
    const status = result.error === 'TENANT_NOT_FOUND' ? 404 : 400;
    return res.status(status).json(result);
  }

  res.status(201).json(result);
});

app.post('/api/tenants/:id/freeze', (req, res) => {
  const { reason, operator } = req.body;
  const result = engine.freezeTenant(req.params.id, reason || '人工冻结', operator || 'system');

  if (!result.success) {
    return res.status(404).json(result);
  }
  res.json(result);
});

app.post('/api/tenants/:id/unfreeze', (req, res) => {
  const { reason, operator } = req.body;
  const result = engine.unfreezeTenant(req.params.id, reason || '人工解冻', operator || 'system');

  if (!result.success) {
    return res.status(404).json(result);
  }
  res.json(result);
});

app.post('/api/tenants/:id/correction', (req, res) => {
  const { resourceType, correction, reason, operator } = req.body;

  if (!resourceType || correction === undefined || !operator) {
    return res.status(400).json({
      success: false,
      error: 'INVALID_PARAMS',
      message: 'resourceType、correction 和 operator 为必填'
    });
  }

  const result = engine.manualCorrection(req.params.id, resourceType, correction, reason, operator);

  if (!result.success) {
    const status = result.error === 'TENANT_NOT_FOUND' ? 404 : 400;
    return res.status(status).json(result);
  }

  res.json(result);
});

app.get('/api/tenants/:id/history', (req, res) => {
  const tenant = engine.getTenantWithPlan(req.params.id);
  if (!tenant) {
    return res.status(404).json({
      success: false,
      error: 'TENANT_NOT_FOUND',
      message: `租户不存在: ${req.params.id}`
    });
  }

  const history = engine.getHistory(req.params.id);
  res.json({ success: true, history });
});

app.get('/api/tenants/:id/report/daily', (req, res) => {
  const { from, to } = req.query;

  if (!from || !to) {
    return res.status(400).json({
      success: false,
      error: 'INVALID_PARAMS',
      message: 'from 和 to 日期参数为必填（格式: YYYY-MM-DD）'
    });
  }

  const result = engine.generateDailyReport(req.params.id, from, to);

  if (!result.success) {
    return res.status(404).json(result);
  }

  const format = req.query.format || 'json';

  if (format === 'csv') {
    const lines = ['tenant_id,tenant_name,resource_type,date,amount,quota_plan,quota_addon,quota_total,overage'];
    for (const [resourceType, data] of Object.entries(result.report.resources)) {
      for (const d of data.dailyUsage) {
        lines.push([
          result.report.tenantId,
          result.report.tenantName,
          resourceType,
          d.date,
          d.amount,
          data.quota.plan,
          data.quota.addon,
          data.quota.total,
          data.currentLedger.overage
        ].join(','));
      }
    }
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="quota-report-${req.params.id}.csv"`);
    return res.send(lines.join('\n'));
  }

  res.json(result);
});

app.get('/api/plans', (req, res) => {
  const plans = db.prepare('SELECT * FROM plans WHERE is_active = 1 ORDER BY tier ASC').all();
  res.json({ success: true, plans });
});

app.listen(PORT, () => {
  console.log(`\n====================================================`);
  console.log(`  SaaS 租户配额超用 API 已启动`);
  console.log(`  服务端口: ${PORT}`);
  console.log(`  健康检查: http://localhost:${PORT}/health`);
  console.log(`  套餐列表: http://localhost:${PORT}/api/plans`);
  console.log(`====================================================`);
  console.log(`\n  快速开始:`);
  console.log(`  1. 创建租户:  curl -X POST http://localhost:${PORT}/api/tenants -H "Content-Type: application/json" -d '{"id":"demo-01","name":"演示租户","planId":"starter"}'`);
  console.log(`  2. 查看账本:  curl http://localhost:${PORT}/api/tenants/demo-01/ledger`);
  console.log(`  3. 上报用量:  curl -X POST http://localhost:${PORT}/api/tenants/demo-01/usage -H "Content-Type: application/json" -d '{"resourceType":"storage","amount":5000,"requestId":"req-001"}'`);
  console.log(`\n  执行完整演示: node scripts/demo-normal-flow.js`);
  console.log(`  执行失败路径: node scripts/demo-failure-flow.js`);
  console.log(`====================================================\n`);
});

module.exports = app;

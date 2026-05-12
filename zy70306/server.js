const express = require('express');
const crypto = require('crypto');
const dbModule = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

const VALID_ENVIRONMENTS = ['test', 'staging', 'production'];
const DUAL_WRITE_DURATION_MS = 2 * 60 * 60 * 1000;

let db = null;

function generateId() {
  return crypto.randomBytes(16).toString('hex');
}

function hashSecret(secret) {
  return crypto.createHash('sha256').update(secret).digest('hex');
}

function getCurrentKeyVersion(serviceId, environment) {
  return db.prepare(`
    SELECT * FROM key_versions 
    WHERE service_id = ? AND environment = ? AND is_active = 1
    ORDER BY created_at DESC LIMIT 1
  `).get(serviceId, environment);
}

function getPendingPlanForService(serviceId) {
  return db.prepare(`
    SELECT * FROM rotation_plans 
    WHERE service_id = ? AND status IN ('created', 'in_progress', 'dual_write', 'waiting_confirmation')
    ORDER BY created_at DESC LIMIT 1
  `).get(serviceId);
}

function getConsumersForEnvironment(serviceId, environment) {
  return db.prepare(`
    SELECT * FROM consumers WHERE service_id = ? AND environment = ?
  `).all(serviceId, environment);
}

function recordAudit(planId, action, actor, environment = null, details = null) {
  db.prepare(`
    INSERT INTO rotation_audits (plan_id, actor, action, environment, details, created_at)
    VALUES (?, ?, ?, ?, ?, datetime('now'))
  `).run(planId, actor, action, environment, details ? JSON.stringify(details) : null);
}

function addAuditEntry(planId, action, actor, environment, details, createdAt) {
  db.prepare(`
    INSERT INTO rotation_audits (plan_id, actor, action, environment, details, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    planId, 
    actor, 
    action, 
    environment, 
    details ? JSON.stringify(details) : null,
    createdAt
  );
}

app.post('/api/services', (req, res) => {
  const { id, name, description } = req.body;
  if (!name) {
    return res.status(400).json({ error: 'name is required' });
  }

  const serviceId = id || generateId();

  try {
    db.prepare(`
      INSERT INTO services (id, name, description, created_at) VALUES (?, ?, ?, datetime('now'))
    `).run(serviceId, name, description || null);

    res.status(201).json({
      id: serviceId,
      name,
      description: description || null
    });
  } catch (e) {
    if (e.message && e.message.includes('UNIQUE')) {
      return res.status(409).json({ error: 'Service name already exists' });
    }
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/services', (req, res) => {
  const services = db.prepare('SELECT * FROM services').all();
  res.json(services);
});

app.post('/api/services/:serviceId/key-versions', (req, res) => {
  const { serviceId } = req.params;
  const { environment, secret } = req.body;

  if (!environment || !VALID_ENVIRONMENTS.includes(environment)) {
    return res.status(400).json({ error: 'Valid environment is required' });
  }
  if (!secret) {
    return res.status(400).json({ error: 'secret is required' });
  }

  const service = db.prepare('SELECT * FROM services WHERE id = ?').get(serviceId);
  if (!service) {
    return res.status(404).json({ error: 'Service not found' });
  }

  const existingVersions = db.prepare(`
    SELECT version FROM key_versions WHERE service_id = ? AND environment = ?
    ORDER BY CAST(version AS INTEGER) DESC LIMIT 1
  `).get(serviceId, environment);

  const nextVersion = existingVersions ? String(parseInt(existingVersions.version) + 1) : '1';
  const keyVersionId = generateId();
  const secretHash = hashSecret(secret);

  db.prepare(`
    INSERT INTO key_versions (id, service_id, environment, version, secret_hash, is_active, created_at)
    VALUES (?, ?, ?, ?, ?, 0, datetime('now'))
  `).run(keyVersionId, serviceId, environment, nextVersion, secretHash);

  res.status(201).json({
    id: keyVersionId,
    service_id: serviceId,
    environment,
    version: nextVersion,
    is_active: false
  });
});

app.post('/api/rotation-plans', (req, res) => {
  const { service_id, target_key_version_id } = req.body;
  const actor = req.body.actor || 'system';

  if (!service_id || !target_key_version_id) {
    return res.status(400).json({ error: 'service_id and target_key_version_id are required' });
  }

  const service = db.prepare('SELECT * FROM services WHERE id = ?').get(service_id);
  if (!service) {
    return res.status(404).json({ error: 'Service not found' });
  }

  const pendingPlan = getPendingPlanForService(service_id);
  if (pendingPlan) {
    return res.status(409).json({ 
      error: 'Service already has an active rotation plan',
      active_plan_id: pendingPlan.id 
    });
  }

  const targetKey = db.prepare('SELECT * FROM key_versions WHERE id = ?').get(target_key_version_id);
  if (!targetKey) {
    return res.status(404).json({ error: 'Target key version not found' });
  }
  if (targetKey.service_id !== service_id) {
    return res.status(400).json({ error: 'Target key does not belong to this service' });
  }

  const currentKey = getCurrentKeyVersion(service_id, targetKey.environment);
  if (!currentKey) {
    return res.status(400).json({ error: 'Service has no active key. First activate a key version before creating a rotation plan.' });
  }

  const planId = generateId();
  
  try {
    dbModule.transaction(() => {
      db.prepare(`
        INSERT INTO rotation_plans (id, service_id, target_key_version_id, status, created_at)
        VALUES (?, ?, ?, 'created', datetime('now'))
      `).run(planId, service_id, target_key_version_id);

      db.prepare(`
        INSERT INTO environment_progress (plan_id, environment, status)
        VALUES (?, ?, 'pending')
      `).run(planId, targetKey.environment);

      recordAudit(planId, 'plan_created', actor, targetKey.environment, {
        target_key_version_id,
        current_key_version_id: currentKey.id
      });
    });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }

  res.status(201).json({
    id: planId,
    service_id,
    target_key_version_id,
    status: 'created'
  });
});

app.post('/api/rotation-plans/:planId/start', (req, res) => {
  const { planId } = req.params;
  const actor = req.body.actor || 'system';

  const plan = db.prepare('SELECT * FROM rotation_plans WHERE id = ?').get(planId);
  if (!plan) {
    return res.status(404).json({ error: 'Plan not found' });
  }

  if (plan.status !== 'created') {
    return res.status(400).json({ error: `Cannot start plan in status: ${plan.status}` });
  }

  const targetKey = db.prepare('SELECT * FROM key_versions WHERE id = ?').get(plan.target_key_version_id);
  const environment = targetKey.environment;

  if (environment === 'production') {
    const approval = db.prepare(`
      SELECT * FROM approvals WHERE plan_id = ? AND environment = ?
    `).get(planId, environment);
    
    if (!approval) {
      return res.status(403).json({ 
        error: 'Production environment requires approval before starting rotation' 
      });
    }
  }

  dbModule.transaction(() => {
    db.prepare(`
      UPDATE rotation_plans SET status = 'in_progress', started_at = datetime('now') WHERE id = ?
    `).run(planId);

    db.prepare(`
      UPDATE environment_progress SET status = 'in_progress' WHERE plan_id = ? AND environment = ?
    `).run(planId, environment);

    recordAudit(planId, 'plan_started', actor, environment);
  });

  res.json({
    id: planId,
    status: 'in_progress'
  });
});

app.post('/api/rotation-plans/:planId/approve', (req, res) => {
  const { planId } = req.params;
  const { approver, notes } = req.body;
  const actor = approver || req.body.actor || 'system';

  const plan = db.prepare('SELECT * FROM rotation_plans WHERE id = ?').get(planId);
  if (!plan) {
    return res.status(404).json({ error: 'Plan not found' });
  }

  const targetKey = db.prepare('SELECT * FROM key_versions WHERE id = ?').get(plan.target_key_version_id);
  const environment = targetKey.environment;

  if (environment !== 'production') {
    return res.status(400).json({ error: 'Only production environment requires approval' });
  }

  try {
    db.prepare(`
      INSERT INTO approvals (plan_id, environment, approver, notes, approved_at)
      VALUES (?, ?, ?, ?, datetime('now'))
    `).run(planId, environment, approver || null, notes || null);

    recordAudit(planId, 'approved', actor, environment, { approver, notes });

    res.json({
      plan_id: planId,
      environment,
      approved: true,
      approver
    });
  } catch (e) {
    if (e.message && e.message.includes('UNIQUE')) {
      return res.status(409).json({ error: 'Plan already approved for this environment' });
    }
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/rotation-plans/:planId/dual-write', (req, res) => {
  const { planId } = req.params;
  const actor = req.body.actor || 'system';

  const plan = db.prepare('SELECT * FROM rotation_plans WHERE id = ?').get(planId);
  if (!plan) {
    return res.status(404).json({ error: 'Plan not found' });
  }

  if (plan.status !== 'in_progress') {
    return res.status(400).json({ error: `Cannot enter dual-write from status: ${plan.status}` });
  }

  const targetKey = db.prepare('SELECT * FROM key_versions WHERE id = ?').get(plan.target_key_version_id);
  const environment = targetKey.environment;

  dbModule.transaction(() => {
    db.prepare(`
      UPDATE rotation_plans SET status = 'dual_write' WHERE id = ?
    `).run(planId);

    db.prepare(`
      UPDATE environment_progress 
      SET status = 'dual_write', dual_write_started_at = datetime('now') 
      WHERE plan_id = ? AND environment = ?
    `).run(planId, environment);

    recordAudit(planId, 'entered_dual_write', actor, environment);
  });

  res.json({
    id: planId,
    status: 'dual_write',
    environment
  });
});

app.post('/api/rotation-plans/:planId/consumers/:consumerId/confirm', (req, res) => {
  const { planId, consumerId } = req.params;
  const actor = req.body.actor || 'system';

  const plan = db.prepare('SELECT * FROM rotation_plans WHERE id = ?').get(planId);
  if (!plan) {
    return res.status(404).json({ error: 'Plan not found' });
  }

  if (!['dual_write', 'waiting_confirmation'].includes(plan.status)) {
    return res.status(400).json({ 
      error: `Cannot confirm in status: ${plan.status}. Must be in dual_write or waiting_confirmation.` 
    });
  }

  const targetKey = db.prepare('SELECT * FROM key_versions WHERE id = ?').get(plan.target_key_version_id);
  const environment = targetKey.environment;

  const consumer = db.prepare('SELECT * FROM consumers WHERE id = ?').get(consumerId);
  if (!consumer) {
    return res.status(404).json({ error: 'Consumer not found' });
  }
  if (consumer.service_id !== plan.service_id || consumer.environment !== environment) {
    return res.status(400).json({ error: 'Consumer does not belong to this plan environment' });
  }

  const existingConfirmation = db.prepare(`
    SELECT * FROM consumer_confirmations 
    WHERE plan_id = ? AND consumer_id = ? AND environment = ?
  `).get(planId, consumerId, environment);

  if (existingConfirmation) {
    return res.json({
      plan_id: planId,
      consumer_id: consumerId,
      environment,
      confirmed: true,
      already_confirmed: true,
      confirmed_at: existingConfirmation.confirmed_at
    });
  }

  dbModule.transaction(() => {
    db.prepare(`
      INSERT INTO consumer_confirmations (plan_id, consumer_id, environment, confirmed_at)
      VALUES (?, ?, ?, datetime('now'))
    `).run(planId, consumerId, environment);

    recordAudit(planId, 'consumer_confirmed', actor, environment, { 
      consumer_id: consumerId,
      consumer_name: consumer.name 
    });
  });

  res.status(201).json({
    plan_id: planId,
    consumer_id: consumerId,
    environment,
    confirmed: true
  });
});

app.post('/api/rotation-plans/:planId/switch', (req, res) => {
  const { planId } = req.params;
  const actor = req.body.actor || 'system';

  const plan = db.prepare('SELECT * FROM rotation_plans WHERE id = ?').get(planId);
  if (!plan) {
    return res.status(404).json({ error: 'Plan not found' });
  }

  if (!['dual_write', 'waiting_confirmation'].includes(plan.status)) {
    return res.status(400).json({ 
      error: `Cannot switch from status: ${plan.status}` 
    });
  }

  const targetKey = db.prepare('SELECT * FROM key_versions WHERE id = ?').get(plan.target_key_version_id);
  const environment = targetKey.environment;

  const envProgress = db.prepare(`
    SELECT * FROM environment_progress WHERE plan_id = ? AND environment = ?
  `).get(planId, environment);

  if (!envProgress.dual_write_started_at) {
    return res.status(400).json({ error: 'Dual write phase has not started yet' });
  }

  const dualWriteStartTime = new Date(envProgress.dual_write_started_at).getTime();
  const now = Date.now();
  const dualWriteElapsed = now - dualWriteStartTime;

  if (dualWriteElapsed < DUAL_WRITE_DURATION_MS) {
    db.prepare(`
      UPDATE rotation_plans SET status = 'waiting_confirmation' WHERE id = ?
    `).run(planId);

    return res.status(400).json({
      error: 'Dual write window has not expired yet',
      dual_write_started_at: envProgress.dual_write_started_at,
      elapsed_ms: dualWriteElapsed,
      required_ms: DUAL_WRITE_DURATION_MS,
      remaining_ms: DUAL_WRITE_DURATION_MS - dualWriteElapsed
    });
  }

  const consumers = getConsumersForEnvironment(plan.service_id, environment);
  const confirmations = db.prepare(`
    SELECT consumer_id FROM consumer_confirmations 
    WHERE plan_id = ? AND environment = ?
  `).all(planId, environment);

  const confirmedConsumerIds = new Set(confirmations.map(c => c.consumer_id));
  const unconfirmedConsumers = consumers.filter(c => !confirmedConsumerIds.has(c.id));

  if (unconfirmedConsumers.length > 0) {
    db.prepare(`
      UPDATE rotation_plans SET status = 'waiting_confirmation' WHERE id = ?
    `).run(planId);

    db.prepare(`
      UPDATE environment_progress SET status = 'waiting_confirmation' 
      WHERE plan_id = ? AND environment = ?
    `).run(planId, environment);

    return res.status(400).json({
      error: 'Not all consumers have confirmed the new key',
      unconfirmed_consumers: unconfirmedConsumers.map(c => ({ id: c.id, name: c.name }))
    });
  }

  dbModule.transaction(() => {
    const currentKey = getCurrentKeyVersion(plan.service_id, environment);
    if (currentKey) {
      db.prepare(`
        UPDATE key_versions SET is_active = 0 WHERE id = ?
      `).run(currentKey.id);
    }

    db.prepare(`
      UPDATE key_versions SET is_active = 1 WHERE id = ?
    `).run(plan.target_key_version_id);

    db.prepare(`
      UPDATE rotation_plans SET status = 'switched' WHERE id = ?
    `).run(planId);

    db.prepare(`
      UPDATE environment_progress 
      SET status = 'switched', switch_at = datetime('now') 
      WHERE plan_id = ? AND environment = ?
    `).run(planId, environment);

    recordAudit(planId, 'switched', actor, environment, {
      old_key_version_id: currentKey ? currentKey.id : null,
      new_key_version_id: plan.target_key_version_id
    });
  });

  res.json({
    id: planId,
    status: 'switched',
    environment,
    new_active_key_version_id: plan.target_key_version_id
  });
});

app.post('/api/rotation-plans/:planId/rollback', (req, res) => {
  const { planId } = req.params;
  const { reason } = req.body;
  const actor = req.body.actor || 'system';

  const plan = db.prepare('SELECT * FROM rotation_plans WHERE id = ?').get(planId);
  if (!plan) {
    return res.status(404).json({ error: 'Plan not found' });
  }

  if (plan.status === 'closed') {
    return res.status(400).json({ error: 'Cannot rollback a closed plan' });
  }

  if (plan.status === 'created') {
    return res.status(400).json({ error: 'Plan has not started yet. Use cancel instead.' });
  }

  const targetKey = db.prepare('SELECT * FROM key_versions WHERE id = ?').get(plan.target_key_version_id);
  const environment = targetKey.environment;

  dbModule.transaction(() => {
    db.prepare(`
      UPDATE key_versions SET is_active = 0 WHERE id = ?
    `).run(plan.target_key_version_id);

    db.prepare(`
      UPDATE rotation_plans SET status = 'rolled_back' WHERE id = ?
    `).run(planId);

    db.prepare(`
      UPDATE environment_progress 
      SET status = 'rolled_back', rollback_reason = ? 
      WHERE plan_id = ? AND environment = ?
    `).run(reason || null, planId, environment);

    recordAudit(planId, 'rolled_back', actor, environment, { reason });
  });

  res.json({
    id: planId,
    status: 'rolled_back',
    environment,
    reason
  });
});

app.post('/api/rotation-plans/:planId/close', (req, res) => {
  const { planId } = req.params;
  const actor = req.body.actor || 'system';

  const plan = db.prepare('SELECT * FROM rotation_plans WHERE id = ?').get(planId);
  if (!plan) {
    return res.status(404).json({ error: 'Plan not found' });
  }

  if (['closed', 'rolled_back'].includes(plan.status)) {
    return res.status(400).json({ error: `Plan already in final status: ${plan.status}` });
  }

  dbModule.transaction(() => {
    db.prepare(`
      UPDATE rotation_plans 
      SET status = 'closed', closed_at = datetime('now') 
      WHERE id = ?
    `).run(planId);

    recordAudit(planId, 'plan_closed', actor, null, { final_status: plan.status });
  });

  res.json({
    id: planId,
    status: 'closed'
  });
});

app.get('/api/rotation-plans/:planId', (req, res) => {
  const { planId } = req.params;

  const plan = db.prepare('SELECT * FROM rotation_plans WHERE id = ?').get(planId);
  if (!plan) {
    return res.status(404).json({ error: 'Plan not found' });
  }

  const service = db.prepare('SELECT * FROM services WHERE id = ?').get(plan.service_id);
  const targetKey = db.prepare('SELECT * FROM key_versions WHERE id = ?').get(plan.target_key_version_id);
  const currentKey = getCurrentKeyVersion(plan.service_id, targetKey.environment);

  const envProgress = db.prepare(`
    SELECT * FROM environment_progress WHERE plan_id = ?
  `).all(planId);

  const consumers = getConsumersForEnvironment(plan.service_id, targetKey.environment);
  const confirmations = db.prepare(`
    SELECT * FROM consumer_confirmations WHERE plan_id = ?
  `).all(planId);

  const confirmedConsumerIds = new Set(confirmations.map(c => c.consumer_id));
  const unconfirmedConsumers = consumers.filter(c => !confirmedConsumerIds.has(c.id));

  const audits = db.prepare(`
    SELECT * FROM rotation_audits WHERE plan_id = ? ORDER BY created_at ASC
  `).all(planId);

  const approval = db.prepare(`
    SELECT * FROM approvals WHERE plan_id = ? AND environment = ?
  `).get(planId, targetKey.environment);

  const envProgressDetails = envProgress.map(ep => {
    const envConsumers = getConsumersForEnvironment(plan.service_id, ep.environment);
    const envConfirmations = confirmations.filter(c => c.environment === ep.environment);
    const envConfirmedIds = new Set(envConfirmations.map(c => c.consumer_id));
    const envUnconfirmed = envConsumers.filter(c => !envConfirmedIds.has(c.id));

    return {
      environment: ep.environment,
      status: ep.status,
      dual_write_started_at: ep.dual_write_started_at,
      switch_at: ep.switch_at,
      rollback_reason: ep.rollback_reason,
      total_consumers: envConsumers.length,
      confirmed_consumers: envConfirmations.length,
      unconfirmed_consumers: envUnconfirmed.map(c => ({ id: c.id, name: c.name }))
    };
  });

  const hasMixedStatus = envProgress.length > 1 && 
    new Set(envProgress.map(ep => ep.status)).size > 1;

  res.json({
    id: plan.id,
    service: {
      id: service.id,
      name: service.name
    },
    target_key: {
      id: targetKey.id,
      environment: targetKey.environment,
      version: targetKey.version
    },
    current_active_key: currentKey ? {
      id: currentKey.id,
      version: currentKey.version
    } : null,
    overall_status: plan.status,
    has_mixed_environment_status: hasMixedStatus,
    environment_progress: envProgressDetails,
    unconfirmed_consumers: unconfirmedConsumers.map(c => ({ id: c.id, name: c.name })),
    approval: approval ? {
      approver: approval.approver,
      approved_at: approval.approved_at,
      notes: approval.notes
    } : null,
    audit_timeline: audits.map(a => ({
      action: a.action,
      actor: a.actor,
      environment: a.environment,
      details: a.details ? JSON.parse(a.details) : null,
      created_at: a.created_at
    })),
    timestamps: {
      created_at: plan.created_at,
      started_at: plan.started_at,
      closed_at: plan.closed_at
    }
  });
});

app.get('/api/services/:serviceId/current-key', (req, res) => {
  const { serviceId } = req.params;
  const { environment } = req.query;

  if (environment && !VALID_ENVIRONMENTS.includes(environment)) {
    return res.status(400).json({ error: 'Invalid environment' });
  }

  const service = db.prepare('SELECT * FROM services WHERE id = ?').get(serviceId);
  if (!service) {
    return res.status(404).json({ error: 'Service not found' });
  }

  if (environment) {
    const key = getCurrentKeyVersion(serviceId, environment);
    if (!key) {
      return res.status(404).json({ error: `No active key for ${environment}` });
    }
    return res.json({
      service_id: serviceId,
      environment,
      key_version: {
        id: key.id,
        version: key.version,
        created_at: key.created_at
      }
    });
  }

  const keys = db.prepare(`
    SELECT * FROM key_versions 
    WHERE service_id = ? AND is_active = 1
  `).all(serviceId);

  res.json({
    service_id: serviceId,
    active_keys: keys.map(k => ({
      id: k.id,
      environment: k.environment,
      version: k.version,
      created_at: k.created_at
    }))
  });
});

app.post('/api/seed-test-data', (req, res) => {
  const actor = req.body.actor || 'seed-script';

  const seedPlan1 = (planType) => {
    if (planType === 'normal') {
      const k1Id = generateId();
      db.prepare(`
        INSERT OR IGNORE INTO key_versions (id, service_id, environment, version, secret_hash, is_active, created_at)
        VALUES (?, 'test-service', 'test', '1', ?, 1, datetime('now', '-1 day'))
      `).run(k1Id, hashSecret('old-test-secret-123'));

      const k2Id = generateId();
      db.prepare(`
        INSERT INTO key_versions (id, service_id, environment, version, secret_hash, is_active, created_at)
        VALUES (?, 'test-service', 'test', '2', ?, 0, datetime('now', '-6 hours'))
      `).run(k2Id, hashSecret('new-test-secret-456'));

      const planId = generateId();
      db.prepare(`
        INSERT INTO rotation_plans (id, service_id, target_key_version_id, status, created_at, started_at)
        VALUES (?, 'test-service', ?, 'dual_write', datetime('now', '-5 hours'), datetime('now', '-4.5 hours'))
      `).run(planId, k2Id);

      db.prepare(`
        INSERT INTO environment_progress (plan_id, environment, status, dual_write_started_at)
        VALUES (?, 'test', 'dual_write', datetime('now', '-4 hours'))
      `).run(planId);

      const consumers = db.prepare(`
        SELECT * FROM consumers WHERE service_id = 'test-service' AND environment = 'test'
      `).all();

      consumers.forEach(c => {
        db.prepare(`
          INSERT INTO consumer_confirmations (plan_id, consumer_id, environment, confirmed_at)
          VALUES (?, ?, 'test', datetime('now', '-3.5 hours'))
        `).run(planId, c.id);
      });

      addAuditEntry(planId, 'plan_created', actor, 'test', null, '2026-05-12 09:00:00');
      addAuditEntry(planId, 'plan_started', actor, 'test', null, '2026-05-12 09:30:00');
      addAuditEntry(planId, 'entered_dual_write', actor, 'test', null, '2026-05-12 10:00:00');

      return { planId, type: 'normal_test_switch_ready', description: '测试环境-正常轮换-双写4小时已过-所有使用方已确认-可以切换' };
    } else if (planType === 'staging_fail') {
      const k1Id = generateId();
      db.prepare(`
        INSERT OR IGNORE INTO key_versions (id, service_id, environment, version, secret_hash, is_active, created_at)
        VALUES (?, 'payment-service', 'staging', '1', ?, 1, datetime('now', '-1 day'))
      `).run(k1Id, hashSecret('old-payment-staging-1'));

      const k2Id = generateId();
      db.prepare(`
        INSERT INTO key_versions (id, service_id, environment, version, secret_hash, is_active, created_at)
        VALUES (?, 'payment-service', 'staging', '2', ?, 0, datetime('now', '-3 hours'))
      `).run(k2Id, hashSecret('new-payment-staging-2'));

      const planId = generateId();
      db.prepare(`
        INSERT INTO rotation_plans (id, service_id, target_key_version_id, status, created_at, started_at)
        VALUES (?, 'payment-service', ?, 'rolled_back', datetime('now', '-3 hours'), datetime('now', '-2.5 hours'))
      `).run(planId, k2Id);

      db.prepare(`
        INSERT INTO environment_progress (plan_id, environment, status, dual_write_started_at, rollback_reason)
        VALUES (?, 'staging', 'rolled_back', datetime('now', '-2 hours'), '预发环境发现兼容性问题，新密钥导致签名验证失败')
      `).run(planId);

      addAuditEntry(planId, 'plan_created', actor, 'staging', null, '2026-05-12 11:00:00');
      addAuditEntry(planId, 'plan_started', actor, 'staging', null, '2026-05-12 11:30:00');
      addAuditEntry(planId, 'entered_dual_write', actor, 'staging', null, '2026-05-12 12:00:00');
      addAuditEntry(planId, 'rolled_back', actor, 'staging', { reason: '预发环境发现兼容性问题，新密钥导致签名验证失败' }, '2026-05-12 13:00:00');

      return { planId, type: 'staging_rollback', description: '预发环境-已回滚-签名验证失败' };
    } else if (planType === 'prod_missing_confirm') {
      const k1Id = generateId();
      db.prepare(`
        INSERT OR IGNORE INTO key_versions (id, service_id, environment, version, secret_hash, is_active, created_at)
        VALUES (?, 'internal-report', 'production', '5', ?, 1, datetime('now', '-7 days'))
      `).run(k1Id, hashSecret('old-prod-report-v5'));

      const k2Id = generateId();
      db.prepare(`
        INSERT INTO key_versions (id, service_id, environment, version, secret_hash, is_active, created_at)
        VALUES (?, 'internal-report', 'production', '6', ?, 0, datetime('now', '-7 hours'))
      `).run(k2Id, hashSecret('new-prod-report-v6'));

      const planId = generateId();
      db.prepare(`
        INSERT INTO rotation_plans (id, service_id, target_key_version_id, status, created_at, started_at)
        VALUES (?, 'internal-report', ?, 'waiting_confirmation', datetime('now', '-7 hours'), datetime('now', '-6 hours'))
      `).run(planId, k2Id);

      db.prepare(`
        INSERT INTO environment_progress (plan_id, environment, status, dual_write_started_at)
        VALUES (?, 'production', 'waiting_confirmation', datetime('now', '-5 hours'))
      `).run(planId);

      db.prepare(`
        INSERT INTO approvals (plan_id, environment, approver, notes, approved_at)
        VALUES (?, 'production', 'security-leader@company.com', '已审阅变更窗口和回滚计划', datetime('now', '-6.5 hours'))
      `).run(planId);

      const consumers = db.prepare(`
        SELECT * FROM consumers WHERE service_id = 'internal-report' AND environment = 'production'
      `).all();

      if (consumers.length > 0) {
        db.prepare(`
          INSERT INTO consumer_confirmations (plan_id, consumer_id, environment, confirmed_at)
          VALUES (?, ?, 'production', datetime('now', '-4 hours'))
        `).run(planId, consumers[0].id);
      }

      addAuditEntry(planId, 'plan_created', actor, 'production', null, '2026-05-12 07:00:00');
      addAuditEntry(planId, 'approved', 'security-leader@company.com', 'production', { notes: '已审阅变更窗口和回滚计划' }, '2026-05-12 07:30:00');
      addAuditEntry(planId, 'plan_started', actor, 'production', null, '2026-05-12 08:00:00');
      addAuditEntry(planId, 'entered_dual_write', actor, 'production', null, '2026-05-12 09:00:00');
      if (consumers.length > 0) {
        addAuditEntry(planId, 'consumer_confirmed', actor, 'production', { consumer_id: consumers[0].id, consumer_name: consumers[0].name }, '2026-05-12 10:00:00');
      }

      return { 
        planId, 
        type: 'production_waiting', 
        description: '生产环境-已审批-双写5小时-3个使用方只确认了1个-阻断切换',
        unconfirmed_consumers: consumers.slice(1).map(c => c.name)
      };
    }
  };

  const results = [];
  dbModule.transaction(() => {
    results.push(seedPlan1('normal'));
    results.push(seedPlan1('staging_fail'));
    results.push(seedPlan1('prod_missing_confirm'));
  });

  res.json({
    message: 'Seed data created successfully',
    plans: results
  });
});

async function startServer() {
  await dbModule.initDatabase();
  db = dbModule;
  
  app.listen(PORT, () => {
    console.log(`Key Rotation API server running on port ${PORT}`);
  });
}

startServer();

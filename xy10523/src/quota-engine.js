const { db } = require('./db');

const RESOURCE_TYPES = {
  STORAGE: 'storage',
  CALL: 'call',
  MEMBER: 'member'
};

const PLAN_FIELDS = {
  [RESOURCE_TYPES.STORAGE]: 'storage_quota_gb',
  [RESOURCE_TYPES.CALL]: 'call_quota',
  [RESOURCE_TYPES.MEMBER]: 'member_quota'
};

function getTenantWithPlan(tenantId) {
  const row = db.prepare(`
    SELECT t.*, p.name as plan_name, p.storage_quota_gb, p.call_quota, p.member_quota, p.soft_limit_pct
    FROM tenants t
    LEFT JOIN plans p ON t.current_plan_id = p.id
    WHERE t.id = ?
  `).get(tenantId);
  return row;
}

function getActiveAddons(tenantId, resourceType, atTime = new Date()) {
  const now = atTime.toISOString().slice(0, 19).replace('T', ' ');
  return db.prepare(`
    SELECT * FROM addon_packages
    WHERE tenant_id = ?
      AND type = ?
      AND effective_at <= ?
      AND (expires_at IS NULL OR expires_at > ?)
    ORDER BY effective_at ASC
  `).all(tenantId, resourceType, now, now);
}

function getUsage(tenantId, resourceType, fromDate = null, toDate = null) {
  let sql = `
    SELECT SUM(amount) as total, COUNT(*) as record_count
    FROM usage_records
    WHERE tenant_id = ? AND resource_type = ?
  `;
  const params = [tenantId, resourceType];

  if (fromDate) {
    sql += ' AND usage_date >= ?';
    params.push(fromDate);
  }
  if (toDate) {
    sql += ' AND usage_date <= ?';
    params.push(toDate);
  }

  const row = db.prepare(sql).get(...params);
  return { total: row.total || 0, record_count: row.record_count || 0 };
}

function getDailyUsage(tenantId, resourceType, fromDate, toDate) {
  const rows = db.prepare(`
    SELECT usage_date, SUM(amount) as amount, COUNT(*) as record_count
    FROM usage_records
    WHERE tenant_id = ?
      AND resource_type = ?
      AND usage_date >= ?
      AND usage_date <= ?
    GROUP BY usage_date
    ORDER BY usage_date ASC
  `).all(tenantId, resourceType, fromDate, toDate);
  return rows;
}

function getUsageByPeriod(tenantId, resourceType, planEffectiveAt, currentTime = new Date()) {
  const planEffectiveDate = planEffectiveAt ? planEffectiveAt.slice(0, 10) : null;
  const nowStr = currentTime.toISOString().slice(0, 10);

  const currentUsage = planEffectiveDate
    ? getUsage(tenantId, resourceType, planEffectiveDate, nowStr)
    : getUsage(tenantId, resourceType);

  const historicalUsage = planEffectiveDate
    ? getUsage(tenantId, resourceType, null, subtractOneDay(planEffectiveDate))
    : { total: 0, record_count: 0 };

  return { currentUsage, historicalUsage };
}

function subtractOneDay(dateStr) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

function addDays(dateStr, days) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function getQuotaLedger(tenantId, atTime = new Date()) {
  const tenant = getTenantWithPlan(tenantId);
  if (!tenant) {
    throw new Error(`租户不存在: ${tenantId}`);
  }

  const ledger = {};
  const resources = [RESOURCE_TYPES.STORAGE, RESOURCE_TYPES.CALL, RESOURCE_TYPES.MEMBER];

  for (const resourceType of resources) {
    const planQuota = tenant[PLAN_FIELDS[resourceType]] || 0;
    const addons = getActiveAddons(tenantId, resourceType, atTime);
    const addonQuota = addons.reduce((sum, a) => sum + a.amount, 0);
    const totalQuota = planQuota + addonQuota;

    const { currentUsage, historicalUsage } = getUsageByPeriod(
      tenantId,
      resourceType,
      tenant.plan_effective_at,
      atTime
    );

    const used = currentUsage.total;
    const available = Math.max(0, totalQuota - used);
    const overage = Math.max(0, used - totalQuota);

    const softLimit = Math.floor(totalQuota * (tenant.soft_limit_pct || 0.8));
    const isSoftExceeded = used > softLimit && overage <= 0;
    const isHardExceeded = overage > 0;
    const status = isHardExceeded ? 'over' : (isSoftExceeded ? 'warning' : 'normal');

    ledger[resourceType] = {
      planQuota,
      addonQuota,
      addonCount: addons.length,
      totalQuota,
      softLimit,
      softLimitPct: tenant.soft_limit_pct || 0.8,
      currentUsage: used,
      historicalUsage: historicalUsage.total,
      available,
      overage,
      isFrozen: tenant.status === 'frozen',
      status,
      overageReason: overage > 0 ? analyzeOverageReason(tenantId, resourceType, totalQuota, used, tenant.plan_effective_at, atTime) : null
    };
  }

  return {
    tenantId: tenant.id,
    tenantName: tenant.name,
    status: tenant.status,
    currentPlan: tenant.current_plan_id ? {
      id: tenant.current_plan_id,
      name: tenant.plan_name,
      effectiveAt: tenant.plan_effective_at
    } : null,
    ledger,
    generatedAt: atTime.toISOString()
  };
}

function analyzeOverageReason(tenantId, resourceType, totalQuota, used, planEffectiveAt, atTime) {
  const reasons = [];

  if (planEffectiveAt) {
    const { historicalUsage } = getUsageByPeriod(tenantId, resourceType, planEffectiveAt, atTime);
    if (historicalUsage.total > 0) {
      reasons.push({
        type: 'historical',
        description: `套餐生效前已使用 ${historicalUsage.total}，当前套餐周期内使用 ${used}`,
        details: {
          planEffectiveAt,
          beforePlanUsage: historicalUsage.total,
          currentPlanUsage: used
        }
      });
    }
  }

  const expiredAddons = getExpiredAddons(tenantId, resourceType, atTime);
  if (expiredAddons.length > 0) {
    const expiredAmount = expiredAddons.reduce((sum, a) => sum + a.amount, 0);
    reasons.push({
      type: 'addon_expired',
      description: `${expiredAddons.length} 个加购包已过期，减少配额 ${expiredAmount}`,
      details: expiredAddons
    });
  }

  const tenant = getTenantWithPlan(tenantId);
  const planQuota = tenant[PLAN_FIELDS[resourceType]] || 0;
  const currentAddons = getActiveAddons(tenantId, resourceType, atTime);
  const currentAddonQuota = currentAddons.reduce((sum, a) => sum + a.amount, 0);

  if (used > planQuota + currentAddonQuota) {
    reasons.push({
      type: 'current_overuse',
      description: `当前周期使用量(${used}) > 当前有效配额(${planQuota + currentAddonQuota})`,
      details: { planQuota, currentAddonQuota }
    });
  }

  return reasons;
}

function getExpiredAddons(tenantId, resourceType, atTime) {
  const now = atTime.toISOString().slice(0, 19).replace('T', ' ');
  return db.prepare(`
    SELECT * FROM addon_packages
    WHERE tenant_id = ?
      AND type = ?
      AND expires_at IS NOT NULL
      AND expires_at <= ?
    ORDER BY expires_at DESC
  `).all(tenantId, resourceType, now);
}

function recordUsage(tenantId, resourceType, amount, usageDate, requestId, source = 'api', operator = 'system') {
  const tenant = getTenantWithPlan(tenantId);
  if (!tenant) {
    return { success: false, error: 'TENANT_NOT_FOUND', message: `租户不存在: ${tenantId}` };
  }

  if (tenant.status === 'frozen') {
    return {
      success: false,
      error: 'TENANT_FROZEN',
      message: '租户已冻结，无法上报用量',
      tenantStatus: tenant.status
    };
  }

  if (requestId) {
    const existing = db.prepare('SELECT * FROM usage_records WHERE request_id = ?').get(requestId);
    if (existing) {
      return {
        success: true,
        idempotent: true,
        message: '重复请求，已幂等处理',
        existingRecord: {
          id: existing.id,
          amount: existing.amount,
          usageDate: existing.usage_date
        }
      };
    }
  }

  const dateStr = usageDate || new Date().toISOString().slice(0, 10);

  const insert = db.prepare(`
    INSERT INTO usage_records (tenant_id, resource_type, usage_date, amount, request_id, source)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const info = insert.run(tenantId, resourceType, dateStr, amount, requestId, source);

  const ledger = getQuotaLedger(tenantId);
  const resourceLedger = ledger.ledger[resourceType];

  const auditEntry = {
    action: 'USAGE_RECORDED',
    before_state: JSON.stringify({ status: tenant.status }),
    after_state: JSON.stringify({ usageRecorded: amount, resourceType, date: dateStr }),
    diff: JSON.stringify({ amount, resourceType, date: dateStr }),
    operator,
    request_id: requestId
  };

  recordAudit(tenantId, auditEntry);

  return {
    success: true,
    id: info.lastInsertRowid,
    tenantStatus: tenant.status,
    resourceType,
    amount,
    date: dateStr,
    currentState: {
      used: resourceLedger.currentUsage,
      totalQuota: resourceLedger.totalQuota,
      available: resourceLedger.available,
      overage: resourceLedger.overage,
      status: resourceLedger.status
    }
  };
}

function changePlan(tenantId, newPlanId, reason, operator = 'system') {
  const tenant = getTenantWithPlan(tenantId);
  if (!tenant) {
    return { success: false, error: 'TENANT_NOT_FOUND', message: `租户不存在: ${tenantId}` };
  }

  const newPlan = db.prepare('SELECT * FROM plans WHERE id = ?').get(newPlanId);
  if (!newPlan) {
    return { success: false, error: 'PLAN_NOT_FOUND', message: `套餐不存在: ${newPlanId}` };
  }

  const oldPlanId = tenant.current_plan_id;
  const beforeState = JSON.stringify({
    planId: oldPlanId,
    planName: tenant.plan_name,
    storageQuota: tenant.storage_quota_gb,
    callQuota: tenant.call_quota,
    memberQuota: tenant.member_quota
  });

  const now = new Date().toISOString().slice(0, 19).replace('T', ' ');

  db.prepare(`
    UPDATE tenants
    SET current_plan_id = ?, plan_effective_at = ?, updated_at = datetime('now')
    WHERE id = ?
  `).run(newPlanId, now, tenantId);

  db.prepare(`
    INSERT INTO plan_history (tenant_id, old_plan_id, new_plan_id, effective_at, reason, operator)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(tenantId, oldPlanId, newPlanId, now, reason, operator);

  const afterState = JSON.stringify({
    planId: newPlanId,
    planName: newPlan.name,
    storageQuota: newPlan.storage_quota_gb,
    callQuota: newPlan.call_quota,
    memberQuota: newPlan.member_quota
  });

  recordAudit(tenantId, {
    action: 'PLAN_CHANGED',
    before_state: beforeState,
    after_state: afterState,
    diff: JSON.stringify({
      from: { id: oldPlanId, name: tenant.plan_name },
      to: { id: newPlanId, name: newPlan.name },
      reason
    }),
    operator
  });

  const ledger = getQuotaLedger(tenantId);

  return {
    success: true,
    message: `套餐已从 ${tenant.plan_name || '无'} 变更为 ${newPlan.name}`,
    change: {
      from: oldPlanId,
      to: newPlanId,
      effectiveAt: now,
      reason
    },
    currentLedger: ledger
  };
}

function addAddon(tenantId, type, amount, effectiveDays = null, expiresDays = null, source = 'purchase', operator = 'system') {
  const tenant = getTenantWithPlan(tenantId);
  if (!tenant) {
    return { success: false, error: 'TENANT_NOT_FOUND', message: `租户不存在: ${tenantId}` };
  }

  if (!Object.values(RESOURCE_TYPES).includes(type)) {
    return { success: false, error: 'INVALID_RESOURCE_TYPE', message: `无效的资源类型: ${type}` };
  }

  const addonId = `addon_${tenantId}_${Date.now()}`;
  const now = new Date();
  const effectiveAt = effectiveDays
    ? addDays(now.toISOString().slice(0, 10), effectiveDays)
    : now.toISOString().slice(0, 10);

  const expiresAt = expiresDays
    ? addDays(effectiveAt, expiresDays)
    : null;

  db.prepare(`
    INSERT INTO addon_packages (id, tenant_id, type, amount, effective_at, expires_at, source, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(addonId, tenantId, type, amount, effectiveAt, expiresAt, source, operator);

  recordAudit(tenantId, {
    action: 'ADDON_ADDED',
    before_state: JSON.stringify({}),
    after_state: JSON.stringify({ addonId, type, amount, effectiveAt, expiresAt }),
    diff: JSON.stringify({ type, amount, effectiveAt, expiresAt, source }),
    operator
  });

  const ledger = getQuotaLedger(tenantId);

  return {
    success: true,
    addon: {
      id: addonId,
      type,
      amount,
      effectiveAt,
      expiresAt,
      source
    },
    currentLedger: ledger
  };
}

function freezeTenant(tenantId, reason, operator = 'system') {
  const tenant = getTenantWithPlan(tenantId);
  if (!tenant) {
    return { success: false, error: 'TENANT_NOT_FOUND', message: `租户不存在: ${tenantId}` };
  }

  if (tenant.status === 'frozen') {
    return {
      success: true,
      idempotent: true,
      message: '租户已处于冻结状态'
    };
  }

  const beforeState = JSON.stringify({ status: tenant.status });

  db.prepare(`
    UPDATE tenants SET status = 'frozen', updated_at = datetime('now') WHERE id = ?
  `).run(tenantId);

  const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
  db.prepare(`
    INSERT INTO freeze_history (tenant_id, action, reason, operator)
    VALUES (?, 'freeze', ?, ?)
  `).run(tenantId, reason, operator);

  const afterState = JSON.stringify({ status: 'frozen' });

  recordAudit(tenantId, {
    action: 'TENANT_FROZEN',
    before_state: beforeState,
    after_state: afterState,
    diff: JSON.stringify({ reason, from: tenant.status, to: 'frozen' }),
    operator
  });

  return {
    success: true,
    message: '租户已冻结',
    status: 'frozen',
    reason,
    frozenAt: now
  };
}

function unfreezeTenant(tenantId, reason, operator = 'system') {
  const tenant = getTenantWithPlan(tenantId);
  if (!tenant) {
    return { success: false, error: 'TENANT_NOT_FOUND', message: `租户不存在: ${tenantId}` };
  }

  if (tenant.status !== 'frozen') {
    return {
      success: true,
      idempotent: true,
      message: '租户未处于冻结状态'
    };
  }

  const beforeState = JSON.stringify({ status: tenant.status });

  db.prepare(`
    UPDATE tenants SET status = 'active', updated_at = datetime('now') WHERE id = ?
  `).run(tenantId);

  const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
  db.prepare(`
    INSERT INTO freeze_history (tenant_id, action, reason, operator)
    VALUES (?, 'unfreeze', ?, ?)
  `).run(tenantId, reason, operator);

  const afterState = JSON.stringify({ status: 'active' });

  recordAudit(tenantId, {
    action: 'TENANT_UNFROZEN',
    before_state: beforeState,
    after_state: afterState,
    diff: JSON.stringify({ reason, from: 'frozen', to: 'active' }),
    operator
  });

  return {
    success: true,
    message: '租户已解冻',
    status: 'active',
    reason,
    unfrozenAt: now
  };
}

function manualCorrection(tenantId, resourceType, correction, reason, operator) {
  const tenant = getTenantWithPlan(tenantId);
  if (!tenant) {
    return { success: false, error: 'TENANT_NOT_FOUND', message: `租户不存在: ${tenantId}` };
  }

  if (!operator) {
    return { success: false, error: 'OPERATOR_REQUIRED', message: '人工修正必须指定操作者' };
  }

  const ledgerBefore = getQuotaLedger(tenantId);
  const beforeUsage = ledgerBefore.ledger[resourceType].currentUsage;

  const requestId = `manual_${tenantId}_${resourceType}_${Date.now()}`;
  const dateStr = new Date().toISOString().slice(0, 10);

  db.prepare(`
    INSERT INTO usage_records (tenant_id, resource_type, usage_date, amount, request_id, source)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(tenantId, resourceType, dateStr, correction, requestId, 'manual_correction');

  const ledgerAfter = getQuotaLedger(tenantId);
  const afterUsage = ledgerAfter.ledger[resourceType].currentUsage;

  recordAudit(tenantId, {
    action: 'MANUAL_CORRECTION',
    before_state: JSON.stringify({ usage: beforeUsage, ledger: ledgerBefore.ledger[resourceType] }),
    after_state: JSON.stringify({ usage: afterUsage, ledger: ledgerAfter.ledger[resourceType] }),
    diff: JSON.stringify({
      resourceType,
      correction,
      beforeUsage,
      afterUsage,
      difference: afterUsage - beforeUsage,
      reason
    }),
    operator,
    request_id: requestId
  });

  return {
    success: true,
    message: '人工修正已记录',
    correction: {
      resourceType,
      amount: correction,
      beforeUsage,
      afterUsage,
      reason,
      operator
    },
    currentLedger: ledgerAfter
  };
}

function getHistory(tenantId) {
  const planHistory = db.prepare(`
    SELECT ph.*, p_old.name as old_plan_name, p_new.name as new_plan_name
    FROM plan_history ph
    LEFT JOIN plans p_old ON ph.old_plan_id = p_old.id
    LEFT JOIN plans p_new ON ph.new_plan_id = p_new.id
    WHERE ph.tenant_id = ?
    ORDER BY ph.effective_at DESC
  `).all(tenantId);

  const freezeHistory = db.prepare(`
    SELECT * FROM freeze_history
    WHERE tenant_id = ?
    ORDER BY created_at DESC
  `).all(tenantId);

  const addonHistory = db.prepare(`
    SELECT * FROM addon_packages
    WHERE tenant_id = ?
    ORDER BY created_at DESC
  `).all(tenantId);

  const auditLogs = db.prepare(`
    SELECT id, action, diff, operator, created_at
    FROM audit_logs
    WHERE tenant_id = ?
    ORDER BY created_at DESC
    LIMIT 100
  `).all(tenantId);

  return {
    planHistory,
    freezeHistory,
    addonHistory,
    auditLogs
  };
}

function recordAudit(tenantId, entry) {
  db.prepare(`
    INSERT INTO audit_logs (tenant_id, action, before_state, after_state, diff, operator, request_id)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    tenantId,
    entry.action,
    entry.before_state,
    entry.after_state,
    entry.diff,
    entry.operator,
    entry.request_id
  );
}

function generateDailyReport(tenantId, fromDate, toDate) {
  const tenant = getTenantWithPlan(tenantId);
  if (!tenant) {
    return { success: false, error: 'TENANT_NOT_FOUND', message: `租户不存在: ${tenantId}` };
  }

  const report = {
    tenantId,
    tenantName: tenant.name,
    period: { from: fromDate, to: toDate },
    generatedAt: new Date().toISOString(),
    currentStatus: tenant.status,
    resources: {}
  };

  for (const resourceType of Object.values(RESOURCE_TYPES)) {
    const daily = getDailyUsage(tenantId, resourceType, fromDate, toDate);
    const ledger = getQuotaLedger(tenantId);
    const resourceLedger = ledger.ledger[resourceType];

    report.resources[resourceType] = {
      quota: {
        plan: resourceLedger.planQuota,
        addon: resourceLedger.addonQuota,
        total: resourceLedger.totalQuota
      },
      dailyUsage: daily.map(d => ({
        date: d.usage_date,
        amount: d.amount,
        recordCount: d.record_count
      })),
      periodTotal: daily.reduce((sum, d) => sum + d.amount, 0),
      currentLedger: resourceLedger
    };
  }

  return {
    success: true,
    report
  };
}

module.exports = {
  RESOURCE_TYPES,
  getTenantWithPlan,
  getQuotaLedger,
  recordUsage,
  changePlan,
  addAddon,
  freezeTenant,
  unfreezeTenant,
  manualCorrection,
  getHistory,
  generateDailyReport,
  getUsage,
  getDailyUsage
};

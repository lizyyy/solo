const { v4: uuidv4 } = require('uuid');
const config = require('../config');
const { getDb } = require('../db');

const BLOCKED_PAYMENTS = new Set(['risk_payment_001', 'risk_payment_002']);
const BLOCKED_ACCOUNTS = new Set(['risk_account_001', 'risk_account_002']);
const BLOCKED_ID_CARDS = new Set(['11010119900000000X']);

function getOrdersInHour(accountId) {
  const db = getDb();
  const oneHourAgo = new Date(Date.now() - 3600000).toISOString();
  
  return db.prepare(`
    SELECT COUNT(*) as count
    FROM orders
    WHERE account_id = ?
      AND created_at >= ?
  `).get(accountId, oneHourAgo).count;
}

function getActiveQueueCount(accountId) {
  const db = getDb();
  return db.prepare(`
    SELECT COUNT(*) as count
    FROM queue_items
    WHERE account_id = ?
      AND status = 'waiting'
  `).get(accountId).count;
}

function recordRisk(type, details) {
  const db = getDb();
  const id = uuidv4();
  
  db.prepare(`
    INSERT INTO risk_records (id, type, account_id, id_card_no, ip, reason, metadata)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    type,
    details.accountId || null,
    details.idCardNo || null,
    details.ip || null,
    details.reason,
    JSON.stringify(details.metadata || {})
  );

  return id;
}

function checkRisk(params) {
  const { accountId, idCardNo, paymentChannel, ip, quantity } = params;
  const checks = [];

  if (BLOCKED_ACCOUNTS.has(accountId)) {
    checks.push({
      pass: false,
      reason: '该账号因异常行为被临时限制购票，请联系客服',
      code: 'RISK_BLOCKED_ACCOUNT',
      level: 'high'
    });
  }

  if (BLOCKED_ID_CARDS.has(idCardNo)) {
    checks.push({
      pass: false,
      reason: '该证件号存在异常购票记录，请联系客服',
      code: 'RISK_BLOCKED_ID_CARD',
      level: 'high'
    });
  }

  if (paymentChannel && BLOCKED_PAYMENTS.has(paymentChannel)) {
    checks.push({
      pass: false,
      reason: '该支付渠道存在风险，请更换其他支付方式',
      code: 'RISK_BLOCKED_PAYMENT',
      level: 'high'
    });
  }

  const orderCount = getOrdersInHour(accountId);
  if (orderCount >= config.risk.maxOrdersPerHour) {
    checks.push({
      pass: false,
      reason: `您在过去 1 小时内已下单 ${orderCount} 次，已达 ${config.risk.maxOrdersPerHour} 次上限，请稍后再试`,
      code: 'RISK_FREQUENCY',
      level: 'medium',
      details: { orderCount, limit: config.risk.maxOrdersPerHour }
    });
  }

  const queueCount = getActiveQueueCount(accountId);
  if (queueCount >= config.risk.maxQueuePerUser) {
    checks.push({
      pass: false,
      reason: `您已有 ${queueCount} 个候补订单，最多支持 ${config.risk.maxQueuePerUser} 个`,
      code: 'RISK_QUEUE_LIMIT',
      level: 'medium'
    });
  }

  if (quantity > 10) {
    checks.push({
      pass: false,
      reason: `单次购票数量过多（${quantity} 张），单次最多 10 张`,
      code: 'RISK_QUANTITY_EXCESS',
      level: 'high'
    });
  }

  const highRisk = checks.find(c => c.level === 'high');
  if (highRisk) {
    recordRisk('BLOCKED', {
      accountId,
      idCardNo,
      ip,
      reason: highRisk.reason,
      metadata: { code: highRisk.code }
    });
    return highRisk;
  }

  if (checks.length > 0) {
    recordRisk('WARN', {
      accountId,
      idCardNo,
      ip,
      reason: checks.map(c => c.reason).join('；'),
      metadata: checks.map(c => c.code)
    });
    return checks[0];
  }

  return { pass: true, reason: '风控校验通过', code: 'PASS' };
}

function getRiskRecords(accountId = null, limit = 50) {
  const db = getDb();
  
  if (accountId) {
    return db.prepare(`
      SELECT * FROM risk_records
      WHERE account_id = ?
      ORDER BY created_at DESC
      LIMIT ?
    `).all(accountId, limit);
  }
  
  return db.prepare(`
    SELECT * FROM risk_records
    ORDER BY created_at DESC
    LIMIT ?
  `).all(limit);
}

module.exports = {
  checkRisk,
  recordRisk,
  getRiskRecords,
  getOrdersInHour,
  getActiveQueueCount
};

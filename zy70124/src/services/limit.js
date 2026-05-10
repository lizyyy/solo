const config = require('../config');
const { getDb } = require('../db');
const { getTier } = require('./inventory');

function getPurchaseCountByAccount(tierId, accountId, excludeOrderId = null) {
  const db = getDb();
  const show = getTier(tierId);
  if (!show) return 0;

  let sql = `
    SELECT COALESCE(SUM(quantity), 0) as count
    FROM orders
    WHERE show_id = ?
      AND account_id = ?
      AND status IN ('pending', 'paid', 'reserved')
  `;
  const params = [show.show_id, accountId];
  
  if (excludeOrderId) {
    sql += ' AND id != ?';
    params.push(excludeOrderId);
  }

  return db.prepare(sql).get(...params).count;
}

function getPurchaseCountByIdCard(tierId, idCardNo, excludeOrderId = null) {
  const db = getDb();
  const show = getTier(tierId);
  if (!show) return 0;

  let sql = `
    SELECT COALESCE(SUM(quantity), 0) as count
    FROM orders
    WHERE show_id = ?
      AND id_card_no = ?
      AND status IN ('pending', 'paid', 'reserved')
  `;
  const params = [show.show_id, idCardNo];
  
  if (excludeOrderId) {
    sql += ' AND id != ?';
    params.push(excludeOrderId);
  }

  return db.prepare(sql).get(...params).count;
}

function getPurchaseCountByPayment(tierId, paymentChannel, idCardNo, excludeOrderId = null) {
  const db = getDb();
  const show = getTier(tierId);
  if (!show) return 0;

  let sql = `
    SELECT COALESCE(SUM(quantity), 0) as count
    FROM orders
    WHERE show_id = ?
      AND payment_channel = ?
      AND status IN ('pending', 'paid', 'reserved')
  `;
  const params = [show.show_id, paymentChannel];
  
  if (excludeOrderId) {
    sql += ' AND id != ?';
    params.push(excludeOrderId);
  }

  return db.prepare(sql).get(...params).count;
}

function checkLimits(tierId, accountId, idCardNo, paymentChannel, quantity, excludeOrderId = null) {
  const tier = getTier(tierId);
  if (!tier) {
    return { pass: false, reason: '票档不存在', code: 'TIER_NOT_FOUND' };
  }

  if (tier.status !== 'active') {
    return { pass: false, reason: '该票档已停售', code: 'TIER_INACTIVE' };
  }

  if (tier.show_status !== 'active') {
    return { pass: false, reason: '该演出已下架', code: 'SHOW_INACTIVE' };
  }

  const idCardLimit = tier.per_id_card_limit || config.limit.perIdCard;
  const accountLimit = tier.per_account_limit || config.limit.perAccount;
  const paymentLimit = tier.per_payment_limit || config.limit.perPayment;

  const idCardCount = getPurchaseCountByIdCard(tierId, idCardNo, excludeOrderId);
  if (idCardCount + quantity > idCardLimit) {
    return {
      pass: false,
      reason: `该证件已购买 ${idCardCount} 张，本场限购 ${idCardLimit} 张，超出 ${(idCardCount + quantity) - idCardLimit} 张`,
      code: 'LIMIT_ID_CARD',
      details: { purchased: idCardCount, limit: idCardLimit, requested: quantity }
    };
  }

  const accountCount = getPurchaseCountByAccount(tierId, accountId, excludeOrderId);
  if (accountCount + quantity > accountLimit) {
    return {
      pass: false,
      reason: `该账号已购买 ${accountCount} 张，本场限购 ${accountLimit} 张，超出 ${(accountCount + quantity) - accountLimit} 张`,
      code: 'LIMIT_ACCOUNT',
      details: { purchased: accountCount, limit: accountLimit, requested: quantity }
    };
  }

  const paymentCount = getPurchaseCountByPayment(tierId, paymentChannel, idCardNo, excludeOrderId);
  if (paymentCount + quantity > paymentLimit) {
    return {
      pass: false,
      reason: `该支付渠道已购买 ${paymentCount} 张，本场限购 ${paymentLimit} 张，超出 ${(paymentCount + quantity) - paymentLimit} 张`,
      code: 'LIMIT_PAYMENT',
      details: { purchased: paymentCount, limit: paymentLimit, requested: quantity }
    };
  }

  return {
    pass: true,
    reason: '限购校验通过',
    code: 'PASS',
    details: {
      idCardUsed: idCardCount,
      accountUsed: accountCount,
      paymentUsed: paymentCount
    }
  };
}

module.exports = {
  checkLimits,
  getPurchaseCountByAccount,
  getPurchaseCountByIdCard,
  getPurchaseCountByPayment
};

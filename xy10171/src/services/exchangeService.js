const { v4: uuidv4 } = require('uuid');
const { query, queryOne, insert, update, transaction } = require('../db');
const { EXCHANGE_STATUSES } = require('../constants/statuses');
const { ERROR_CODES } = require('../constants/errorCodes');
const stateMachine = require('./stateMachine');
const inventoryService = require('./inventory');

function generateExchangeId() {
  return `EX-${Date.now()}-${uuidv4().substring(0, 8).toUpperCase()}`;
}

function getExchangeById(id) {
  return queryOne('exchanges', e => e.id === id);
}

function getExchangeWithLogs(id) {
  const exchange = getExchangeById(id);
  if (!exchange) return null;
  
  const logs = query(
    'exchange_status_logs',
    l => l.exchange_id === id
  ).sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  
  return {
    ...exchange,
    status_logs: logs
  };
}

function listExchanges(filters = {}) {
  let results = query('exchanges');
  
  if (filters.status) {
    results = results.filter(e => e.status === filters.status);
  }
  if (filters.order_id) {
    results = results.filter(e => e.order_id === filters.order_id);
  }
  
  return results.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
}

function createExchange(payload) {
  const {
    order_id,
    original_sku,
    target_sku,
    original_qty = 1,
    target_qty = 1,
    reason = ''
  } = payload;

  const id = generateExchangeId();
  const now = new Date().toISOString();

  const exchange = insert('exchanges', {
    id,
    order_id,
    original_sku,
    target_sku,
    original_qty,
    target_qty,
    reason,
    status: EXCHANGE_STATUSES.PENDING_APPLY,
    price_diff: 0,
    paid_amount: 0,
    created_at: now,
    updated_at: now
  });

  insert('exchange_status_logs', {
    id: Date.now(),
    exchange_id: id,
    from_status: null,
    to_status: EXCHANGE_STATUSES.PENDING_APPLY,
    remark: '创建换货单',
    created_at: now
  });

  return exchange;
}

function submitApply(exchangeId) {
  return stateMachine.transitionState(exchangeId, EXCHANGE_STATUSES.APPLIED);
}

function shipBack(exchangeId) {
  return stateMachine.transitionState(exchangeId, EXCHANGE_STATUSES.SHIPPED_BACK);
}

function passQC(exchangeId) {
  return stateMachine.transitionState(exchangeId, EXCHANGE_STATUSES.QC_PASSED);
}

function failQC(exchangeId) {
  return stateMachine.transitionState(exchangeId, EXCHANGE_STATUSES.QC_FAILED);
}

function calculatePriceDiff(exchangeId, priceDiff) {
  const exchange = getExchangeById(exchangeId);
  if (!exchange) {
    const error = new Error('换货单不存在');
    error.code = ERROR_CODES.EXCHANGE_NOT_FOUND;
    throw error;
  }

  update(
    'exchanges',
    e => e.id === exchangeId,
    {
      price_diff: priceDiff,
      updated_at: new Date().toISOString()
    }
  );

  if (priceDiff > 0) {
    return stateMachine.transitionState(exchangeId, EXCHANGE_STATUSES.NEED_PAYMENT);
  } else {
    return stateMachine.transitionState(exchangeId, EXCHANGE_STATUSES.RESHIPPING);
  }
}

function payDiff(exchangeId, paidAmount) {
  const exchange = getExchangeById(exchangeId);
  if (!exchange) {
    const error = new Error('换货单不存在');
    error.code = ERROR_CODES.EXCHANGE_NOT_FOUND;
    throw error;
  }

  if (paidAmount !== exchange.price_diff) {
    const error = new Error(`支付金额不匹配，应支付: ${exchange.price_diff}`);
    error.code = ERROR_CODES.PAYMENT_AMOUNT_MISMATCH;
    throw error;
  }

  update(
    'exchanges',
    e => e.id === exchangeId,
    {
      paid_amount: paidAmount,
      updated_at: new Date().toISOString()
    }
  );

  return stateMachine.transitionState(exchangeId, EXCHANGE_STATUSES.PAID);
}

function startReshipping(exchangeId) {
  const exchange = getExchangeById(exchangeId);
  if (!exchange) {
    const error = new Error('换货单不存在');
    error.code = ERROR_CODES.EXCHANGE_NOT_FOUND;
    throw error;
  }

  inventoryService.reserveInventory(exchangeId, exchange.target_sku, exchange.target_qty);

  return stateMachine.transitionState(exchangeId, EXCHANGE_STATUSES.RESHIPPING);
}

function complete(exchangeId) {
  const exchange = getExchangeById(exchangeId);
  if (!exchange) {
    const error = new Error('换货单不存在');
    error.code = ERROR_CODES.EXCHANGE_NOT_FOUND;
    throw error;
  }

  const result = stateMachine.transitionState(exchangeId, EXCHANGE_STATUSES.COMPLETED);
  
  inventoryService.consumeInventory(exchangeId, exchange.target_sku);
  
  return result;
}

function cancel(exchangeId) {
  const exchange = getExchangeById(exchangeId);
  if (!exchange) {
    const error = new Error('换货单不存在');
    error.code = ERROR_CODES.EXCHANGE_NOT_FOUND;
    throw error;
  }

  const result = stateMachine.transitionState(exchangeId, EXCHANGE_STATUSES.CANCELLED);
  
  inventoryService.releaseInventory(exchangeId, exchange.target_sku);
  
  return result;
}

function getExchangeStats() {
  const exchanges = query('exchanges');
  
  const grouped = {};
  exchanges.forEach(e => {
    if (!grouped[e.status]) {
      grouped[e.status] = 0;
    }
    grouped[e.status]++;
  });

  const byStatus = Object.keys(grouped).map(status => ({
    status,
    count: grouped[status]
  }));

  const totals = {
    total: exchanges.length,
    total_price_diff: exchanges.reduce((sum, e) => sum + e.price_diff, 0),
    total_paid: exchanges.reduce((sum, e) => sum + e.paid_amount, 0)
  };

  return {
    totals,
    by_status: byStatus
  };
}

module.exports = {
  generateExchangeId,
  getExchangeById,
  getExchangeWithLogs,
  listExchanges,
  createExchange,
  submitApply,
  shipBack,
  passQC,
  failQC,
  calculatePriceDiff,
  payDiff,
  startReshipping,
  complete,
  cancel,
  getExchangeStats
};

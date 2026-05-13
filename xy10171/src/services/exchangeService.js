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
    original_qty,
    target_qty,
    reason = ''
  } = payload;

  if (!order_id || typeof order_id !== 'string' || order_id.trim() === '') {
    const error = new Error('order_id 不能为空');
    error.code = ERROR_CODES.INVALID_REQUEST_DATA;
    throw error;
  }

  if (!original_sku || typeof original_sku !== 'string' || original_sku.trim() === '') {
    const error = new Error('original_sku 不能为空');
    error.code = ERROR_CODES.INVALID_REQUEST_DATA;
    throw error;
  }

  if (!target_sku || typeof target_sku !== 'string' || target_sku.trim() === '') {
    const error = new Error('target_sku 不能为空');
    error.code = ERROR_CODES.INVALID_REQUEST_DATA;
    throw error;
  }

  if (original_sku.trim() === target_sku.trim()) {
    const error = new Error('换货商品不能与原商品相同');
    error.code = ERROR_CODES.INVALID_REQUEST_DATA;
    throw error;
  }

  const origQty = original_qty !== undefined ? original_qty : 1;
  if (!Number.isInteger(origQty) || origQty <= 0) {
    const error = new Error('original_qty 必须是正整数');
    error.code = ERROR_CODES.INVALID_REQUEST_DATA;
    throw error;
  }

  const tgtQty = target_qty !== undefined ? target_qty : 1;
  if (!Number.isInteger(tgtQty) || tgtQty <= 0) {
    const error = new Error('target_qty 必须是正整数');
    error.code = ERROR_CODES.INVALID_REQUEST_DATA;
    throw error;
  }

  const id = generateExchangeId();
  const now = new Date().toISOString();

  const exchange = insert('exchanges', {
    id,
    order_id: order_id.trim(),
    original_sku: original_sku.trim(),
    target_sku: target_sku.trim(),
    original_qty: origQty,
    target_qty: tgtQty,
    reason: typeof reason === 'string' ? reason : '',
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
  if (typeof priceDiff !== 'number' || !Number.isFinite(priceDiff)) {
    const error = new Error('price_diff 必须是数字');
    error.code = ERROR_CODES.INVALID_REQUEST_DATA;
    throw error;
  }

  const exchange = getExchangeById(exchangeId);
  if (!exchange) {
    const error = new Error('换货单不存在');
    error.code = ERROR_CODES.EXCHANGE_NOT_FOUND;
    throw error;
  }

  const targetStatus = priceDiff > 0 
    ? EXCHANGE_STATUSES.NEED_PAYMENT 
    : EXCHANGE_STATUSES.RESHIPPING;

  if (!stateMachine.canTransition(exchange.status, targetStatus)) {
    const error = new Error(`Invalid state transition: ${exchange.status} -> ${targetStatus}`);
    error.code = ERROR_CODES.INVALID_STATE_TRANSITION;
    throw error;
  }

  let result = null;
  transaction(() => {
    update(
      'exchanges',
      e => e.id === exchangeId,
      {
        price_diff: priceDiff,
        status: targetStatus,
        updated_at: new Date().toISOString()
      }
    );

    const remark = priceDiff > 0 
      ? `计算差价，需补 ${priceDiff} 分` 
      : '计算差价，无差价直接重发';
    
    insert('exchange_status_logs', {
      id: Date.now(),
      exchange_id: exchangeId,
      from_status: exchange.status,
      to_status: targetStatus,
      remark,
      created_at: new Date().toISOString()
    });

    result = getExchangeById(exchangeId);
  });

  return result;
}

function payDiff(exchangeId, paidAmount) {
  if (typeof paidAmount !== 'number' || !Number.isFinite(paidAmount)) {
    const error = new Error('paid_amount 必须是数字');
    error.code = ERROR_CODES.INVALID_REQUEST_DATA;
    throw error;
  }

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

  const targetStatus = EXCHANGE_STATUSES.PAID;

  if (!stateMachine.canTransition(exchange.status, targetStatus)) {
    const error = new Error(`Invalid state transition: ${exchange.status} -> ${targetStatus}`);
    error.code = ERROR_CODES.INVALID_STATE_TRANSITION;
    throw error;
  }

  let result = null;
  transaction(() => {
    update(
      'exchanges',
      e => e.id === exchangeId,
      {
        paid_amount: paidAmount,
        status: targetStatus,
        updated_at: new Date().toISOString()
      }
    );

    insert('exchange_status_logs', {
      id: Date.now(),
      exchange_id: exchangeId,
      from_status: exchange.status,
      to_status: targetStatus,
      remark: `用户已支付差价 ${paidAmount} 分`,
      created_at: new Date().toISOString()
    });

    result = getExchangeById(exchangeId);
  });

  return result;
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

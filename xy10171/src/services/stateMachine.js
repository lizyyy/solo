const { queryOne, insert, update, transaction } = require('../db');
const { EXCHANGE_STATUSES, STATUS_TRANSITIONS } = require('../constants/statuses');
const { ERROR_CODES } = require('../constants/errorCodes');

class StateTransitionError extends Error {
  constructor(from, to) {
    super(`Invalid state transition: ${from} -> ${to}`);
    this.code = ERROR_CODES.INVALID_STATE_TRANSITION;
    this.from = from;
    this.to = to;
  }
}

function canTransition(fromStatus, toStatus) {
  const allowedTransitions = STATUS_TRANSITIONS[fromStatus];
  if (!allowedTransitions) return false;
  return Object.prototype.hasOwnProperty.call(allowedTransitions, toStatus);
}

function getTransitionRemark(fromStatus, toStatus) {
  const allowedTransitions = STATUS_TRANSITIONS[fromStatus];
  if (allowedTransitions && allowedTransitions[toStatus]) {
    return allowedTransitions[toStatus];
  }
  return null;
}

function transitionState(exchangeId, targetStatus, remark = null) {
  const exchange = queryOne('exchanges', e => e.id === exchangeId);
  
  if (!exchange) {
    const error = new Error('Exchange not found');
    error.code = ERROR_CODES.EXCHANGE_NOT_FOUND;
    throw error;
  }

  if (!canTransition(exchange.status, targetStatus)) {
    throw new StateTransitionError(exchange.status, targetStatus);
  }

  const transitionRemark = remark || getTransitionRemark(exchange.status, targetStatus);
  let updatedExchange = null;

  transaction(() => {
    updatedExchange = update(
      'exchanges',
      e => e.id === exchangeId,
      {
        status: targetStatus,
        updated_at: new Date().toISOString()
      }
    );

    insert('exchange_status_logs', {
      id: Date.now(),
      exchange_id: exchangeId,
      from_status: exchange.status,
      to_status: targetStatus,
      remark: transitionRemark,
      created_at: new Date().toISOString()
    });
  });

  return updatedExchange;
}

function getNextAllowedStatuses(currentStatus) {
  const allowedTransitions = STATUS_TRANSITIONS[currentStatus];
  if (!allowedTransitions) return [];
  return Object.keys(allowedTransitions).map(status => ({
    status,
    description: allowedTransitions[status]
  }));
}

module.exports = {
  canTransition,
  getTransitionRemark,
  transitionState,
  getNextAllowedStatuses,
  StateTransitionError
};

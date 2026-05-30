const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../db/connection');
const config = require('../config');

const RENTAL_TRANSITIONS = {
  DRAFT: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['IN_USE', 'CANCELLED'],
  IN_USE: ['RETURNED'],
  RETURNED: ['SETTLED'],
  SETTLED: ['CLOSED'],
  CLOSED: [],
  CANCELLED: []
};

const EQUIPMENT_TRANSITIONS = {
  AVAILABLE: ['RENTED', 'DAMAGED', 'IN_REPAIR', 'RETIRED'],
  RENTED: ['AVAILABLE', 'DAMAGED'],
  DAMAGED: ['IN_REPAIR', 'AVAILABLE', 'RETIRED'],
  IN_REPAIR: ['AVAILABLE', 'RETIRED'],
  RETIRED: []
};

const DEPOSIT_TRANSITIONS = {
  COLLECTED: ['PARTIAL_REFUNDED', 'REFUNDED', 'DEDUCTED'],
  PARTIAL_REFUNDED: ['REFUNDED', 'DEDUCTED'],
  REFUNDED: [],
  DEDUCTED: []
};

class StateTransitionError extends Error {
  constructor(message, fromState, toState) {
    super(message);
    this.name = 'StateTransitionError';
    this.fromState = fromState;
    this.toState = toState;
  }
}

const validateTransition = (transitions, fromState, toState) => {
  const allowed = transitions[fromState];
  if (!allowed || !allowed.includes(toState)) {
    throw new StateTransitionError(
      `Invalid state transition: ${fromState} -> ${toState}. Allowed: ${allowed ? allowed.join(', ') : 'none'}`,
      fromState,
      toState
    );
  }
  return true;
};

const recordTransition = async (db, entityType, entityId, fromState, toState, reason, operator) => {
  const stmt = await db.prepare(`
    INSERT INTO state_transitions 
    (transition_id, entity_type, entity_id, from_state, to_state, reason, operator)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  await stmt.run(uuidv4(), entityType, entityId, fromState, toState, reason, operator || 'system');
};

const transitionRentalOrder = async (orderId, toState, reason, operator) => {
  const db = await getDb();
  const order = await db.prepare('SELECT * FROM rental_orders WHERE order_id = ?').get(orderId);
  
  if (!order) {
    throw new Error(`Rental order not found: ${orderId}`);
  }

  if (!config.states.rental.includes(toState)) {
    throw new Error(`Invalid rental state: ${toState}`);
  }

  if (order.status === toState) {
    return { success: true, alreadyInState: true };
  }

  validateTransition(RENTAL_TRANSITIONS, order.status, toState);

  await db.transaction(async () => {
    await db.prepare(`
      UPDATE rental_orders 
      SET status = ?, updated_at = datetime('now')
      WHERE order_id = ?
    `).run(toState, orderId);

    await recordTransition(db, 'RENTAL_ORDER', orderId, order.status, toState, reason, operator);

    if (toState === 'IN_USE') {
      await db.prepare(`
        UPDATE equipment 
        SET status = 'RENTED', updated_at = datetime('now')
        WHERE equipment_id IN (
          SELECT equipment_id FROM rental_items WHERE order_id = ?
        )
      `).run(orderId);
    }

    if (toState === 'RETURNED' || toState === 'CANCELLED') {
      await db.prepare(`
        UPDATE equipment 
        SET status = 'AVAILABLE', updated_at = datetime('now')
        WHERE equipment_id IN (
          SELECT equipment_id FROM rental_items WHERE order_id = ?
        ) AND equipment_id NOT IN (
          SELECT equipment_id FROM damage_records WHERE order_id = ? AND is_allocated = 0
        )
      `).run(orderId, orderId);
    }
  });

  return {
    success: true,
    orderId,
    fromState: order.status,
    toState
  };
};

const transitionEquipment = async (equipmentId, toState, reason, operator) => {
  const db = await getDb();
  const equipment = await db.prepare('SELECT * FROM equipment WHERE equipment_id = ?').get(equipmentId);
  
  if (!equipment) {
    throw new Error(`Equipment not found: ${equipmentId}`);
  }

  if (!config.states.equipment.includes(toState)) {
    throw new Error(`Invalid equipment state: ${toState}`);
  }

  if (equipment.status === toState) {
    return { success: true, alreadyInState: true };
  }

  validateTransition(EQUIPMENT_TRANSITIONS, equipment.status, toState);

  await db.transaction(async () => {
    await db.prepare(`
      UPDATE equipment 
      SET status = ?, updated_at = datetime('now')
      WHERE equipment_id = ?
    `).run(toState, equipmentId);

    await recordTransition(db, 'EQUIPMENT', equipmentId, equipment.status, toState, reason, operator);
  });

  return {
    success: true,
    equipmentId,
    fromState: equipment.status,
    toState
  };
};

const transitionDeposit = async (depositId, toState, reason, operator, refundAmount = 0, deductAmount = 0) => {
  const db = await getDb();
  const deposit = await db.prepare('SELECT * FROM deposits WHERE deposit_id = ?').get(depositId);
  
  if (!deposit) {
    throw new Error(`Deposit record not found: ${depositId}`);
  }

  if (!config.states.deposit.includes(toState)) {
    throw new Error(`Invalid deposit state: ${toState}`);
  }

  if (deposit.status === toState) {
    return { success: true, alreadyInState: true };
  }

  validateTransition(DEPOSIT_TRANSITIONS, deposit.status, toState);

  const newRefunded = deposit.refunded_amount + refundAmount;
  const newDeducted = deposit.deducted_amount + deductAmount;
  
  if (newRefunded + newDeducted > deposit.collected_amount) {
    throw new Error('Refund + deduct amount exceeds collected deposit');
  }

  await db.transaction(async () => {
    const updates = [];
    const params = [];

    if (refundAmount > 0) {
      updates.push('refunded_amount = ?');
      params.push(newRefunded);
    }
    if (deductAmount > 0) {
      updates.push('deducted_amount = ?');
      params.push(newDeducted);
    }
    if (toState === 'REFUNDED' || toState === 'PARTIAL_REFUNDED') {
      updates.push('refunded_at = datetime(\'now\')');
    }
    if (toState === 'DEDUCTED') {
      updates.push('deducted_at = datetime(\'now\')');
    }

    updates.push('status = ?, updated_at = datetime(\'now\')');
    params.push(toState, depositId);

    await db.prepare(`
      UPDATE deposits 
      SET ${updates.join(', ')}
      WHERE deposit_id = ?
    `).run(...params);

    await recordTransition(db, 'DEPOSIT', depositId, deposit.status, toState, reason, operator);
  });

  return {
    success: true,
    depositId,
    fromState: deposit.status,
    toState,
    refundedAmount: newRefunded,
    deductedAmount: newDeducted
  };
};

const getStateHistory = async (entityType, entityId) => {
  const db = await getDb();
  return await db.prepare(`
    SELECT * FROM state_transitions 
    WHERE entity_type = ? AND entity_id = ?
    ORDER BY created_at DESC
  `).all(entityType, entityId);
};

const getValidTransitions = (entityType, currentState) => {
  const transitions = {
    RENTAL_ORDER: RENTAL_TRANSITIONS,
    EQUIPMENT: EQUIPMENT_TRANSITIONS,
    DEPOSIT: DEPOSIT_TRANSITIONS
  };

  const t = transitions[entityType];
  if (!t) return [];
  return t[currentState] || [];
};

module.exports = {
  StateTransitionError,
  transitionRentalOrder,
  transitionEquipment,
  transitionDeposit,
  getStateHistory,
  getValidTransitions,
  RENTAL_TRANSITIONS,
  EQUIPMENT_TRANSITIONS,
  DEPOSIT_TRANSITIONS
};

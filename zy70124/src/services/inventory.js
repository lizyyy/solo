const { v4: uuidv4 } = require('uuid');
const { getDb, transaction } = require('../db');

function getTier(tierId) {
  const db = getDb();
  return db.prepare(`
    SELECT t.*, s.name as show_name, s.status as show_status
    FROM ticket_tiers t
    JOIN shows s ON t.show_id = s.id
    WHERE t.id = ?
  `).get(tierId);
}

function getAvailable(tierId) {
  const tier = getTier(tierId);
  if (!tier) throw new Error('票档不存在');
  return {
    total: tier.total_quantity,
    sold: tier.sold_quantity,
    reserved: tier.reserved_quantity,
    available: tier.total_quantity - tier.sold_quantity - tier.reserved_quantity
  };
}

function deductInventory(tierId, quantity) {
  const db = getDb();
  
  const result = db.prepare(`
    UPDATE ticket_tiers
    SET sold_quantity = sold_quantity + ?
    WHERE id = ?
      AND status = 'active'
      AND (sold_quantity + reserved_quantity + ?) <= total_quantity
  `).run(quantity, tierId, quantity);

  if (result.changes === 0) {
    const avail = getAvailable(tierId);
    throw new Error(`库存不足，当前可售: ${avail.available} 张，需要: ${quantity} 张`);
  }

  return true;
}

function restoreInventory(tierId, quantity) {
  const db = getDb();
  
  db.prepare(`
    UPDATE ticket_tiers
    SET sold_quantity = MAX(0, sold_quantity - ?)
    WHERE id = ?
  `).run(quantity, tierId);

  return true;
}

function reserveInventory(tierId, quantity) {
  const db = getDb();
  
  const result = db.prepare(`
    UPDATE ticket_tiers
    SET reserved_quantity = reserved_quantity + ?
    WHERE id = ?
      AND status = 'active'
      AND (sold_quantity + reserved_quantity + ?) <= total_quantity
  `).run(quantity, tierId, quantity);

  return result.changes > 0;
}

function releaseReserve(tierId, quantity) {
  const db = getDb();
  
  db.prepare(`
    UPDATE ticket_tiers
    SET reserved_quantity = MAX(0, reserved_quantity - ?)
    WHERE id = ?
  `).run(quantity, tierId);

  return true;
}

function createShow(showData) {
  const db = getDb();
  const showId = uuidv4();
  
  db.prepare(`
    INSERT INTO shows (id, name, description, start_time, end_time, venue, status)
    VALUES (?, ?, ?, ?, ?, ?, 'active')
  `).run(showId, showData.name, showData.description || '', showData.start_time, showData.end_time || null, showData.venue || '');

  return showId;
}

function createTier(showId, tierData) {
  const db = getDb();
  const tierId = uuidv4();
  
  db.prepare(`
    INSERT INTO ticket_tiers (
      id, show_id, name, price, total_quantity, 
      sold_quantity, reserved_quantity,
      per_id_card_limit, per_account_limit, per_payment_limit, status
    ) VALUES (?, ?, ?, ?, ?, 0, 0, ?, ?, ?, 'active')
  `).run(
    tierId, showId, tierData.name, tierData.price, tierData.total_quantity,
    tierData.per_id_card_limit || null,
    tierData.per_account_limit || null,
    tierData.per_payment_limit || null
  );

  return tierId;
}

module.exports = {
  getTier,
  getAvailable,
  deductInventory,
  restoreInventory,
  reserveInventory,
  releaseReserve,
  createShow,
  createTier
};

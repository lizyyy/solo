const { v4: uuidv4 } = require('uuid');
const { getDb, transaction } = require('../db');
const { getTier, getAvailable, deductInventory } = require('./inventory');

function getQueuePosition(tierId) {
  const db = getDb();
  const result = db.prepare(`
    SELECT COALESCE(MAX(position), 0) + 1 as next_pos
    FROM queue_items
    WHERE tier_id = ? AND status = 'waiting'
  `).get(tierId);
  return result.next_pos;
}

function addToQueue(tierId, accountId, idCardNo, paymentChannel, quantity, expireMinutes = 30) {
  const db = getDb();
  const queueId = uuidv4();
  const position = getQueuePosition(tierId);
  const expireAt = new Date(Date.now() + expireMinutes * 60000).toISOString();

  db.prepare(`
    INSERT INTO queue_items (
      id, tier_id, account_id, id_card_no, payment_channel,
      quantity, position, status, expire_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, 'waiting', ?)
  `).run(
    queueId, tierId, accountId, idCardNo, paymentChannel,
    quantity, position, expireAt
  );

  return {
    queueId,
    position,
    status: 'waiting',
    estimateWait: `前面还有 ${position - 1} 人`
  };
}

function removeFromQueue(queueId) {
  const db = getDb();
  return db.prepare(`
    UPDATE queue_items
    SET status = 'cancelled'
    WHERE id = ? AND status = 'waiting'
  `).run(queueId).changes > 0;
}

function getQueueStatus(queueId) {
  const db = getDb();
  const item = db.prepare(`
    SELECT q.*, t.name as tier_name, s.name as show_name
    FROM queue_items q
    JOIN ticket_tiers t ON q.tier_id = t.id
    JOIN shows s ON t.show_id = s.id
    WHERE q.id = ?
  `).get(queueId);

  if (!item) return null;

  const ahead = db.prepare(`
    SELECT COUNT(*) as count
    FROM queue_items
    WHERE tier_id = ? AND status = 'waiting' AND position < ?
  `).get(item.tier_id, item.position).count;

  return {
    ...item,
    peopleAhead: ahead
  };
}

function getNextQueued(tierId, quantity = 1) {
  const db = getDb();
  const now = new Date().toISOString();

  const expired = db.prepare(`
    UPDATE queue_items
    SET status = 'expired'
    WHERE tier_id = ? AND status = 'waiting' AND expire_at < ?
  `).run(tierId, now);

  return db.prepare(`
    SELECT * FROM queue_items
    WHERE tier_id = ?
      AND status = 'waiting'
      AND quantity <= ?
    ORDER BY position ASC
    LIMIT 1
  `).get(tierId, quantity);
}

function processQueueForRelease(tierId, releasedQuantity) {
  const db = getDb();
  const results = [];
  let remaining = releasedQuantity;

  while (remaining > 0) {
    const next = getNextQueued(tierId, remaining);
    if (!next) break;

    try {
      deductInventory(tierId, next.quantity);
      
      db.prepare(`
        UPDATE queue_items
        SET status = 'matched'
        WHERE id = ?
      `).run(next.id);

      results.push({
        queueId: next.id,
        accountId: next.account_id,
        idCardNo: next.id_card_no,
        quantity: next.quantity,
        status: 'matched',
        action: '已匹配到票，待确认购买'
      });

      remaining -= next.quantity;
    } catch (e) {
      break;
    }
  }

  return {
    matched: results,
    remainingTickets: remaining
  };
}

function listQueue(tierId) {
  const db = getDb();
  return db.prepare(`
    SELECT q.*, s.name as show_name, t.name as tier_name
    FROM queue_items q
    JOIN ticket_tiers t ON q.tier_id = t.id
    JOIN shows s ON t.show_id = s.id
    WHERE q.tier_id = ?
    ORDER BY q.position ASC
  `).all(tierId);
}

module.exports = {
  addToQueue,
  removeFromQueue,
  getQueueStatus,
  getNextQueued,
  processQueueForRelease,
  listQueue,
  getQueuePosition
};

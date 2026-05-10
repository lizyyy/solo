const { v4: uuidv4 } = require('uuid');
const { getDb, transaction } = require('./database');
const config = require('./config');

const now = () => Math.floor(Date.now() / 1000);

const TicketStatus = {
  AVAILABLE: 'available',
  PENDING_PAYMENT: 'pending_payment',
  SOLD: 'sold',
  REFUNDED: 'refunded',
};

const QueueStatus = {
  WAITING: 'waiting',
  OFFERED: 'offered',
  ACCEPTED: 'accepted',
  REJECTED: 'rejected',
  EXPIRED: 'expired',
  SKIPPED: 'skipped',
};

const TransactionType = {
  PURCHASE: 'purchase',
  REFUND: 'refund',
  ESCALATION: 'escalation',
};

const TransactionStatus = {
  PENDING: 'pending',
  PAID: 'paid',
  CANCELLED: 'cancelled',
  REFUNDED: 'refunded',
};

const NotificationType = {
  TICKET_OFFER: 'ticket_offer',
  PAYMENT_SUCCESS: 'payment_success',
  PAYMENT_EXPIRED: 'payment_expired',
  REFUND_SUCCESS: 'refund_success',
  QUEUE_SKIPPED: 'queue_skipped',
};

const NotificationStatus = {
  PENDING: 'pending',
  SENT: 'sent',
  FAILED: 'failed',
};

function createTicket(eventId, seatNumber, price) {
  const db = getDb();
  const id = uuidv4();
  const timestamp = now();
  
  const stmt = db.prepare(`
    INSERT INTO tickets (id, event_id, seat_number, price, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  
  stmt.run(id, eventId, seatNumber, price, TicketStatus.AVAILABLE, timestamp, timestamp);
  return id;
}

function getAvailableTickets(eventId) {
  const db = getDb();
  return db.prepare(`
    SELECT * FROM tickets 
    WHERE event_id = ? AND status = ?
    ORDER BY seat_number ASC
  `).all(eventId, TicketStatus.AVAILABLE);
}

function getTicketById(ticketId) {
  const db = getDb();
  return db.prepare('SELECT * FROM tickets WHERE id = ?').get(ticketId);
}

function updateTicketStatus(ticketId, status, holderId = null, paymentDeadline = null) {
  const db = getDb();
  const timestamp = now();
  
  return db.prepare(`
    UPDATE tickets 
    SET status = ?, holder_id = ?, payment_deadline = ?, updated_at = ?
    WHERE id = ?
  `).run(status, holderId, paymentDeadline, timestamp, ticketId);
}

function joinWaitlist(eventId, userId, priority = 0) {
  return transaction(() => {
    const db = getDb();
    const timestamp = now();
    
    const existing = db.prepare(`
      SELECT * FROM waitlist_queue 
      WHERE event_id = ? AND user_id = ? AND status = ?
    `).get(eventId, userId, QueueStatus.WAITING);
    
    if (existing) {
      return existing.id;
    }
    
    const maxPosition = db.prepare(`
      SELECT MAX(position) as max_pos FROM waitlist_queue 
      WHERE event_id = ? AND status = ?
    `).get(eventId, QueueStatus.WAITING);
    
    const position = (maxPosition?.max_pos || 0) + 1;
    const id = uuidv4();
    
    db.prepare(`
      INSERT INTO waitlist_queue (id, event_id, user_id, priority, status, position, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, eventId, userId, priority, QueueStatus.WAITING, position, timestamp, timestamp);
    
    return id;
  });
}

function getWaitlist(eventId) {
  const db = getDb();
  return db.prepare(`
    SELECT * FROM waitlist_queue 
    WHERE event_id = ? AND status = ?
    ORDER BY priority DESC, position ASC
  `).all(eventId, QueueStatus.WAITING);
}

function getNextWaitlistUser(eventId) {
  const db = getDb();
  return db.prepare(`
    SELECT * FROM waitlist_queue 
    WHERE event_id = ? AND status = ?
    ORDER BY priority DESC, position ASC
    LIMIT 1
  `).get(eventId, QueueStatus.WAITING);
}

function updateQueueStatus(queueId, status, ticketId = null, paymentDeadline = null) {
  const db = getDb();
  const timestamp = now();
  
  return db.prepare(`
    UPDATE waitlist_queue 
    SET status = ?, ticket_id = ?, payment_deadline = ?, updated_at = ?
    WHERE id = ?
  `).run(status, ticketId, paymentDeadline, timestamp, queueId);
}

function createTransaction(ticketId, userId, type, amount, paymentDeadline = null) {
  const db = getDb();
  const id = uuidv4();
  const timestamp = now();
  
  db.prepare(`
    INSERT INTO transactions (id, ticket_id, user_id, type, status, amount, payment_deadline, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, ticketId, userId, type, TransactionStatus.PENDING, amount, paymentDeadline, timestamp, timestamp);
  
  return id;
}

function updateTransactionStatus(transactionId, status, paidAt = null) {
  const db = getDb();
  const timestamp = now();
  
  return db.prepare(`
    UPDATE transactions 
    SET status = ?, paid_at = ?, updated_at = ?
    WHERE id = ?
  `).run(status, paidAt, timestamp, transactionId);
}

function getTransactionById(transactionId) {
  const db = getDb();
  return db.prepare('SELECT * FROM transactions WHERE id = ?').get(transactionId);
}

function createNotification(userId, eventId, type, ticketId = null, extraData = {}) {
  const db = getDb();
  const id = uuidv4();
  const timestamp = now();
  const dedupKey = `${userId}:${eventId}:${type}:${ticketId || 'null'}:${id}`;
  
  try {
    db.prepare(`
      INSERT INTO notifications (id, user_id, event_id, ticket_id, type, dedup_key, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, userId, eventId, ticketId, type, dedupKey, NotificationStatus.PENDING, timestamp, timestamp);
    
    return id;
  } catch (err) {
    if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return db.prepare('SELECT id FROM notifications WHERE dedup_key = ?').get(dedupKey)?.id;
    }
    throw err;
  }
}

function updateNotificationStatus(notificationId, status, error = null) {
  const db = getDb();
  const timestamp = now();
  const attempts = db.prepare('SELECT attempts FROM notifications WHERE id = ?').get(notificationId)?.attempts || 0;
  
  const nextRetryAt = status === NotificationStatus.FAILED 
    ? timestamp + Math.pow(2, Math.min(attempts, 6)) * 60
    : null;
  
  const sentAt = status === NotificationStatus.SENT ? timestamp : null;
  
  return db.prepare(`
    UPDATE notifications 
    SET status = ?, attempts = attempts + 1, last_error = ?, next_retry_at = ?, sent_at = ?, updated_at = ?
    WHERE id = ?
  `).run(status, error, nextRetryAt, sentAt, timestamp, notificationId);
}

function createEscalationReport(eventId, ticketId, fromUserId, toUserId, skippedUserIds = [], reason = '') {
  const db = getDb();
  const id = uuidv4();
  const timestamp = now();
  
  db.prepare(`
    INSERT INTO escalation_reports (id, event_id, ticket_id, from_user_id, to_user_id, status, skipped_user_ids, reason, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, eventId, ticketId, fromUserId, toUserId, 'completed', JSON.stringify(skippedUserIds), reason, timestamp);
  
  return id;
}

function createFailedTask(taskType, payload, error = null) {
  const db = getDb();
  const id = uuidv4();
  const timestamp = now();
  
  db.prepare(`
    INSERT INTO failed_tasks (id, task_type, payload, attempts, last_error, next_retry_at, created_at, updated_at)
    VALUES (?, ?, ?, 1, ?, ?, ?, ?)
  `).run(id, taskType, JSON.stringify(payload), error, timestamp + 60, timestamp, timestamp);
  
  return id;
}

function getPendingNotifications() {
  const db = getDb();
  const timestamp = now();
  
  return db.prepare(`
    SELECT * FROM notifications 
    WHERE status = ? OR (status = ? AND next_retry_at <= ?)
    ORDER BY created_at ASC
  `).all(NotificationStatus.PENDING, NotificationStatus.FAILED, timestamp);
}

function getExpiredPaymentTickets() {
  const db = getDb();
  const timestamp = now();
  
  return db.prepare(`
    SELECT * FROM tickets 
    WHERE status = ? AND payment_deadline <= ?
  `).all(TicketStatus.PENDING_PAYMENT, timestamp);
}

function getExpiredQueueOffers() {
  const db = getDb();
  const timestamp = now();
  
  return db.prepare(`
    SELECT * FROM waitlist_queue 
    WHERE status = ? AND payment_deadline <= ?
  `).all(QueueStatus.OFFERED, timestamp);
}

function getRetryableFailedTasks() {
  const db = getDb();
  const timestamp = now();
  
  return db.prepare(`
    SELECT * FROM failed_tasks 
    WHERE attempts < ? AND next_retry_at <= ?
    ORDER BY next_retry_at ASC
  `).all(config.maxRetryAttempts, timestamp);
}

function deleteFailedTask(taskId) {
  const db = getDb();
  return db.prepare('DELETE FROM failed_tasks WHERE id = ?').run(taskId);
}

function updateFailedTask(taskId, error) {
  const db = getDb();
  const timestamp = now();
  const attempts = db.prepare('SELECT attempts FROM failed_tasks WHERE id = ?').get(taskId)?.attempts || 0;
  
  const nextRetryAt = timestamp + Math.pow(2, Math.min(attempts, 6)) * 60;
  
  return db.prepare(`
    UPDATE failed_tasks 
    SET attempts = attempts + 1, last_error = ?, next_retry_at = ?, updated_at = ?
    WHERE id = ?
  `).run(error, nextRetryAt, timestamp, taskId);
}

module.exports = {
  TicketStatus,
  QueueStatus,
  TransactionType,
  TransactionStatus,
  NotificationType,
  NotificationStatus,
  now,
  createTicket,
  getAvailableTickets,
  getTicketById,
  updateTicketStatus,
  joinWaitlist,
  getWaitlist,
  getNextWaitlistUser,
  updateQueueStatus,
  createTransaction,
  updateTransactionStatus,
  getTransactionById,
  createNotification,
  updateNotificationStatus,
  createEscalationReport,
  createFailedTask,
  getPendingNotifications,
  getExpiredPaymentTickets,
  getExpiredQueueOffers,
  getRetryableFailedTasks,
  deleteFailedTask,
  updateFailedTask,
};

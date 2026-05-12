const db = require('../database/db');

class Escalation {
  static create({ id, conversation_id, reason, priority = 5, requester = 'bot', idempotency_key = null, metadata = null }) {
    const escalation = {
      id,
      conversation_id,
      reason,
      priority,
      requested_at: db.now(),
      requester,
      idempotency_key,
      status: 'pending',
      metadata: metadata ? JSON.stringify(metadata) : null
    };
    db.prepare('escalation_requests').run(escalation);
    return this.findById(id);
  }

  static findById(id) {
    const row = db.prepare('escalation_requests').get(e => e.id === id);
    if (row && row.metadata) {
      return { ...row, metadata: JSON.parse(row.metadata) };
    }
    return row;
  }

  static findByIdempotencyKey(key) {
    const row = db.prepare('escalation_requests').get(e => e.idempotency_key === key);
    if (row && row.metadata) {
      return { ...row, metadata: JSON.parse(row.metadata) };
    }
    return row;
  }

  static findByConversation(conversation_id) {
    const rows = db.prepare('escalation_requests')
      .all(e => e.conversation_id === conversation_id)
      .sort((a, b) => new Date(b.requested_at) - new Date(a.requested_at));
    
    return rows.map(row => ({
      ...row,
      metadata: row.metadata ? JSON.parse(row.metadata) : null
    }));
  }

  static getActiveEscalation(conversation_id) {
    const rows = this.findByConversation(conversation_id);
    return rows.find(e => ['pending', 'queued', 'assigned', 'in_progress'].includes(e.status));
  }

  static updateStatus(id, status) {
    db.prepare('escalation_requests').update(e => e.id === id, () => ({ status }));
    return this.findById(id);
  }

  static hasRecentEscalation(conversation_id, hours = 24) {
    const threshold = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
    const rows = db.prepare('escalation_requests')
      .all(e => e.conversation_id === conversation_id 
             && e.requested_at >= threshold 
             && e.status !== 'cancelled');
    return rows.length > 0;
  }
}

module.exports = Escalation;

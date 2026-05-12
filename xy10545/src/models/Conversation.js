const db = require('../database/db');

class Conversation {
  static create({ id, user_id, channel = 'web' }) {
    const now = db.now();
    const conv = {
      id,
      user_id,
      channel,
      status: 'bot',
      created_at: now,
      updated_at: now,
      closed_at: null,
      summary: null
    };
    db.prepare('conversations').run(conv);
    return this.findById(id);
  }

  static findById(id) {
    return db.prepare('conversations').get(c => c.id === id);
  }

  static updateStatus(id, status, summary = null) {
    const now = db.now();
    const updater = (existing) => {
      const update = { status, updated_at: now };
      if (summary) update.summary = summary;
      if (status === 'closed' || status === 'completed') update.closed_at = now;
      return update;
    };
    db.prepare('conversations').update(c => c.id === id, updater);
    return this.findById(id);
  }

  static isClosed(id) {
    const conv = this.findById(id);
    return conv && ['closed', 'completed'].includes(conv.status);
  }

  static findAll(filters = {}) {
    let items = db.prepare('conversations').all();
    if (filters.status) {
      items = items.filter(c => c.status === filters.status);
    }
    if (filters.user_id) {
      items = items.filter(c => c.user_id === filters.user_id);
    }
    return items.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  }
}

module.exports = Conversation;

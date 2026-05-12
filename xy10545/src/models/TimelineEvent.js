const db = require('../database/db');

class TimelineEvent {
  static create({ id, conversation_id, event_type, event_data = null, status = null }) {
    const event = {
      id,
      conversation_id,
      event_type,
      event_data: event_data ? JSON.stringify(event_data) : null,
      status,
      created_at: db.now()
    };
    db.prepare('timeline_events').run(event);
    return this.findById(id);
  }

  static findById(id) {
    const row = db.prepare('timeline_events').get(t => t.id === id);
    if (row && row.event_data) {
      return { ...row, event_data: JSON.parse(row.event_data) };
    }
    return row;
  }

  static findByConversation(conversation_id) {
    const rows = db.prepare('timeline_events')
      .all(t => t.conversation_id === conversation_id)
      .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    
    return rows.map(row => ({
      ...row,
      event_data: row.event_data ? JSON.parse(row.event_data) : null
    }));
  }
}

module.exports = TimelineEvent;

const db = require('../database/db');

class Intent {
  static create({ id, conversation_id, intent_name, confidence = null, slot_values = null, source = 'bot' }) {
    const intent = {
      id,
      conversation_id,
      intent_name,
      confidence,
      slot_values: slot_values ? JSON.stringify(slot_values) : null,
      source,
      detected_at: db.now()
    };
    db.prepare('intents').run(intent);
    return this.findById(id);
  }

  static findById(id) {
    const row = db.prepare('intents').get(i => i.id === id);
    if (row && row.slot_values) {
      return { ...row, slot_values: JSON.parse(row.slot_values) };
    }
    return row;
  }

  static findByConversation(conversation_id) {
    const rows = db.prepare('intents')
      .all(i => i.conversation_id === conversation_id)
      .sort((a, b) => new Date(b.detected_at) - new Date(a.detected_at));
    
    return rows.map(row => ({
      ...row,
      slot_values: row.slot_values ? JSON.parse(row.slot_values) : null
    }));
  }

  static getPrimaryIntent(conversation_id) {
    const rows = this.findByConversation(conversation_id);
    if (rows.length === 0) return null;
    
    const sorted = rows.sort((a, b) => (b.confidence || 0) - (a.confidence || 0));
    return sorted[0];
  }
}

module.exports = Intent;

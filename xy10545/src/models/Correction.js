const db = require('../database/db');

class Correction {
  static create({ id, conversation_id, field_type, old_value, new_value, corrected_by, reason = null }) {
    const correction = {
      id,
      conversation_id,
      field_type,
      old_value,
      new_value,
      corrected_by,
      corrected_at: db.now(),
      reason
    };
    db.prepare('corrections').run(correction);
    return this.findById(id);
  }

  static findById(id) {
    return db.prepare('corrections').get(c => c.id === id);
  }

  static findByConversation(conversation_id) {
    return db.prepare('corrections')
      .all(c => c.conversation_id === conversation_id)
      .sort((a, b) => new Date(a.corrected_at) - new Date(b.corrected_at));
  }
}

module.exports = Correction;

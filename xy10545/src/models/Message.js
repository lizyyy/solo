const db = require('../database/db');

class Message {
  static create({ id, conversation_id, role, content }) {
    const msg = {
      id,
      conversation_id,
      role,
      content,
      created_at: db.now()
    };
    db.prepare('messages').run(msg);
    return this.findById(id);
  }

  static findById(id) {
    return db.prepare('messages').get(m => m.id === id);
  }

  static findByConversation(conversation_id) {
    return db.prepare('messages')
      .all(m => m.conversation_id === conversation_id)
      .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  }

  static getLastBotMessage(conversation_id) {
    const messages = db.prepare('messages')
      .all(m => m.conversation_id === conversation_id && m.role === 'bot')
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    return messages[0] || null;
  }
}

module.exports = Message;

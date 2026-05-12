const db = require('../database/db');

class Queue {
  static create({ id, conversation_id, escalation_id, priority_score = 5, emotion_type = null }) {
    const position = this.getNextPosition();
    const entry = {
      id,
      conversation_id,
      escalation_id,
      queue_position: position,
      priority_score,
      emotion_type,
      waiting_since: db.now(),
      assigned_agent_id: null,
      status: 'queued'
    };
    db.prepare('queue_entries').run(entry);
    return this.findById(id);
  }

  static findById(id) {
    return db.prepare('queue_entries').get(q => q.id === id);
  }

  static getNextPosition() {
    const queued = db.prepare('queue_entries').all(q => q.status === 'queued');
    if (queued.length === 0) return 1;
    return Math.max(...queued.map(q => q.queue_position || 0)) + 1;
  }

  static getQueue() {
    return db.prepare('queue_entries')
      .all(q => q.status === 'queued')
      .sort((a, b) => {
        if (b.priority_score !== a.priority_score) {
          return b.priority_score - a.priority_score;
        }
        return new Date(a.waiting_since) - new Date(b.waiting_since);
      });
  }

  static updateStatus(id, status, agent_id = null) {
    const updater = () => {
      const update = { status };
      if (agent_id !== null) update.assigned_agent_id = agent_id;
      return update;
    };
    db.prepare('queue_entries').update(q => q.id === id, updater);
    return this.findById(id);
  }

  static getByConversation(conversation_id) {
    const entries = db.prepare('queue_entries')
      .all(q => q.conversation_id === conversation_id)
      .sort((a, b) => new Date(b.waiting_since) - new Date(a.waiting_since));
    return entries[0] || null;
  }

  static getSize() {
    return db.prepare('queue_entries').all(q => q.status === 'queued').length;
  }

  static getPosition(conversation_id) {
    const allQueued = this.getQueue();
    const idx = allQueued.findIndex(q => q.conversation_id === conversation_id);
    return idx >= 0 ? idx + 1 : null;
  }
}

module.exports = Queue;

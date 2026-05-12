const db = require('../database/db');

class AgentHandler {
  static create({ id, conversation_id, agent_id, escalation_id }) {
    const handler = {
      id,
      conversation_id,
      agent_id,
      escalation_id,
      accepted_at: null,
      completed_at: null,
      rejected_at: null,
      status: 'assigned',
      notes: null
    };
    db.prepare('agent_handlers').run(handler);
    return this.findById(id);
  }

  static findById(id) {
    return db.prepare('agent_handlers').get(h => h.id === id);
  }

  static findByConversation(conversation_id) {
    return db.prepare('agent_handlers')
      .all(h => h.conversation_id === conversation_id)
      .sort((a, b) => new Date(b.accepted_at || 0) - new Date(a.accepted_at || 0));
  }

  static findActiveByConversation(conversation_id) {
    const handlers = db.prepare('agent_handlers').all(h => 
      h.conversation_id === conversation_id 
      && ['assigned', 'accepted', 'in_progress'].includes(h.status)
    ).sort((a, b) => new Date(b.accepted_at || 0) - new Date(a.accepted_at || 0));
    return handlers[0] || null;
  }

  static accept(id) {
    db.prepare('agent_handlers').update(
      h => h.id === id,
      () => ({ status: 'accepted', accepted_at: db.now() })
    );
    return this.findById(id);
  }

  static reject(id) {
    db.prepare('agent_handlers').update(
      h => h.id === id,
      () => ({ status: 'rejected', rejected_at: db.now() })
    );
    return this.findById(id);
  }

  static complete(id, notes = null) {
    const updater = () => {
      const update = { status: 'completed', completed_at: db.now() };
      if (notes) update.notes = notes;
      return update;
    };
    db.prepare('agent_handlers').update(h => h.id === id, updater);
    return this.findById(id);
  }

  static getAgentStats(agent_id) {
    const handlers = db.prepare('agent_handlers').all(h => h.agent_id === agent_id);
    return {
      total_handled: handlers.length,
      completed: handlers.filter(h => h.status === 'completed').length,
      rejected: handlers.filter(h => h.status === 'rejected').length
    };
  }
}

module.exports = AgentHandler;

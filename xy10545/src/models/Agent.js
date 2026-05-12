const db = require('../database/db');

class Agent {
  static create({ id, name, skills = null }) {
    const agent = {
      id,
      name,
      status: 'offline',
      current_conversation_id: null,
      skills: skills ? JSON.stringify(skills) : null,
      updated_at: db.now()
    };
    db.prepare('agents').run(agent);
    return this.findById(id);
  }

  static findById(id) {
    const row = db.prepare('agents').get(a => a.id === id);
    if (row && row.skills) {
      return { ...row, skills: JSON.parse(row.skills) };
    }
    return row;
  }

  static findAvailable() {
    const rows = db.prepare('agents').all(a => a.status === 'online' && a.current_conversation_id === null);
    return rows.map(row => ({
      ...row,
      skills: row.skills ? JSON.parse(row.skills) : null
    }));
  }

  static findAll() {
    const rows = db.prepare('agents').all()
      .sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));
    return rows.map(row => ({
      ...row,
      skills: row.skills ? JSON.parse(row.skills) : null
    }));
  }

  static updateStatus(id, status, current_conversation_id = undefined) {
    const updater = () => {
      const update = { status, updated_at: db.now() };
      if (current_conversation_id !== undefined) {
        update.current_conversation_id = current_conversation_id;
      }
      return update;
    };
    db.prepare('agents').update(a => a.id === id, updater);
    return this.findById(id);
  }

  static getOnlineCount() {
    return db.prepare('agents').all(a => a.status === 'online').length;
  }

  static getStats() {
    const all = db.prepare('agents').all();
    const online = all.filter(a => a.status === 'online').length;
    const busy = all.filter(a => a.current_conversation_id !== null).length;
    return {
      total_agents: all.length,
      online_agents: online,
      busy_agents: busy
    };
  }
}

module.exports = Agent;

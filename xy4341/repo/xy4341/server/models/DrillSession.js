const { v4: uuidv4 } = require('uuid');
const { query, run } = require('../database/db');

class DrillSession {
  constructor(data) {
    this.id = data.id || uuidv4();
    this.name = data.name;
    this.status = data.status || 'created';
    this.start_time = data.start_time;
    this.end_time = data.end_time;
    this.current_time_step = data.current_time_step || 0;
    this.is_paused = data.is_paused || 0;
    this.created_at = data.created_at || new Date().toISOString();
    this.updated_at = data.updated_at || new Date().toISOString();
  }

  static create(data) {
    const session = new DrillSession(data);
    run(
      `INSERT INTO drill_sessions (id, name, status, start_time, end_time, current_time_step, is_paused, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [session.id, session.name, session.status, session.start_time, session.end_time, session.current_time_step, session.is_paused, session.created_at, session.updated_at]
    );
    return session;
  }

  static findById(id) {
    const results = query('SELECT * FROM drill_sessions WHERE id = ?', [id]);
    if (results.length === 0) return null;
    return new DrillSession(results[0]);
  }

  static findActive() {
    const results = query(
      `SELECT * FROM drill_sessions WHERE status IN ('created', 'running', 'paused') ORDER BY created_at DESC LIMIT 1`
    );
    if (results.length === 0) return null;
    return new DrillSession(results[0]);
  }

  static findAll() {
    const results = query('SELECT * FROM drill_sessions ORDER BY created_at DESC');
    return results.map(row => new DrillSession(row));
  }

  static update(id, data) {
    const updateFields = [];
    const values = [];
    
    if (data.name !== undefined) {
      updateFields.push('name = ?');
      values.push(data.name);
    }
    if (data.status !== undefined) {
      updateFields.push('status = ?');
      values.push(data.status);
    }
    if (data.start_time !== undefined) {
      updateFields.push('start_time = ?');
      values.push(data.start_time);
    }
    if (data.end_time !== undefined) {
      updateFields.push('end_time = ?');
      values.push(data.end_time);
    }
    if (data.current_time_step !== undefined) {
      updateFields.push('current_time_step = ?');
      values.push(data.current_time_step);
    }
    if (data.is_paused !== undefined) {
      updateFields.push('is_paused = ?');
      values.push(data.is_paused);
    }
    
    updateFields.push('updated_at = ?');
    values.push(new Date().toISOString());
    values.push(id);
    
    run(
      `UPDATE drill_sessions SET ${updateFields.join(', ')} WHERE id = ?`,
      values
    );
    
    return DrillSession.findById(id);
  }

  static delete(id) {
    run('DELETE FROM drill_sessions WHERE id = ?', [id]);
  }

  start() {
    return DrillSession.update(this.id, {
      status: 'running',
      start_time: new Date().toISOString(),
      is_paused: 0
    });
  }

  pause() {
    return DrillSession.update(this.id, {
      is_paused: 1
    });
  }

  resume() {
    return DrillSession.update(this.id, {
      is_paused: 0
    });
  }

  complete() {
    return DrillSession.update(this.id, {
      status: 'completed',
      end_time: new Date().toISOString()
    });
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      status: this.status,
      start_time: this.start_time,
      end_time: this.end_time,
      current_time_step: this.current_time_step,
      is_paused: this.is_paused,
      created_at: this.created_at,
      updated_at: this.updated_at
    };
  }
}

module.exports = DrillSession;

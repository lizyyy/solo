const { v4: uuidv4 } = require('uuid');
const { query, run } = require('../database/db');

class DrillEvent {
  constructor(data) {
    this.id = data.id || uuidv4();
    this.drill_session_id = data.drill_session_id;
    this.time_step = data.time_step;
    this.event_type = data.event_type;
    this.description = data.description;
    this.data = data.data ? JSON.stringify(data.data) : null;
    this.created_at = data.created_at || new Date().toISOString();
  }

  static create(data) {
    const event = new DrillEvent(data);
    run(
      `INSERT INTO drill_events (id, drill_session_id, time_step, event_type, description, data, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [event.id, event.drill_session_id, event.time_step, event.event_type, event.description, event.data, event.created_at]
    );
    return event;
  }

  static findById(id) {
    const results = query('SELECT * FROM drill_events WHERE id = ?', [id]);
    if (results.length === 0) return null;
    return new DrillEvent(results[0]);
  }

  static findByDrillSessionId(drillSessionId) {
    const results = query(
      'SELECT * FROM drill_events WHERE drill_session_id = ? ORDER BY time_step ASC, created_at ASC',
      [drillSessionId]
    );
    return results.map(row => new DrillEvent(row));
  }

  static findByDrillSessionIdAndTimeStep(drillSessionId, timeStep) {
    const results = query(
      'SELECT * FROM drill_events WHERE drill_session_id = ? AND time_step = ? ORDER BY created_at ASC',
      [drillSessionId, timeStep]
    );
    return results.map(row => new DrillEvent(row));
  }

  static findByEventType(drillSessionId, eventType) {
    const results = query(
      'SELECT * FROM drill_events WHERE drill_session_id = ? AND event_type = ? ORDER BY time_step ASC',
      [drillSessionId, eventType]
    );
    return results.map(row => new DrillEvent(row));
  }

  static findAll() {
    const results = query('SELECT * FROM drill_events ORDER BY created_at DESC');
    return results.map(row => new DrillEvent(row));
  }

  static delete(id) {
    run('DELETE FROM drill_events WHERE id = ?', [id]);
  }

  static deleteByDrillSessionId(drillSessionId) {
    run('DELETE FROM drill_events WHERE drill_session_id = ?', [drillSessionId]);
  }

  toJSON() {
    return {
      id: this.id,
      drill_session_id: this.drill_session_id,
      time_step: this.time_step,
      event_type: this.event_type,
      description: this.description,
      data: this.data ? JSON.parse(this.data) : null,
      created_at: this.created_at
    };
  }
}

module.exports = DrillEvent;

const { v4: uuidv4 } = require('uuid');
const { query, run } = require('../database/db');

class SimulationSnapshot {
  constructor(data) {
    this.id = data.id || uuidv4();
    this.drill_session_id = data.drill_session_id;
    this.time_step = data.time_step;
    this.snapshot_data = data.snapshot_data ? JSON.stringify(data.snapshot_data) : null;
    this.created_at = data.created_at || new Date().toISOString();
  }

  static create(data) {
    const snapshot = new SimulationSnapshot(data);
    run(
      `INSERT INTO simulation_snapshots (id, drill_session_id, time_step, snapshot_data, created_at)
       VALUES (?, ?, ?, ?, ?)`,
      [snapshot.id, snapshot.drill_session_id, snapshot.time_step, snapshot.snapshot_data, snapshot.created_at]
    );
    return snapshot;
  }

  static findById(id) {
    const results = query('SELECT * FROM simulation_snapshots WHERE id = ?', [id]);
    if (results.length === 0) return null;
    return new SimulationSnapshot(results[0]);
  }

  static findByDrillSessionId(drillSessionId) {
    const results = query(
      'SELECT * FROM simulation_snapshots WHERE drill_session_id = ? ORDER BY time_step ASC',
      [drillSessionId]
    );
    return results.map(row => new SimulationSnapshot(row));
  }

  static findByDrillSessionIdAndTimeStep(drillSessionId, timeStep) {
    const results = query(
      'SELECT * FROM simulation_snapshots WHERE drill_session_id = ? AND time_step = ?',
      [drillSessionId, timeStep]
    );
    if (results.length === 0) return null;
    return new SimulationSnapshot(results[0]);
  }

  static getLatestByDrillSessionId(drillSessionId) {
    const results = query(
      `SELECT * FROM simulation_snapshots 
       WHERE drill_session_id = ? 
       ORDER BY time_step DESC LIMIT 1`,
      [drillSessionId]
    );
    if (results.length === 0) return null;
    return new SimulationSnapshot(results[0]);
  }

  static findAll() {
    const results = query('SELECT * FROM simulation_snapshots ORDER BY created_at DESC');
    return results.map(row => new SimulationSnapshot(row));
  }

  static delete(id) {
    run('DELETE FROM simulation_snapshots WHERE id = ?', [id]);
  }

  static deleteByDrillSessionId(drillSessionId) {
    run('DELETE FROM simulation_snapshots WHERE drill_session_id = ?', [drillSessionId]);
  }

  toJSON() {
    return {
      id: this.id,
      drill_session_id: this.drill_session_id,
      time_step: this.time_step,
      snapshot_data: this.snapshot_data ? JSON.parse(this.snapshot_data) : null,
      created_at: this.created_at
    };
  }
}

module.exports = SimulationSnapshot;

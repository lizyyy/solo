const { v4: uuidv4 } = require('uuid');
const { query, run } = require('../database/db');

class FirePoint {
  constructor(data) {
    this.id = data.id || uuidv4();
    this.drill_session_id = data.drill_session_id;
    this.floor_id = data.floor_id;
    this.x = data.x;
    this.y = data.y;
    this.intensity = data.intensity || 1.0;
    this.radius = data.radius || 5.0;
    this.time_step = data.time_step || 0;
    this.created_at = data.created_at || new Date().toISOString();
  }

  static create(data) {
    const firePoint = new FirePoint(data);
    run(
      `INSERT INTO fire_points (id, drill_session_id, floor_id, x, y, intensity, radius, time_step, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [firePoint.id, firePoint.drill_session_id, firePoint.floor_id, firePoint.x, firePoint.y, firePoint.intensity, firePoint.radius, firePoint.time_step, firePoint.created_at]
    );
    return firePoint;
  }

  static findById(id) {
    const results = query('SELECT * FROM fire_points WHERE id = ?', [id]);
    if (results.length === 0) return null;
    return new FirePoint(results[0]);
  }

  static findByDrillSessionId(drillSessionId) {
    const results = query('SELECT * FROM fire_points WHERE drill_session_id = ? ORDER BY time_step ASC', [drillSessionId]);
    return results.map(row => new FirePoint(row));
  }

  static findByFloorId(floorId, drillSessionId) {
    const results = query(
      'SELECT * FROM fire_points WHERE floor_id = ? AND drill_session_id = ? ORDER BY time_step ASC',
      [floorId, drillSessionId]
    );
    return results.map(row => new FirePoint(row));
  }

  static findByDrillAndFloor(drillSessionId, floorId) {
    const results = query(
      'SELECT * FROM fire_points WHERE drill_session_id = ? AND floor_id = ? ORDER BY time_step ASC',
      [drillSessionId, floorId]
    );
    return results.map(row => new FirePoint(row));
  }

  static findAll() {
    const results = query('SELECT * FROM fire_points ORDER BY created_at DESC');
    return results.map(row => new FirePoint(row));
  }

  static update(id, data) {
    const updateFields = [];
    const values = [];
    
    if (data.x !== undefined) {
      updateFields.push('x = ?');
      values.push(data.x);
    }
    if (data.y !== undefined) {
      updateFields.push('y = ?');
      values.push(data.y);
    }
    if (data.intensity !== undefined) {
      updateFields.push('intensity = ?');
      values.push(data.intensity);
    }
    if (data.radius !== undefined) {
      updateFields.push('radius = ?');
      values.push(data.radius);
    }
    if (data.time_step !== undefined) {
      updateFields.push('time_step = ?');
      values.push(data.time_step);
    }
    
    run(
      `UPDATE fire_points SET ${updateFields.join(', ')} WHERE id = ?`,
      [...values, id]
    );
    
    return FirePoint.findById(id);
  }

  static delete(id) {
    run('DELETE FROM fire_points WHERE id = ?', [id]);
  }

  static deleteByDrillSessionId(drillSessionId) {
    run('DELETE FROM fire_points WHERE drill_session_id = ?', [drillSessionId]);
  }

  toJSON() {
    return {
      id: this.id,
      drill_session_id: this.drill_session_id,
      floor_id: this.floor_id,
      x: this.x,
      y: this.y,
      intensity: this.intensity,
      radius: this.radius,
      time_step: this.time_step,
      created_at: this.created_at
    };
  }
}

module.exports = FirePoint;

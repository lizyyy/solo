const { v4: uuidv4 } = require('uuid');
const { query, run } = require('../database/db');

class BroadcastSchedule {
  constructor(data) {
    this.id = data.id || uuidv4();
    this.drill_session_id = data.drill_session_id;
    this.time_step = data.time_step;
    this.message = data.message;
    this.is_broadcasted = data.is_broadcasted || 0;
    this.created_at = data.created_at || new Date().toISOString();
  }

  static create(data) {
    const schedule = new BroadcastSchedule(data);
    run(
      `INSERT INTO broadcast_schedule (id, drill_session_id, time_step, message, is_broadcasted, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [schedule.id, schedule.drill_session_id, schedule.time_step, schedule.message, schedule.is_broadcasted, schedule.created_at]
    );
    return schedule;
  }

  static bulkCreate(schedulesData) {
    const createdSchedules = [];
    for (const data of schedulesData) {
      const schedule = BroadcastSchedule.create(data);
      createdSchedules.push(schedule);
    }
    return createdSchedules;
  }

  static findById(id) {
    const results = query('SELECT * FROM broadcast_schedule WHERE id = ?', [id]);
    if (results.length === 0) return null;
    return new BroadcastSchedule(results[0]);
  }

  static findByDrillSessionId(drillSessionId) {
    const results = query(
      'SELECT * FROM broadcast_schedule WHERE drill_session_id = ? ORDER BY time_step ASC',
      [drillSessionId]
    );
    return results.map(row => new BroadcastSchedule(row));
  }

  static findByDrillSessionIdAndTimeStep(drillSessionId, timeStep) {
    const results = query(
      'SELECT * FROM broadcast_schedule WHERE drill_session_id = ? AND time_step = ? AND is_broadcasted = 0 ORDER BY created_at ASC',
      [drillSessionId, timeStep]
    );
    return results.map(row => new BroadcastSchedule(row));
  }

  static findPendingByTimeStep(drillSessionId, timeStep) {
    const results = query(
      `SELECT * FROM broadcast_schedule 
       WHERE drill_session_id = ? AND time_step <= ? AND is_broadcasted = 0 
       ORDER BY time_step ASC`,
      [drillSessionId, timeStep]
    );
    return results.map(row => new BroadcastSchedule(row));
  }

  static findAll() {
    const results = query('SELECT * FROM broadcast_schedule ORDER BY created_at DESC');
    return results.map(row => new BroadcastSchedule(row));
  }

  static update(id, data) {
    const updateFields = [];
    const values = [];
    
    if (data.time_step !== undefined) {
      updateFields.push('time_step = ?');
      values.push(data.time_step);
    }
    if (data.message !== undefined) {
      updateFields.push('message = ?');
      values.push(data.message);
    }
    if (data.is_broadcasted !== undefined) {
      updateFields.push('is_broadcasted = ?');
      values.push(data.is_broadcasted);
    }
    
    run(
      `UPDATE broadcast_schedule SET ${updateFields.join(', ')} WHERE id = ?`,
      [...values, id]
    );
    
    return BroadcastSchedule.findById(id);
  }

  static markAsBroadcasted(id) {
    return BroadcastSchedule.update(id, { is_broadcasted: 1 });
  }

  static delete(id) {
    run('DELETE FROM broadcast_schedule WHERE id = ?', [id]);
  }

  static deleteByDrillSessionId(drillSessionId) {
    run('DELETE FROM broadcast_schedule WHERE drill_session_id = ?', [drillSessionId]);
  }

  toJSON() {
    return {
      id: this.id,
      drill_session_id: this.drill_session_id,
      time_step: this.time_step,
      message: this.message,
      is_broadcasted: this.is_broadcasted,
      created_at: this.created_at
    };
  }
}

module.exports = BroadcastSchedule;

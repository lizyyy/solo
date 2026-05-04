const { v4: uuidv4 } = require('uuid');
const { query, run } = require('../database/db');

class RiskAssessment {
  constructor(data) {
    this.id = data.id || uuidv4();
    this.drill_session_id = data.drill_session_id;
    this.time_step = data.time_step;
    this.floor_id = data.floor_id;
    this.overall_score = data.overall_score;
    this.congestion_score = data.congestion_score || 0;
    this.fire_spread_score = data.fire_spread_score || 0;
    this.exit_availability_score = data.exit_availability_score || 0;
    this.evacuation_progress_score = data.evacuation_progress_score || 0;
    this.details = data.details ? JSON.stringify(data.details) : null;
    this.created_at = data.created_at || new Date().toISOString();
  }

  static create(data) {
    const assessment = new RiskAssessment(data);
    run(
      `INSERT INTO risk_assessments (id, drill_session_id, time_step, floor_id, overall_score, congestion_score, fire_spread_score, exit_availability_score, evacuation_progress_score, details, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [assessment.id, assessment.drill_session_id, assessment.time_step, assessment.floor_id, assessment.overall_score, assessment.congestion_score, assessment.fire_spread_score, assessment.exit_availability_score, assessment.evacuation_progress_score, assessment.details, assessment.created_at]
    );
    return assessment;
  }

  static findById(id) {
    const results = query('SELECT * FROM risk_assessments WHERE id = ?', [id]);
    if (results.length === 0) return null;
    return new RiskAssessment(results[0]);
  }

  static findByDrillSessionId(drillSessionId) {
    const results = query(
      'SELECT * FROM risk_assessments WHERE drill_session_id = ? ORDER BY time_step ASC',
      [drillSessionId]
    );
    return results.map(row => new RiskAssessment(row));
  }

  static findByDrillSessionIdAndTimeStep(drillSessionId, timeStep) {
    const results = query(
      'SELECT * FROM risk_assessments WHERE drill_session_id = ? AND time_step = ? ORDER BY floor_id ASC',
      [drillSessionId, timeStep]
    );
    return results.map(row => new RiskAssessment(row));
  }

  static findByDrillSessionIdAndFloorId(drillSessionId, floorId) {
    const results = query(
      'SELECT * FROM risk_assessments WHERE drill_session_id = ? AND floor_id = ? ORDER BY time_step ASC',
      [drillSessionId, floorId]
    );
    return results.map(row => new RiskAssessment(row));
  }

  static getLatestByDrillSessionId(drillSessionId) {
    const results = query(
      `SELECT * FROM risk_assessments 
       WHERE drill_session_id = ? AND floor_id IS NULL 
       ORDER BY time_step DESC LIMIT 1`,
      [drillSessionId]
    );
    if (results.length === 0) return null;
    return new RiskAssessment(results[0]);
  }

  static findLatestByDrillSession(drillSessionId) {
    return RiskAssessment.getLatestByDrillSessionId(drillSessionId);
  }

  static findAll() {
    const results = query('SELECT * FROM risk_assessments ORDER BY created_at DESC');
    return results.map(row => new RiskAssessment(row));
  }

  static delete(id) {
    run('DELETE FROM risk_assessments WHERE id = ?', [id]);
  }

  static deleteByDrillSessionId(drillSessionId) {
    run('DELETE FROM risk_assessments WHERE drill_session_id = ?', [drillSessionId]);
  }

  static getRiskLevel(score) {
    if (score >= 80) return 'critical';
    if (score >= 60) return 'high';
    if (score >= 40) return 'medium';
    if (score >= 20) return 'low';
    return 'safe';
  }

  toJSON() {
    return {
      id: this.id,
      drill_session_id: this.drill_session_id,
      time_step: this.time_step,
      floor_id: this.floor_id,
      overall_score: this.overall_score,
      risk_level: RiskAssessment.getRiskLevel(this.overall_score),
      congestion_score: this.congestion_score,
      fire_spread_score: this.fire_spread_score,
      exit_availability_score: this.exit_availability_score,
      evacuation_progress_score: this.evacuation_progress_score,
      details: this.details ? JSON.parse(this.details) : null,
      created_at: this.created_at
    };
  }
}

module.exports = RiskAssessment;

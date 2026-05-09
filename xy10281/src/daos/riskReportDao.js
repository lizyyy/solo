const db = require('../config/database');

class RiskReportDao {
  static all(includeResolved = false) {
    const query = includeResolved
      ? 'SELECT * FROM risk_reports ORDER BY created_at DESC'
      : 'SELECT * FROM risk_reports WHERE is_resolved = 0 ORDER BY created_at DESC';
    return new Promise((resolve, reject) => {
      db.all(query, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  static getById(id) {
    return new Promise((resolve, reject) => {
      db.get('SELECT * FROM risk_reports WHERE id = ?', [id], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  static getByFishGroupId(fishGroupId, includeResolved = false) {
    const query = includeResolved
      ? 'SELECT * FROM risk_reports WHERE fish_group_id = ? ORDER BY created_at DESC'
      : 'SELECT * FROM risk_reports WHERE fish_group_id = ? AND is_resolved = 0 ORDER BY created_at DESC';
    return new Promise((resolve, reject) => {
      db.all(query, [fishGroupId], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  static create(data) {
    return new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO risk_reports 
         (id, fish_group_id, disease, risk_level, risk_score, assessment_date, affected_count, spread_risk, recommendations)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          data.id,
          data.fishGroupId,
          data.disease || null,
          data.riskLevel,
          data.riskScore || 0,
          data.assessmentDate,
          data.affectedCount || 0,
          data.spreadRisk || null,
          data.recommendations || null
        ],
        function(err) {
          if (err) reject(err);
          else resolve(data);
        }
      );
    });
  }

  static resolve(id) {
    return new Promise((resolve, reject) => {
      db.run(
        'UPDATE risk_reports SET is_resolved = 1, resolved_at = CURRENT_TIMESTAMP WHERE id = ?',
        [id],
        function(err) {
          if (err) reject(err);
          else resolve({ changes: this.changes });
        }
      );
    });
  }
}

module.exports = RiskReportDao;

const db = require('../config/database');

class IsolationRuleDao {
  static all(activeOnly = true) {
    const query = activeOnly 
      ? 'SELECT * FROM isolation_rules WHERE is_active = 1 ORDER BY priority DESC'
      : 'SELECT * FROM isolation_rules ORDER BY priority DESC';
    return new Promise((resolve, reject) => {
      db.all(query, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  static getById(id) {
    return new Promise((resolve, reject) => {
      db.get('SELECT * FROM isolation_rules WHERE id = ?', [id], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  static getByDisease(diseaseName) {
    return new Promise((resolve, reject) => {
      db.get(
        'SELECT * FROM isolation_rules WHERE disease_name = ? AND is_active = 1',
        [diseaseName],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });
  }

  static create(data) {
    return new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO isolation_rules 
         (id, disease_name, affected_species, required_tank_type, min_ph, max_ph, 
          min_temperature, max_temperature, max_salinity, min_quality_score, quarantine_days, priority, is_active)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          data.id,
          data.diseaseName,
          data.affectedSpecies || null,
          data.requiredTankType,
          data.minPh || null,
          data.maxPh || null,
          data.minTemperature || null,
          data.maxTemperature || null,
          data.maxSalinity || null,
          data.minQualityScore || null,
          data.quarantineDays || 14,
          data.priority || 1,
          data.isActive !== false ? 1 : 0
        ],
        function(err) {
          if (err) reject(err);
          else resolve(data);
        }
      );
    });
  }
}

module.exports = IsolationRuleDao;

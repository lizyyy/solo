const { getDb } = require('../src/database');

class CompensationRule {
  static create(data) {
    return new Promise((resolve, reject) => {
      const db = getDb();
      const stmt = db.prepare(`
        INSERT INTO compensation_rules (rule_type, condition, action, value, description, is_active)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      stmt.run(
        data.rule_type,
        data.condition || '',
        data.action,
        data.value || 0,
        data.description || '',
        data.is_active !== undefined ? data.is_active : 1,
        function(err) {
          if (err) reject(err);
          else resolve(this.lastID);
        }
      );
    });
  }

  static findActive() {
    return new Promise((resolve, reject) => {
      const db = getDb();
      db.all('SELECT * FROM compensation_rules WHERE is_active = 1 ORDER BY id', (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  static findByType(ruleType) {
    return new Promise((resolve, reject) => {
      const db = getDb();
      db.all('SELECT * FROM compensation_rules WHERE rule_type = ? AND is_active = 1', [ruleType], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }
}

module.exports = CompensationRule;

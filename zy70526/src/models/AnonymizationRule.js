const db = require('../database/db');
const { v4: uuidv4 } = require('uuid');

class AnonymizationRule {
  static async create(data) {
    return new Promise((resolve, reject) => {
      db.get(
        'SELECT MAX(version) as max_version FROM anonymization_rules WHERE name = ?',
        [data.name],
        async (err, row) => {
          if (err) {
            reject(err);
            return;
          }
          
          const version = (row?.max_version || 0) + 1;
          const id = uuidv4();
          const { name, description, rule_type, config, created_by } = data;
          const configJson = JSON.stringify(config);
          
          db.run(
            `INSERT INTO anonymization_rules (id, version, name, description, rule_type, config, created_by)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [id, version, name, description, rule_type, configJson, created_by],
            function(err) {
              if (err) reject(err);
              else resolve({ id, version, ...data, is_active: true });
            }
          );
        }
      );
    });
  }

  static findById(id) {
    return new Promise((resolve, reject) => {
      db.get('SELECT * FROM anonymization_rules WHERE id = ?', [id], (err, row) => {
        if (err) reject(err);
        else if (row) {
          row.config = JSON.parse(row.config);
          resolve(row);
        } else resolve(null);
      });
    });
  }

  static findByName(name) {
    return new Promise((resolve, reject) => {
      db.all(
        'SELECT * FROM anonymization_rules WHERE name = ? ORDER BY version DESC',
        [name],
        (err, rows) => {
          if (err) reject(err);
          else {
            rows.forEach(row => {
              row.config = JSON.parse(row.config);
            });
            resolve(rows);
          }
        }
      );
    });
  }

  static findAllActive() {
    return new Promise((resolve, reject) => {
      db.all(
        'SELECT * FROM anonymization_rules WHERE is_active = 1 ORDER BY name, version DESC',
        [],
        (err, rows) => {
          if (err) reject(err);
          else {
            rows.forEach(row => {
              row.config = JSON.parse(row.config);
            });
            resolve(rows);
          }
        }
      );
    });
  }

  static deactivate(id) {
    return new Promise((resolve, reject) => {
      db.run(
        'UPDATE anonymization_rules SET is_active = 0 WHERE id = ?',
        [id],
        function(err) {
          if (err) reject(err);
          else resolve(this.changes > 0);
        }
      );
    });
  }
}

module.exports = AnonymizationRule;
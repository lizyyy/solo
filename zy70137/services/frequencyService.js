const db = require('../db');
const { v4: uuidv4 } = require('uuid');

const frequencyService = {
  getAllRules: () => {
    return new Promise((resolve, reject) => {
      db.all('SELECT * FROM frequency_rules ORDER BY type, scope', (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  },

  getActiveRules: () => {
    return new Promise((resolve, reject) => {
      db.all('SELECT * FROM frequency_rules WHERE is_active = 1 ORDER BY type, scope', (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  },

  getRuleById: (id) => {
    return new Promise((resolve, reject) => {
      db.get('SELECT * FROM frequency_rules WHERE id = ?', [id], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  },

  createRule: (ruleData) => {
    return new Promise((resolve, reject) => {
      const id = uuidv4();
      const now = new Date().toISOString();
      const { name, type, scope, limit_count, time_window, unit, is_active = 1 } = ruleData;
      
      db.run(
        `INSERT INTO frequency_rules (id, name, type, scope, limit_count, time_window, unit, is_active, created_at, updated_at) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, name, type, scope, limit_count, time_window, unit, is_active, now, now],
        function(err) {
          if (err) reject(err);
          else resolve({ id, ...ruleData, created_at: now, updated_at: now });
        }
      );
    });
  },

  updateRule: (id, ruleData) => {
    return new Promise((resolve, reject) => {
      const now = new Date().toISOString();
      const { name, type, scope, limit_count, time_window, unit, is_active } = ruleData;
      
      db.run(
        `UPDATE frequency_rules SET name = ?, type = ?, scope = ?, limit_count = ?, 
         time_window = ?, unit = ?, is_active = ?, updated_at = ? WHERE id = ?`,
        [name, type, scope, limit_count, time_window, unit, is_active, now, id],
        function(err) {
          if (err) reject(err);
          else resolve({ id, ...ruleData, updated_at: now });
        }
      );
    });
  },

  deleteRule: (id) => {
    return new Promise((resolve, reject) => {
      db.run('DELETE FROM frequency_rules WHERE id = ?', [id], function(err) {
        if (err) reject(err);
        else resolve({ affected: this.changes });
      });
    });
  },

  toggleRule: (id, is_active) => {
    return new Promise((resolve, reject) => {
      const now = new Date().toISOString();
      db.run('UPDATE frequency_rules SET is_active = ?, updated_at = ? WHERE id = ?', 
        [is_active ? 1 : 0, now, id], 
        function(err) {
          if (err) reject(err);
          else resolve({ id, is_active: is_active ? 1 : 0, affected: this.changes });
        }
      );
    });
  }
};

module.exports = frequencyService;

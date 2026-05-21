const db = require('../models/database');
const fs = require('fs');

class RuleService {
  async importRulesFromJSON(filePath) {
    return new Promise((resolve, reject) => {
      fs.readFile(filePath, 'utf8', async (err, data) => {
        if (err) {
          reject(err);
          return;
        }

        try {
          const rules = JSON.parse(data);
          const results = [];

          for (const rule of rules) {
            try {
              const result = await this.addRule(
                rule.ruleCode,
                rule.ruleName,
                rule.ruleType,
                rule.condition,
                rule.action,
                rule.reason,
                rule.isActive !== false
              );
              results.push({ ...result, success: true });
            } catch (e) {
              results.push({ ruleCode: rule.ruleCode, success: false, error: e.message });
            }
          }

          resolve({
            total: rules.length,
            imported: results.filter(r => r.success).length,
            failed: results.filter(r => !r.success).length,
            details: results
          });
        } catch (parseErr) {
          reject(parseErr);
        }
      });
    });
  }

  async addRule(ruleCode, ruleName, ruleType, condition, action, reason, isActive = true) {
    return new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO rules (rule_code, rule_name, rule_type, condition_json, action, reason, is_active)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          ruleCode,
          ruleName,
          ruleType,
          JSON.stringify(condition),
          action,
          reason,
          isActive ? 1 : 0
        ],
        function(err) {
          if (err) {
            if (err.message.includes('UNIQUE constraint')) {
              reject(new Error(`规则编码 ${ruleCode} 已存在`));
            } else {
              reject(err);
            }
            return;
          }
          resolve({ id: this.lastID, ruleCode });
        }
      );
    });
  }

  async getAllRules(activeOnly = false) {
    return new Promise((resolve, reject) => {
      let sql = `SELECT * FROM rules`;
      const params = [];

      if (activeOnly) {
        sql += ` WHERE is_active = 1`;
      }

      sql += ` ORDER BY id ASC`;

      db.all(sql, params, (err, rows) => {
        if (err) {
          reject(err);
          return;
        }

        const rules = rows.map(row => ({
          id: row.id,
          ruleCode: row.rule_code,
          ruleName: row.rule_name,
          ruleType: row.rule_type,
          condition: JSON.parse(row.condition_json),
          action: row.action,
          reason: row.reason,
          isActive: row.is_active === 1,
          createdAt: row.created_at
        }));

        resolve(rules);
      });
    });
  }

  async getRuleById(id) {
    return new Promise((resolve, reject) => {
      db.get(`SELECT * FROM rules WHERE id = ?`, [id], (err, row) => {
        if (err) {
          reject(err);
          return;
        }

        if (!row) {
          resolve(null);
          return;
        }

        resolve({
          id: row.id,
          ruleCode: row.rule_code,
          ruleName: row.rule_name,
          ruleType: row.rule_type,
          condition: JSON.parse(row.condition_json),
          action: row.action,
          reason: row.reason,
          isActive: row.is_active === 1,
          createdAt: row.created_at
        });
      });
    });
  }

  async updateRule(id, updates) {
    return new Promise((resolve, reject) => {
      const fields = [];
      const params = [];

      if (updates.ruleName !== undefined) {
        fields.push('rule_name = ?');
        params.push(updates.ruleName);
      }
      if (updates.ruleType !== undefined) {
        fields.push('rule_type = ?');
        params.push(updates.ruleType);
      }
      if (updates.condition !== undefined) {
        fields.push('condition_json = ?');
        params.push(JSON.stringify(updates.condition));
      }
      if (updates.action !== undefined) {
        fields.push('action = ?');
        params.push(updates.action);
      }
      if (updates.reason !== undefined) {
        fields.push('reason = ?');
        params.push(updates.reason);
      }
      if (updates.isActive !== undefined) {
        fields.push('is_active = ?');
        params.push(updates.isActive ? 1 : 0);
      }

      if (fields.length === 0) {
        resolve({ success: false, message: '没有需要更新的字段' });
        return;
      }

      params.push(id);

      db.run(
        `UPDATE rules SET ${fields.join(', ')} WHERE id = ?`,
        params,
        function(err) {
          if (err) {
            reject(err);
            return;
          }
          resolve({ success: true, changes: this.changes });
        }
      );
    });
  }

  async deleteRule(id) {
    return new Promise((resolve, reject) => {
      db.run(`DELETE FROM rules WHERE id = ?`, [id], function(err) {
        if (err) {
          reject(err);
          return;
        }
        resolve({ success: true, deleted: this.changes > 0 });
      });
    });
  }

  async clearAllRules() {
    return new Promise((resolve, reject) => {
      db.run(`DELETE FROM rules`, [], function(err) {
        if (err) {
          reject(err);
          return;
        }
        resolve({ success: true, deletedCount: this.changes });
      });
    });
  }
}

module.exports = new RuleService();

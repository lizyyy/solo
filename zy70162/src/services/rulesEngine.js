const db = require('../database/db');
const { AUDIT_ACTION, DOWNLOAD_PERMISSION } = require('../config/constants');

class RulesEngine {
  constructor() {
    this.activeRules = [];
  }

  async loadRules(ruleType = null) {
    return new Promise((resolve, reject) => {
      let query = `SELECT * FROM scan_rules WHERE is_active = 1`;
      const params = [];
      
      if (ruleType) {
        query += ` AND rule_type = ?`;
        params.push(ruleType);
      }
      
      query += ` ORDER BY priority DESC`;
      
      db.all(query, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  matchesConditions(task, conditions) {
    if (!conditions) return true;
    
    const parsed = typeof conditions === 'string' 
      ? JSON.parse(conditions) 
      : conditions;
    
    for (const [key, value] of Object.entries(parsed)) {
      if (task[key] !== value) {
        return false;
      }
    }
    return true;
  }

  async evaluateDownloadPermission(task, actor, context = {}) {
    const rules = await this.loadRules('download');
    
    for (const rule of rules) {
      if (this.matchesConditions(task, rule.conditions)) {
        const action = JSON.parse(rule.action);
        
        await this.recordRuleEvaluation(
          task.id,
          actor,
          rule,
          {
            task_status: task.status,
            permission: action.permission,
            ...context
          }
        );
        
        return {
          permission: action.permission,
          reason: action.reason,
          rule_applied: rule.rule_name,
          rule_description: rule.description
        };
      }
    }
    
    return {
      permission: DOWNLOAD_PERMISSION.BLOCKED,
      reason: '未找到匹配的规则，默认拒绝下载',
      rule_applied: null,
      rule_description: null
    };
  }

  async recordRuleEvaluation(taskId, actor, rule, details) {
    return new Promise((resolve, reject) => {
      const stmt = db.prepare(`
        INSERT INTO audit_logs (task_id, action, actor, details, rule_applied)
        VALUES (?, ?, ?, ?, ?)
      `);
      
      stmt.run(
        taskId,
        AUDIT_ACTION.RULE_EVALUATED,
        actor,
        JSON.stringify(details),
        rule.rule_name,
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
      stmt.finalize();
    });
  }

  async getAllRules() {
    return new Promise((resolve, reject) => {
      db.all(`SELECT * FROM scan_rules ORDER BY priority DESC`, (err, rows) => {
        if (err) reject(err);
        else resolve(rows.map(r => ({
          ...r,
          conditions: JSON.parse(r.conditions),
          action: JSON.parse(r.action)
        })));
      });
    });
  }
}

module.exports = new RulesEngine();

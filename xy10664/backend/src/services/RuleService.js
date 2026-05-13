const db = require('../models/database');
const OvertimeService = require('./OvertimeService');
const BudgetService = require('./BudgetService');

class RuleService {
  static getActiveRules() {
    return new Promise((resolve, reject) => {
      db.all(`SELECT * FROM subsidy_rules WHERE is_active = 1 ORDER BY priority ASC`, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  static async applyRules(refundRequest) {
    const rules = await this.getActiveRules();
    const results = [];

    for (const rule of rules) {
      const condition = JSON.parse(rule.condition_json);
      const passed = await this.checkRule(rule.rule_type, condition, refundRequest);
      
      results.push({
        rule_id: rule.id,
        rule_name: rule.name,
        passed,
        action: rule.action
      });

      if (!passed && rule.action === 'reject') {
        return {
          approved: false,
          reason: `规则拦截: ${rule.name}`,
          rules: results
        };
      }

      if (!passed && rule.action === 'pending') {
        return {
          approved: false,
          reason: `需要人工复核: ${rule.name}`,
          needReview: true,
          rules: results
        };
      }
    }

    return {
      approved: true,
      rules: results
    };
  }

  static async checkRule(ruleType, condition, refundRequest) {
    switch (ruleType) {
      case 'overtime':
        return await this.checkOvertimeRule(condition, refundRequest);
      case 'amount':
        return this.checkAmountRule(condition, refundRequest);
      case 'budget':
        return await this.checkBudgetRule(condition, refundRequest);
      default:
        return true;
    }
  }

  static async checkOvertimeRule(condition, refundRequest) {
    const overtime = await OvertimeService.getApprovedOvertime(
      refundRequest.employee_id,
      refundRequest.order_date
    );

    if (!overtime) {
      return false;
    }

    if (condition.minHours && overtime.hours < condition.minHours) {
      return false;
    }

    return true;
  }

  static checkAmountRule(condition, refundRequest) {
    if (condition.maxAmount && refundRequest.amount > condition.maxAmount) {
      return false;
    }
    return true;
  }

  static async checkBudgetRule(condition, refundRequest) {
    if (!condition.checkBudget) return true;

    const period = new Date().toISOString().slice(0, 7);
    const budget = await BudgetService.getBudgetByDepartmentAndPeriod(
      refundRequest.department_id,
      period
    );

    if (!budget) return true;

    return (budget.remaining_budget >= refundRequest.amount);
  }

  static async create(data, operatorId, operatorName) {
    return new Promise((resolve, reject) => {
      const { name, rule_type, condition_json, action, priority } = data;
      
      const sql = `INSERT INTO subsidy_rules (name, rule_type, condition_json, action, priority) VALUES (?, ?, ?, ?, ?)`;
      db.run(sql, [name, rule_type, JSON.stringify(condition_json), action, priority || 0], function(err) {
        if (err) reject(err);
        else resolve({ id: this.lastID, ...data });
      });
    });
  }

  static getAll() {
    return new Promise((resolve, reject) => {
      db.all(`SELECT * FROM subsidy_rules ORDER BY priority ASC`, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }
}

module.exports = RuleService;

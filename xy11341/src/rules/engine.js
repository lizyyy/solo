const db = require('../db');

class RuleEngine {
  constructor() {
    this.rules = [];
  }

  addRule(rule) {
    this.rules.push(rule);
  }

  validate(data, dataType) {
    const results = [];
    let allPassed = true;

    for (const rule of this.rules) {
      if (rule.dataType && rule.dataType !== dataType) continue;
      
      const { passed, reason, details } = rule.validate(data);
      allPassed = allPassed && passed;

      const result = {
        ruleType: rule.type,
        ruleName: rule.name,
        passed: passed ? 1 : 0,
        reason,
        dataType,
        dataId: data.id || null,
        dataNo: data.order_no || data.return_no || data.claim_no || null,
        details: details ? JSON.stringify(details) : null,
      };
      results.push(result);
      this.saveResult(result);
    }

    return {
      passed: allPassed,
      results,
    };
  }

  saveResult(result) {
    const stmt = db.prepare(`
      INSERT INTO rule_results (rule_type, rule_name, passed, reason, data_type, data_id, data_no, details)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      result.ruleType,
      result.ruleName,
      result.passed,
      result.reason,
      result.dataType,
      result.dataId,
      result.dataNo,
      result.details
    );
  }

  getResultsByDataNo(dataNo) {
    return db.prepare('SELECT * FROM rule_results WHERE data_no = ? ORDER BY created_at DESC').all(dataNo);
  }
}

module.exports = RuleEngine;

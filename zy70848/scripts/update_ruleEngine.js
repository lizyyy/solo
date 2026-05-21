// This script updates the ruleEngine.js to use database rules
const fs = require('fs');

const newContent = `const db = require('../models/database');
const importService = require('./importService');
const ruleService = require('./ruleService');

class RuleEngine {
  constructor() {
    this.loadedRules = [];
  }

  async loadRules() {
    this.loadedRules = await ruleService.getAllRules(true);
    return this.loadedRules;
  }

  evaluateCondition(record, condition) {
    const { field, operator, value } = condition;
    const fieldValue = record[field];

    switch (operator) {
      case 'equals':
        return fieldValue === value;
      case 'not_equals':
        return fieldValue !== value;
      case 'greater_than':
        return fieldValue > value;
      case 'less_than':
        return fieldValue < value;
      case 'greater_than_or_equal':
        return fieldValue >= value;
      case 'less_than_or_equal':
        return fieldValue <= value;
      case 'contains':
        return String(fieldValue).includes(String(value));
      default:
        return false;
    }
  }

  async checkDuplicate(record) {
    return new Promise((resolve) => {
      db.get(
        'SELECT COUNT(*) as count FROM claim_records WHERE case_no = ? AND id != ?',
        [record.case_no, record.id || 0],
        (err, result) => {
          if (err) resolve(false);
          else resolve(result.count > 0);
        }
      );
    });
  }

  async checkRule(record, rule) {
    const { condition } = rule;
    if (condition.operator === 'duplicate_check') {
      return await this.checkDuplicate(record);
    }
    return this.evaluateCondition(record, condition);
  }

  async validateRecord(record) {
    if (this.loadedRules.length === 0) {
      await this.loadRules();
    }
    const violations = [];
    const autoApproveRules = [];

    for (const rule of this.loadedRules) {
      const isViolated = await this.checkRule(record, rule);
      if (isViolated) {
        if (rule.action === 'auto_approve') {
          autoApproveRules.push({
            ruleCode: rule.ruleCode,
            ruleName: rule.ruleName,
            reason: rule.reason,
            action: rule.action
          });
        } else {
          violations.push({
            ruleCode: rule.ruleCode,
            ruleName: rule.ruleName,
            reason: rule.reason,
            action: rule.action
          });
        }
      }
    }
    return { violations, autoApproveRules };
  }

  async processBatch(batchId, handler) {
    await this.loadRules();
    return new Promise((resolve, reject) => {
      db.all(
        'SELECT * FROM claim_records WHERE batch_id = ?',
        [batchId],
        async (err, records) => {
          if (err) { reject(err); return; }
          const results = [];
          
          for (const record of records) {
            const { violations, autoApproveRules } = await this.validateRecord(record);
            if (violations.length > 0) {
              const reasons = violations.map(v => v.reason).join('; ');
              const newStatus = 'needs_manual_review';
              
              await new Promise((resolveUpdate) => {
                db.run(
                  'UPDATE claim_records SET status = ?, reviewer = ?, review_opinion = ?, review_time = CURRENT_TIMESTAMP WHERE id = ?',
                  [newStatus, handler, reasons, record.id],
                  resolveUpdate
                );
              });

              await importService.addProcessingLog(
                record.id, 'auto_review', reasons, 'system', 'pending', newStatus
              );
              results.push({ recordId: record.id, caseNo: record.case_no, status: newStatus, violations });
            } else {
              let status = 'auto_approved';
              let opinion = autoApproveRules.length > 0 
                ? autoApproveRules.map(r => r.reason).join('; ') 
                : '自动审核通过';
              
              await new Promise((resolveUpdate) => {
                db.run(
                  'UPDATE claim_records SET status = ?, review_opinion = ?, review_time = CURRENT_TIMESTAMP WHERE id = ?',
                  [status, opinion, record.id],
                  resolveUpdate
                );
              });

              await importService.addProcessingLog(
                record.id, 'auto_review', opinion, 'system', 'pending', status
              );
              results.push({ recordId: record.id, caseNo: record.case_no, status, violations: [], autoApproveRules });
            }
          }

          db.run('UPDATE batches SET status = "processed", updated_at = CURRENT_TIMESTAMP WHERE id = ?', [batchId]);
          resolve({
            batchId,
            totalRecords: records.length,
            rulesApplied: this.loadedRules.length,
            needsReview: results.filter(r => r.status === 'needs_manual_review').length,
            autoApproved: results.filter(r => r.status === 'auto_approved').length,
            details: results
          });
        }
      );
    });
  }
}

module.exports = new RuleEngine();
`;

fs.writeFileSync('/Users/lzy/pro/solo/workspaces/zy70848/src/services/ruleEngine.js', newContent);
console.log('ruleEngine.js updated successfully');

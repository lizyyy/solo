const db = require('../models/database');
const importService = require('./importService');

class RuleEngine {
  constructor() {
    this.rules = [
      {
        code: 'MISSING_INVOICE',
        name: '缺少发票',
        type: 'material',
        check: (record) => record.has_invoice === 0,
        action: 'flag_for_review',
        reason: '缺少理赔发票，需补充材料'
      },
      {
        code: 'AMOUNT_EXCEEDS_LIMIT',
        name: '金额超限',
        type: 'amount',
        limit: 50000,
        check: function(record) {
          return record.claim_amount > this.limit;
        },
        action: 'flag_for_review',
        reason: '理赔金额超过5万元限额，需人工复核'
      },
      {
        code: 'DUPLICATE_CASE',
        name: '重复报案',
        type: 'duplicate',
        check: async (record) => {
          return new Promise((resolve) => {
            db.get(
              `SELECT COUNT(*) as count FROM claim_records 
               WHERE case_no = ? AND id != ?`,
              [record.case_no, record.id || 0],
              (err, result) => {
                if (err) resolve(false);
                else resolve(result.count > 0);
              }
            );
          });
        },
        action: 'flag_for_review',
        reason: '该案件号已存在，涉嫌重复报案'
      }
    ];
  }

  async validateRecord(record) {
    const violations = [];

    for (const rule of this.rules) {
      let isViolated;
      
      if (rule.check.constructor.name === 'AsyncFunction') {
        isViolated = await rule.check(record);
      } else {
        isViolated = rule.check(record);
      }

      if (isViolated) {
        violations.push({
          ruleCode: rule.code,
          ruleName: rule.name,
          reason: rule.reason,
          action: rule.action
        });
      }
    }

    return violations;
  }

  async processBatch(batchId, handler) {
    return new Promise((resolve, reject) => {
      db.all(
        `SELECT * FROM claim_records WHERE batch_id = ?`,
        [batchId],
        async (err, records) => {
          if (err) {
            reject(err);
            return;
          }

          const results = [];
          
          for (const record of records) {
            const violations = await this.validateRecord(record);
            
            if (violations.length > 0) {
              const reasons = violations.map(v => v.reason).join('; ');
              const newStatus = 'needs_manual_review';
              
              await new Promise((resolveUpdate) => {
                db.run(
                  `UPDATE claim_records 
                   SET status = ?, reviewer = ?, review_opinion = ?, review_time = CURRENT_TIMESTAMP
                   WHERE id = ?`,
                  [newStatus, handler, reasons, record.id],
                  resolveUpdate
                );
              });

              await importService.addProcessingLog(
                record.id,
                'auto_review',
                reasons,
                'system',
                'pending',
                newStatus
              );

              results.push({
                recordId: record.id,
                caseNo: record.case_no,
                status: newStatus,
                violations
              });
            } else {
              await new Promise((resolveUpdate) => {
                db.run(
                  `UPDATE claim_records SET status = 'auto_approved' WHERE id = ?`,
                  [record.id],
                  resolveUpdate
                );
              });

              await importService.addProcessingLog(
                record.id,
                'auto_review',
                '自动审核通过',
                'system',
                'pending',
                'auto_approved'
              );

              results.push({
                recordId: record.id,
                caseNo: record.case_no,
                status: 'auto_approved',
                violations: []
              });
            }
          }

          db.run(
            `UPDATE batches SET status = 'processed', updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
            [batchId]
          );

          resolve({
            batchId,
            totalRecords: records.length,
            needsReview: results.filter(r => r.status === 'needs_manual_review').length,
            autoApproved: results.filter(r => r.status === 'auto_approved').length,
            details: results
          });
        }
      );
    });
  }

  async loadRulesFromDB() {
    return new Promise((resolve, reject) => {
      db.all(`SELECT * FROM rules WHERE is_active = 1`, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  async addRule(ruleCode, ruleName, ruleType, condition, action) {
    return new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO rules (rule_code, rule_name, rule_type, condition_json, action)
         VALUES (?, ?, ?, ?, ?)`,
        [ruleCode, ruleName, ruleType, JSON.stringify(condition), action],
        function(err) {
          if (err) reject(err);
          else resolve({ id: this.lastID });
        }
      );
    });
  }
}

module.exports = new RuleEngine();

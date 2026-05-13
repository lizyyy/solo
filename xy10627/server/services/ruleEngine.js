const db = require('../database/db');
const { v4: uuidv4 } = require('uuid');

class RuleEngine {
  static checkIdempotent(operationId) {
    return new Promise((resolve, reject) => {
      db.get('SELECT id FROM inspections WHERE operation_id = ?', [operationId], (err, row) => {
        if (err) reject(err);
        resolve(!!row);
      });
    });
  }

  static checkSeedlingAcceptance(inspection) {
    if (inspection.seedling_acceptance_status === 'failed') {
      return {
        triggered: true,
        action: 'manual_review_required',
        reason: '补苗验收失败，需要人工处理',
        suggestedStatus: 'pending_manual'
      };
    }
    return { triggered: false };
  }

  static checkOutsourcedScore(inspection) {
    if (inspection.outsourced_score !== null && inspection.outsourced_score < 70) {
      return {
        triggered: true,
        action: 'score_review_required',
        reason: `外包评分${inspection.outsourced_score}分低于70分阈值，需要人工审核`,
        suggestedStatus: 'pending_review'
      };
    }
    return { triggered: false };
  }

  static async applyRules(inspection) {
    const results = [];

    const seedlingResult = this.checkSeedlingAcceptance(inspection);
    if (seedlingResult.triggered) {
      results.push(seedlingResult);
    }

    const scoreResult = this.checkOutsourcedScore(inspection);
    if (scoreResult.triggered) {
      results.push(scoreResult);
    }

    return results;
  }

  static addTimelineEntry(inspectionId, statusFrom, statusTo, changedBy, reason, details) {
    return new Promise((resolve, reject) => {
      const id = uuidv4();
      db.run(
        `INSERT INTO status_timeline (id, inspection_id, status_from, status_to, changed_by, change_reason, change_details)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [id, inspectionId, statusFrom, statusTo, changedBy, reason, details],
        (err) => {
          if (err) reject(err);
          resolve(id);
        }
      );
    });
  }

  static addFieldHistory(inspectionId, fieldName, oldValue, newValue, changedBy) {
    return new Promise((resolve, reject) => {
      const id = uuidv4();
      db.run(
        `INSERT INTO field_history (id, inspection_id, field_name, old_value, new_value, changed_by)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [id, inspectionId, fieldName, oldValue, newValue, changedBy],
        (err) => {
          if (err) reject(err);
          resolve(id);
        }
      );
    });
  }
}

module.exports = RuleEngine;

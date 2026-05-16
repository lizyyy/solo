const db = require('../database/db');
const { v4: uuidv4 } = require('uuid');
const RiskSample = require('./RiskSample');

const VALID_DECISIONS = ['approve', 'reject', 'need_reprocess', 'escalate'];

class ArbitrationOpinion {
  static async create(data) {
    return new Promise((resolve, reject) => {
      const id = uuidv4();
      const { risk_sample_id, arbitrator, decision, reason, evidence } = data;
      
      if (!VALID_DECISIONS.includes(decision)) {
        reject(new Error(`Invalid decision: ${decision}`));
        return;
      }
      
      const evidenceJson = JSON.stringify(evidence || {});
      
      db.run(
        `INSERT INTO arbitration_opinions (id, risk_sample_id, arbitrator, decision, reason, evidence)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [id, risk_sample_id, arbitrator, decision, reason, evidenceJson],
        async function(err) {
          if (err) {
            reject(err);
            return;
          }
          
          try {
            const statusMap = {
              'approve': 'approved',
              'reject': 'rejected',
              'need_reprocess': 'need_reprocess',
              'escalate': 'reviewing'
            };
            await RiskSample.updateStatus(risk_sample_id, statusMap[decision]);
            resolve({ id, ...data });
          } catch (updateErr) {
            reject(updateErr);
          }
        }
      );
    });
  }

  static findById(id) {
    return new Promise((resolve, reject) => {
      db.get('SELECT * FROM arbitration_opinions WHERE id = ?', [id], (err, row) => {
        if (err) reject(err);
        else if (row) {
          row.evidence = JSON.parse(row.evidence || '{}');
          resolve(row);
        } else resolve(null);
      });
    });
  }

  static findByRiskSampleId(risk_sample_id) {
    return new Promise((resolve, reject) => {
      db.all(
        'SELECT * FROM arbitration_opinions WHERE risk_sample_id = ? ORDER BY created_at DESC',
        [risk_sample_id],
        (err, rows) => {
          if (err) reject(err);
          else {
            rows.forEach(row => {
              row.evidence = JSON.parse(row.evidence || '{}');
            });
            resolve(rows);
          }
        }
      );
    });
  }

  static getDecisions() {
    return VALID_DECISIONS;
  }
}

module.exports = ArbitrationOpinion;
const { v4: uuidv4 } = require('uuid');
const { db } = require('../database/schema');

class AbolishRecord {
  static create(policyVersionId, reason, abolishedBy) {
    return new Promise((resolve, reject) => {
      const id = uuidv4();
      db.run(
        `INSERT INTO abolish_records (id, policy_version_id, abolish_reason, abolished_by, abolished_at)
         VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)`,
        [id, policyVersionId, reason, abolishedBy],
        function(err) {
          if (err) reject(err);
          else resolve({ id, policyVersionId, reason, abolishedBy, abolishedAt: new Date() });
        }
      );
    });
  }

  static findByPolicyVersionId(policyVersionId) {
    return new Promise((resolve, reject) => {
      db.all(
        `SELECT * FROM abolish_records WHERE policy_version_id = ? ORDER BY abolished_at DESC`,
        [policyVersionId],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows.map(row => this.mapRow(row)));
        }
      );
    });
  }

  static mapRow(row) {
    return {
      id: row.id,
      policyVersionId: row.policy_version_id,
      abolishReason: row.abolish_reason,
      abolishedBy: row.abolished_by,
      abolishedAt: row.abolished_at
    };
  }
}

module.exports = { AbolishRecord };

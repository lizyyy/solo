const { v4: uuidv4 } = require('uuid');
const { db } = require('../database/schema');

class ReadingConfirmation {
  static create(policyVersionId, userId, userName) {
    return new Promise((resolve, reject) => {
      const id = uuidv4();
      db.run(
        `INSERT INTO reading_confirmations (id, policy_version_id, user_id, user_name, confirmed_at)
         VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)`,
        [id, policyVersionId, userId, userName],
        function(err) {
          if (err) reject(err);
          else resolve({ id, policyVersionId, userId, userName, confirmedAt: new Date() });
        }
      );
    });
  }

  static findByPolicyVersionId(policyVersionId) {
    return new Promise((resolve, reject) => {
      db.all(
        `SELECT * FROM reading_confirmations WHERE policy_version_id = ? ORDER BY confirmed_at DESC`,
        [policyVersionId],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows.map(row => this.mapRow(row)));
        }
      );
    });
  }

  static hasConfirmed(policyVersionId, userId) {
    return new Promise((resolve, reject) => {
      db.get(
        `SELECT 1 FROM reading_confirmations WHERE policy_version_id = ? AND user_id = ?`,
        [policyVersionId, userId],
        (err, row) => {
          if (err) reject(err);
          else resolve(!!row);
        }
      );
    });
  }

  static mapRow(row) {
    return {
      id: row.id,
      policyVersionId: row.policy_version_id,
      userId: row.user_id,
      userName: row.user_name,
      confirmedAt: row.confirmed_at
    };
  }
}

module.exports = { ReadingConfirmation };

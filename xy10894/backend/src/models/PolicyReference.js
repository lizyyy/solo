const { v4: uuidv4 } = require('uuid');
const { db } = require('../database/schema');

class PolicyReference {
  static create(policyVersionId, references) {
    return new Promise((resolve, reject) => {
      const stmt = db.prepare(
        `INSERT INTO policy_references (id, policy_version_id, referenced_policy_code, referenced_version_number, reference_type)
         VALUES (?, ?, ?, ?, ?)`
      );
      
      db.serialize(() => {
        references.forEach((ref) => {
          const id = uuidv4();
          stmt.run(id, policyVersionId, ref.referencedPolicyCode, ref.referencedVersionNumber || null, ref.referenceType);
        });
        stmt.finalize((err) => {
          if (err) reject(err);
          else resolve();
        });
      });
    });
  }

  static findByPolicyVersionId(policyVersionId) {
    return new Promise((resolve, reject) => {
      db.all(
        `SELECT * FROM policy_references WHERE policy_version_id = ?`,
        [policyVersionId],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows.map(row => this.mapRow(row)));
        }
      );
    });
  }

  static findReferencesToPolicy(policyCode) {
    return new Promise((resolve, reject) => {
      db.all(
        `SELECT pr.*, pv.policy_code, pv.version_number, pv.title, pv.status
         FROM policy_references pr
         JOIN policy_versions pv ON pr.policy_version_id = pv.id
         WHERE pr.referenced_policy_code = ?`,
        [policyCode],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows.map(row => ({
            ...this.mapRow(row),
            referencingPolicyCode: row.policy_code,
            referencingVersionNumber: row.version_number,
            referencingTitle: row.title,
            referencingStatus: row.status
          })));
        }
      );
    });
  }

  static mapRow(row) {
    return {
      id: row.id,
      policyVersionId: row.policy_version_id,
      referencedPolicyCode: row.referenced_policy_code,
      referencedVersionNumber: row.referenced_version_number,
      referenceType: row.reference_type
    };
  }
}

module.exports = { PolicyReference };

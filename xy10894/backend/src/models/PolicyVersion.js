const { v4: uuidv4 } = require('uuid');
const { db } = require('../database/schema');

const PolicyStatus = {
  DRAFT: 'DRAFT',
  PENDING_APPROVAL: 'PENDING_APPROVAL',
  APPROVING: 'APPROVING',
  APPROVED: 'APPROVED',
  PUBLISHING: 'PUBLISHING',
  PUBLISHED: 'PUBLISHED',
  REJECTED: 'REJECTED',
  ABOLISHED: 'ABOLISHED'
};

class PolicyVersion {
  static create(data, createdBy) {
    return new Promise((resolve, reject) => {
      const id = uuidv4();
      const { policyCode, versionNumber, title, content, applicableDepartments } = data;
      
      db.run(
        `INSERT INTO policy_versions (id, policy_code, version_number, title, content, applicable_departments, created_by, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
        [id, policyCode, versionNumber, title, JSON.stringify(content), JSON.stringify(applicableDepartments || []), createdBy],
        function(err) {
          if (err) reject(err);
          else resolve({ id, ...data, createdBy, createdAt: new Date() });
        }
      );
    });
  }

  static findById(id) {
    return new Promise((resolve, reject) => {
      db.get(`SELECT * FROM policy_versions WHERE id = ?`, [id], (err, row) => {
        if (err) reject(err);
        else resolve(row ? this.mapRow(row) : null);
      });
    });
  }

  static findByPolicyCode(policyCode) {
    return new Promise((resolve, reject) => {
      db.all(
        `SELECT * FROM policy_versions WHERE policy_code = ? ORDER BY version_number DESC`,
        [policyCode],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows.map(row => this.mapRow(row)));
        }
      );
    });
  }

  static findAll(filters = {}) {
    return new Promise((resolve, reject) => {
      let query = `SELECT * FROM policy_versions WHERE 1=1`;
      const params = [];
      
      if (filters.status) {
        query += ` AND status = ?`;
        params.push(filters.status);
      }
      if (filters.createdBy) {
        query += ` AND created_by = ?`;
        params.push(filters.createdBy);
      }
      
      query += ` ORDER BY created_at DESC`;
      
      db.all(query, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows.map(row => this.mapRow(row)));
      });
    });
  }

  static updateStatus(id, status) {
    return new Promise((resolve, reject) => {
      db.run(
        `UPDATE policy_versions SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [status, id],
        function(err) {
          if (err) reject(err);
          else resolve({ changes: this.changes });
        }
      );
    });
  }

  static mapRow(row) {
    return {
      id: row.id,
      policyCode: row.policy_code,
      versionNumber: row.version_number,
      title: row.title,
      content: row.content ? JSON.parse(row.content) : null,
      applicableDepartments: row.applicable_departments ? JSON.parse(row.applicable_departments) : [],
      createdBy: row.created_by,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      status: row.status
    };
  }
}

module.exports = { PolicyVersion, PolicyStatus };

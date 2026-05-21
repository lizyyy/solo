const { v4: uuidv4 } = require('uuid');
const { db } = require('../database/schema');

const ApprovalStatus = {
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  SKIPPED: 'SKIPPED'
};

class ApprovalNode {
  static create(policyVersionId, nodes) {
    return new Promise((resolve, reject) => {
      const stmt = db.prepare(
        `INSERT INTO approval_nodes (id, policy_version_id, node_order, node_name, approver_role, status)
         VALUES (?, ?, ?, ?, ?, ?)`
      );
      
      db.serialize(() => {
        nodes.forEach((node, index) => {
          const id = uuidv4();
          stmt.run(id, policyVersionId, index + 1, node.nodeName, node.approverRole, ApprovalStatus.PENDING);
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
        `SELECT * FROM approval_nodes WHERE policy_version_id = ? ORDER BY node_order`,
        [policyVersionId],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows.map(row => this.mapRow(row)));
        }
      );
    });
  }

  static approve(id, approverUser, comment) {
    return new Promise((resolve, reject) => {
      db.run(
        `UPDATE approval_nodes 
         SET status = ?, approver_user = ?, comment = ?, approved_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [ApprovalStatus.APPROVED, approverUser, comment, id],
        function(err) {
          if (err) reject(err);
          else resolve({ changes: this.changes });
        }
      );
    });
  }

  static reject(id, approverUser, comment) {
    return new Promise((resolve, reject) => {
      db.run(
        `UPDATE approval_nodes 
         SET status = ?, approver_user = ?, comment = ?, approved_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [ApprovalStatus.REJECTED, approverUser, comment, id],
        function(err) {
          if (err) reject(err);
          else resolve({ changes: this.changes });
        }
      );
    });
  }

  static getNextPendingNode(policyVersionId) {
    return new Promise((resolve, reject) => {
      db.get(
        `SELECT * FROM approval_nodes 
         WHERE policy_version_id = ? AND status = ?
         ORDER BY node_order LIMIT 1`,
        [policyVersionId, ApprovalStatus.PENDING],
        (err, row) => {
          if (err) reject(err);
          else resolve(row ? this.mapRow(row) : null);
        }
      );
    });
  }

  static mapRow(row) {
    return {
      id: row.id,
      policyVersionId: row.policy_version_id,
      nodeOrder: row.node_order,
      nodeName: row.node_name,
      approverRole: row.approver_role,
      approverUser: row.approver_user,
      status: row.status,
      comment: row.comment,
      approvedAt: row.approved_at
    };
  }
}

module.exports = { ApprovalNode, ApprovalStatus };

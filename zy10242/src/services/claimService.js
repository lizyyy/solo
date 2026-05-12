const db = require('../models/database');
const { v4: uuidv4 } = require('uuid');

class ClaimService {
  async createClaim(data) {
    return new Promise((resolve, reject) => {
      const now = new Date().toISOString();
      const claimId = `CLM${Date.now()}`;
      
      db.run(`
        INSERT INTO claims (claim_id, policy_number, customer_name, customer_id, accident_type, accident_date, deadline, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        claimId,
        data.policy_number,
        data.customer_name,
        data.customer_id,
        data.accident_type,
        data.accident_date,
        data.deadline || null,
        now,
        now
      ], async (err) => {
        if (err) return reject(err);
        
        await this.addAuditLog(claimId, null, '创建案件', 'create', data.operator || 'system', '案件创建成功');
        
        const claim = await this.getClaimById(claimId);
        resolve(claim);
      });
    });
  }

  async getClaimById(claimId) {
    return new Promise((resolve, reject) => {
      db.get('SELECT * FROM claims WHERE claim_id = ?', [claimId], (err, row) => {
        if (err) return reject(err);
        resolve(row);
      });
    });
  }

  async getAllClaims(filters = {}) {
    return new Promise((resolve, reject) => {
      let sql = 'SELECT * FROM claims WHERE 1=1';
      const params = [];
      
      if (filters.status) {
        sql += ' AND status = ?';
        params.push(filters.status);
      }
      if (filters.customer_id) {
        sql += ' AND customer_id = ?';
        params.push(filters.customer_id);
      }
      
      sql += ' ORDER BY created_at DESC';
      
      db.all(sql, params, (err, rows) => {
        if (err) return reject(err);
        resolve(rows);
      });
    });
  }

  async updateClaimStatus(claimId, status, operator, remark = '') {
    return new Promise((resolve, reject) => {
      const now = new Date().toISOString();
      
      db.get('SELECT status FROM claims WHERE claim_id = ?', [claimId], (err, oldClaim) => {
        if (err) return reject(err);
        if (!oldClaim) return reject(new Error('案件不存在'));
        
        db.run(`
          UPDATE claims SET status = ?, updated_at = ? WHERE claim_id = ?
        `, [status, now, claimId], async (err) => {
          if (err) return reject(err);
          
          await this.addAuditLog(claimId, null, '更新案件状态', 'status_update', operator, remark, oldClaim.status, status);
          
          const claim = await this.getClaimById(claimId);
          resolve(claim);
        });
      });
    });
  }

  async addAuditLog(claimId, materialId, action, actionType, operator, remark = '', oldStatus = null, newStatus = null) {
    return new Promise((resolve, reject) => {
      const logId = uuidv4();
      const now = new Date().toISOString();
      
      db.run(`
        INSERT INTO audit_logs (log_id, claim_id, material_id, action, action_type, operator, remark, old_status, new_status, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [logId, claimId, materialId, action, actionType, operator, remark, oldStatus, newStatus, now], (err) => {
        if (err) return reject(err);
        resolve(logId);
      });
    });
  }

  async getAuditLogs(claimId) {
    return new Promise((resolve, reject) => {
      db.all('SELECT * FROM audit_logs WHERE claim_id = ? ORDER BY created_at DESC', [claimId], (err, rows) => {
        if (err) return reject(err);
        resolve(rows);
      });
    });
  }

  async getOverdueClaims() {
    return new Promise((resolve, reject) => {
      const now = new Date().toISOString();
      db.all(`
        SELECT * FROM claims 
        WHERE deadline IS NOT NULL 
        AND deadline < ? 
        AND status NOT IN ('completed', 'rejected')
        ORDER BY deadline ASC
      `, [now], (err, rows) => {
        if (err) return reject(err);
        resolve(rows);
      });
    });
  }
}

module.exports = new ClaimService();

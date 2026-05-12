const db = require('../models/database');
const { v4: uuidv4 } = require('uuid');
const claimService = require('./claimService');
const materialService = require('./materialService');

class ReminderService {
  async createReminder(claimId, materialId, reminderType, reminderReason, operator) {
    return new Promise((resolve, reject) => {
      const now = new Date().toISOString();
      
      db.get(`
        SELECT * FROM reminders 
        WHERE claim_id = ? 
        AND (material_id = ? OR (material_id IS NULL AND ? IS NULL))
        AND reminder_type = ? 
        AND reminder_reason = ?
      `, [claimId, materialId, materialId, reminderType, reminderReason], (err, existing) => {
        if (err) return reject(err);
        
        if (existing) {
          db.run(`
            UPDATE reminders 
            SET reminder_count = reminder_count + 1, last_reminded_at = ?
            WHERE reminder_id = ?
          `, [now, existing.reminder_id], async (err) => {
            if (err) return reject(err);
            
            await claimService.addAuditLog(
              claimId, materialId, '重复提醒', 'reminder_repeat',
              operator, `重复提醒: ${reminderReason}, 次数: ${existing.reminder_count + 1}`
            );
            
            db.get('SELECT * FROM reminders WHERE reminder_id = ?', [existing.reminder_id], (err, row) => {
              if (err) return reject(err);
              resolve(row);
            });
          });
        } else {
          const reminderId = uuidv4();
          db.run(`
            INSERT INTO reminders (
              reminder_id, claim_id, material_id, reminder_type, 
              reminder_reason, reminder_count, last_reminded_at, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `, [reminderId, claimId, materialId, reminderType, reminderReason, 1, now, now], async (err) => {
            if (err) return reject(err);
            
            await claimService.addAuditLog(
              claimId, materialId, '创建提醒', 'reminder_create',
              operator, `创建提醒: ${reminderReason}`
            );
            
            db.get('SELECT * FROM reminders WHERE reminder_id = ?', [reminderId], (err, row) => {
              if (err) return reject(err);
              resolve(row);
            });
          });
        }
      });
    });
  }

  async getReminders(claimId) {
    return new Promise((resolve, reject) => {
      db.all('SELECT * FROM reminders WHERE claim_id = ? ORDER BY created_at DESC', [claimId], (err, rows) => {
        if (err) return reject(err);
        resolve(rows);
      });
    });
  }

  async checkAndCreateOverdueReminders(operator) {
    const overdueClaims = await claimService.getOverdueClaims();
    const results = [];
    
    for (const claim of overdueClaims) {
      const missingMaterials = await materialService.getMissingMaterials(claim.claim_id);
      
      for (const material of missingMaterials) {
        const reminder = await this.createReminder(
          claim.claim_id,
          material.material_id,
          'overdue',
          `材料超期未补齐: ${material.material_name}`,
          operator
        );
        results.push(reminder);
      }
    }
    
    return results;
  }

  async createMissingMaterialReminder(claimId, operator) {
    const missingMaterials = await materialService.getMissingMaterials(claimId);
    
    if (missingMaterials.length === 0) {
      throw new Error('没有缺失的材料');
    }
    
    const results = [];
    for (const material of missingMaterials) {
      const reminder = await this.createReminder(
        claimId,
        material.material_id,
        'missing',
        `材料缺失: ${material.material_name}`,
        operator
      );
      results.push(reminder);
    }
    
    return results;
  }

  async getAllReminders(filters = {}) {
    return new Promise((resolve, reject) => {
      let sql = 'SELECT * FROM reminders WHERE 1=1';
      const params = [];
      
      if (filters.reminder_type) {
        sql += ' AND reminder_type = ?';
        params.push(filters.reminder_type);
      }
      
      sql += ' ORDER BY created_at DESC';
      
      db.all(sql, params, (err, rows) => {
        if (err) return reject(err);
        resolve(rows);
      });
    });
  }
}

module.exports = new ReminderService();

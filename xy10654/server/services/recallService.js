const db = require('../database');
const moment = require('moment');

class RecallService {
  static async createBatch(data) {
    return new Promise((resolve, reject) => {
      const { batch_no, consumable_name, manufacturer, production_date, expiry_date, quantity, operator } = data;
      
      db.run(
        `INSERT INTO consumable_batches (batch_no, consumable_name, manufacturer, production_date, expiry_date, quantity) 
         VALUES (?, ?, ?, ?, ?, ?)`,
        [batch_no, consumable_name, manufacturer, production_date, expiry_date, quantity],
        function(err) {
          if (err) reject(err);
          else {
            const batchId = this.lastID;
            RecallService.logOperation('consumable_batches', 'create', operator, batchId, null, JSON.stringify(data), '创建耗材批号');
            RecallService.checkExpiryAlert(batchId, expiry_date, operator);
            resolve({ id: batchId, ...data });
          }
        }
      );
    });
  }

  static async checkExpiryAlert(batchId, expiryDate, operator) {
    const daysToExpiry = moment(expiryDate).diff(moment(), 'days');
    let alertLevel = null;
    
    if (daysToExpiry <= 30) alertLevel = 'critical';
    else if (daysToExpiry <= 90) alertLevel = 'warning';
    else if (daysToExpiry <= 180) alertLevel = 'info';
    
    if (alertLevel) {
      db.run(
        `INSERT INTO expiry_alerts (batch_id, alert_level, alert_date, days_to_expiry) VALUES (?, ?, ?, ?)`,
        [batchId, alertLevel, moment().format('YYYY-MM-DD'), daysToExpiry]
      );
    }
  }

  static async validateExpiry(batchId) {
    return new Promise((resolve, reject) => {
      db.get(`SELECT expiry_date FROM consumable_batches WHERE id = ?`, [batchId], (err, row) => {
        if (err) reject(err);
        else if (!row) resolve({ valid: false, reason: '批号不存在' });
        else {
          const daysToExpiry = moment(row.expiry_date).diff(moment(), 'days');
          if (daysToExpiry < 0) {
            resolve({ valid: false, reason: '耗材已过期' });
          } else if (daysToExpiry <= 7) {
            resolve({ valid: false, reason: '耗材即将过期（7天内），需先处理效期预警', warning: true });
          } else {
            resolve({ valid: true });
          }
        }
      });
    });
  }

  static async createDepartmentUsage(data) {
    return new Promise((resolve, reject) => {
      const { batch_id, department_name, quantity, usage_date, operator } = data;
      
      db.get(`SELECT quantity as stock FROM consumable_batches WHERE id = ?`, [batch_id], (err, batch) => {
        if (err) reject(err);
        else if (!batch || batch.stock < quantity) {
          reject(new Error('库存不足'));
        } else {
          db.run(
            `INSERT INTO department_usages (batch_id, department_name, quantity, usage_date, operator) VALUES (?, ?, ?, ?, ?)`,
            [batch_id, department_name, quantity, usage_date, operator],
            function(err) {
              if (err) reject(err);
              else {
                const usageId = this.lastID;
                db.run(`UPDATE consumable_batches SET quantity = quantity - ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [quantity, batch_id]);
                RecallService.logOperation('department_usages', 'create', operator, usageId, null, JSON.stringify(data), '科室领用');
                resolve({ id: usageId, ...data });
              }
            }
          );
        }
      });
    });
  }

  static async createRecallNotice(data) {
    return new Promise(async (resolve, reject) => {
      const { batch_id, recall_reason, recall_level, initiator } = data;
      
      const expiryCheck = await RecallService.validateExpiry(batch_id);
      if (!expiryCheck.valid) {
        db.run(
          `INSERT INTO recall_notices (batch_id, recall_reason, recall_level, initiator, status, blocked_reason) 
           VALUES (?, ?, ?, ?, 'blocked', ?)`,
          [batch_id, recall_reason, recall_level, initiator, expiryCheck.reason],
          function(err) {
            if (err) reject(err);
            else {
              RecallService.logOperation('recall_notices', 'blocked', initiator, this.lastID, null, JSON.stringify(data), expiryCheck.reason);
              resolve({ id: this.lastID, status: 'blocked', blocked_reason: expiryCheck.reason, ...data });
            }
          }
        );
        return;
      }

      db.all(`SELECT * FROM recall_notices WHERE batch_id = ? AND status IN ('pending', 'processing')`, [batch_id], (err, rows) => {
        if (rows.length > 0) {
          reject(new Error('该批号已有正在进行的召回，请先完成或取消现有召回'));
          return;
        }

        db.run(
          `INSERT INTO recall_notices (batch_id, recall_reason, recall_level, initiator, status) VALUES (?, ?, ?, ?, 'pending')`,
          [batch_id, recall_reason, recall_level, initiator],
          function(err) {
            if (err) reject(err);
            else {
              const recallId = this.lastID;
              RecallService.logOperation('recall_notices', 'create', initiator, recallId, null, JSON.stringify(data), '创建召回通知');
              RecallService.calculateRiskDepartments(recallId, batch_id);
              RecallService.createReturnAcceptances(recallId, batch_id);
              resolve({ id: recallId, status: 'pending', ...data });
            }
          }
        );
      });
    });
  }

  static async calculateRiskDepartments(recallId, batchId) {
    db.all(
      `SELECT department_name, SUM(quantity) as total_usage 
       FROM department_usages 
       WHERE batch_id = ? AND status = 'normal' 
       GROUP BY department_name`,
      [batchId],
      (err, rows) => {
        rows.forEach(row => {
          let riskLevel = 'low';
          if (row.total_usage > 50) riskLevel = 'high';
          else if (row.total_usage > 20) riskLevel = 'medium';
          
          const affectedPatients = Math.floor(row.total_usage * 1.5);
          
          db.run(
            `INSERT INTO risk_departments (recall_id, department_name, risk_level, affected_patients, usage_quantity) 
             VALUES (?, ?, ?, ?, ?)`,
            [recallId, row.department_name, riskLevel, affectedPatients, row.total_usage]
          );
        });
      }
    );
  }

  static async createReturnAcceptances(recallId, batchId) {
    db.all(
      `SELECT department_name, SUM(quantity) as total_usage 
       FROM department_usages 
       WHERE batch_id = ? AND status = 'normal' 
       GROUP BY department_name`,
      [batchId],
      (err, rows) => {
        rows.forEach(row => {
          db.run(
            `INSERT INTO return_acceptances (recall_id, department_name, expected_quantity, returned_quantity) 
             VALUES (?, ?, ?, 0)`,
            [recallId, row.department_name, row.total_usage]
          );
        });
      }
    );
  }

  static async reviewRecall(recallId, data) {
    return new Promise((resolve, reject) => {
      const { status, reviewed_by, review_reason } = data;
      
      db.get(`SELECT * FROM recall_notices WHERE id = ?`, [recallId], (err, oldRecall) => {
        if (err) reject(err);
        else if (!oldRecall) reject(new Error('召回不存在'));
        else {
          db.run(
            `UPDATE recall_notices SET status = ?, reviewed_by = ?, reviewed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
            [status, reviewed_by, recallId],
            (err) => {
              if (err) reject(err);
              else {
                RecallService.logOperation('recall_notices', 'review', reviewed_by, recallId, JSON.stringify(oldRecall), JSON.stringify({ ...oldRecall, status }), review_reason || '人工复核');
                resolve({ id: recallId, status, reviewed_by });
              }
            }
          );
        }
      });
    });
  }

  static async updateReturnAcceptance(acceptanceId, data) {
    return new Promise((resolve, reject) => {
      const { returned_quantity, status, operator, modified_reason } = data;
      
      db.get(`SELECT * FROM return_acceptances WHERE id = ?`, [acceptanceId], (err, oldAcceptance) => {
        if (err) reject(err);
        else if (!oldAcceptance) reject(new Error('退回记录不存在'));
        else {
          db.run(
            `UPDATE return_acceptances 
             SET returned_quantity = ?, status = ?, accepted_by = ?, accepted_at = CURRENT_TIMESTAMP, modified_by = ?, modified_reason = ?, updated_at = CURRENT_TIMESTAMP 
             WHERE id = ?`,
            [returned_quantity, status || 'accepted', operator, operator, modified_reason, acceptanceId],
            (err) => {
              if (err) reject(err);
              else {
                RecallService.logOperation('return_acceptances', 'update', operator, acceptanceId, JSON.stringify(oldAcceptance), JSON.stringify({ ...oldAcceptance, returned_quantity, status }), modified_reason || '退回验收');
                
                RecallService.saveModificationHistory('return_acceptances', acceptanceId, 'returned_quantity', oldAcceptance.returned_quantity, returned_quantity, operator, modified_reason);
                RecallService.saveModificationHistory('return_acceptances', acceptanceId, 'status', oldAcceptance.status, status, operator, modified_reason);
                
                resolve({ id: acceptanceId, returned_quantity, status, accepted_by: operator });
              }
            }
          );
        }
      });
    });
  }

  static async saveModificationHistory(tableName, recordId, fieldName, oldValue, newValue, modifiedBy, modifiedReason) {
    return new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO modification_history (table_name, record_id, field_name, old_value, new_value, modified_by, modified_reason) 
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [tableName, recordId, fieldName, oldValue, newValue, modifiedBy, modifiedReason || ''],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });
  }

  static async logOperation(module, operation, operator, recordId, oldValue, newValue, changeReason) {
    return new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO operation_logs (module, operation, operator, record_id, old_value, new_value, change_reason) 
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [module, operation, operator, recordId, oldValue, newValue, changeReason || ''],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });
  }

  static async getOperationLogs(filters = {}) {
    return new Promise((resolve, reject) => {
      let query = `SELECT * FROM operation_logs WHERE 1=1`;
      const params = [];
      
      if (filters.operator) {
        query += ` AND operator = ?`;
        params.push(filters.operator);
      }
      if (filters.startDate) {
        query += ` AND DATE(created_at) >= ?`;
        params.push(filters.startDate);
      }
      if (filters.endDate) {
        query += ` AND DATE(created_at) <= ?`;
        params.push(filters.endDate);
      }
      
      query += ` ORDER BY created_at DESC`;
      
      db.all(query, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  static async getRecallTimeline(recallId) {
    return new Promise((resolve, reject) => {
      const timeline = [];
      
      db.get(`SELECT * FROM recall_notices WHERE id = ?`, [recallId], (err, recall) => {
        if (err) reject(err);
        else if (!recall) reject(new Error('召回不存在'));
        else {
          timeline.push({
            time: recall.created_at,
            type: 'recall_created',
            title: '召回创建',
            content: `由 ${recall.initiator} 创建，原因：${recall.recall_reason}`,
            data: recall
          });
          
          if (recall.reviewed_at) {
            timeline.push({
              time: recall.reviewed_at,
              type: 'recall_reviewed',
              title: '人工复核',
              content: `由 ${recall.reviewed_by} 复核，状态：${recall.status}`,
              data: recall
            });
          }
          
          db.all(`SELECT * FROM return_acceptances WHERE recall_id = ?`, [recallId], (err, acceptances) => {
            acceptances.forEach(a => {
              if (a.accepted_at) {
                timeline.push({
                  time: a.accepted_at,
                  type: 'return_accepted',
                  title: `${a.department_name} 退回验收`,
                  content: `退回 ${a.returned_quantity}/${a.expected_quantity}，验收人：${a.accepted_by}${a.modified_reason ? `，修改原因：${a.modified_reason}` : ''}`,
                  data: a
                });
              }
            });
            
            db.all(`SELECT * FROM risk_departments WHERE recall_id = ?`, [recallId], (err, risks) => {
              timeline.push({
                time: recall.created_at,
                type: 'risk_calculated',
                title: '风险科室统计',
                content: `共 ${risks.length} 个风险科室`,
                data: risks
              });
              
              timeline.sort((a, b) => new Date(a.time) - new Date(b.time));
              resolve(timeline);
            });
          });
        }
      });
    });
  }

  static async exportReport(filters = {}) {
    return new Promise((resolve, reject) => {
      const report = {
        summary: {},
        returnAcceptances: [],
        modificationHistory: [],
        operationLogs: [],
        riskDepartments: []
      };
      
      let logQuery = `SELECT * FROM operation_logs WHERE 1=1`;
      const logParams = [];
      
      if (filters.operator) {
        logQuery += ` AND operator = ?`;
        logParams.push(filters.operator);
      }
      if (filters.startDate) {
        logQuery += ` AND DATE(created_at) >= ?`;
        logParams.push(filters.startDate);
      }
      if (filters.endDate) {
        logQuery += ` AND DATE(created_at) <= ?`;
        logParams.push(filters.endDate);
      }
      
      db.all(logQuery, logParams, (err, logs) => {
        report.operationLogs = logs;
        
        db.all(`SELECT * FROM return_acceptances ORDER BY updated_at DESC`, [], (err, acceptances) => {
          report.returnAcceptances = acceptances.map(a => ({
            ...a,
            modifier: a.modified_by,
            modifyReason: a.modified_reason,
            affectedRecords: acceptances.filter(x => x.recall_id === a.recall_id).length
          }));
          
          db.all(`SELECT * FROM modification_history ORDER BY created_at DESC`, [], (err, history) => {
            report.modificationHistory = history;
            
            db.all(`SELECT * FROM risk_departments ORDER BY recall_id, risk_level`, [], (err, risks) => {
              report.riskDepartments = risks;
              
              report.summary = {
                totalRecalls: new Set(acceptances.map(a => a.recall_id)).size,
                totalReturns: acceptances.length,
                totalModifications: history.length,
                highRiskDepartments: risks.filter(r => r.risk_level === 'high').length
              };
              
              resolve(report);
            });
          });
        });
      });
    });
  }

  static async getBatches() {
    return new Promise((resolve, reject) => {
      db.all(`SELECT * FROM consumable_batches ORDER BY created_at DESC`, [], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  static async getRecalls() {
    return new Promise((resolve, reject) => {
      db.all(`SELECT rn.*, cb.batch_no, cb.consumable_name 
              FROM recall_notices rn 
              LEFT JOIN consumable_batches cb ON rn.batch_id = cb.id 
              ORDER BY rn.created_at DESC`, [], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  static async getRiskDepartments(recallId) {
    return new Promise((resolve, reject) => {
      db.all(`SELECT * FROM risk_departments WHERE recall_id = ? ORDER BY risk_level DESC`, [recallId], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  static async getReturnAcceptances(recallId) {
    return new Promise((resolve, reject) => {
      db.all(`SELECT * FROM return_acceptances WHERE recall_id = ? ORDER BY department_name`, [recallId], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }
}

module.exports = RecallService;

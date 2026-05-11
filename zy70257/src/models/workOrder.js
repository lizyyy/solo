const db = require('../config/database');
const { WORK_ORDER_STATUS, WORK_ORDER_STATUS_LABELS, DEPARTMENT_LABELS } = require('../utils/enums');
const { v4: uuidv4 } = require('uuid');

const DEFAULT_PROCESSES = [
  { code: 'model_check', name: '模型检查', department: 'qc', sequence: 1 },
  { code: 'design', name: 'CAD设计', department: 'design', sequence: 2 },
  { code: 'molding', name: '3D打印/铸造', department: 'molding', sequence: 3 },
  { code: 'wax', name: '蜡型制作', department: 'wax', sequence: 4 },
  { code: 'casting', name: '金属铸造', department: 'casting', sequence: 5 },
  { code: 'porcelain', name: '上瓷', department: 'porcelain', sequence: 6 },
  { code: 'polishing', name: '抛光精修', department: 'polishing', sequence: 7 },
  { code: 'qc', name: '质量检验', department: 'qc', sequence: 8 }
];

class WorkOrder {
  static generateForBatch(batchId) {
    return new Promise((resolve, reject) => {
      const workOrders = DEFAULT_PROCESSES.map(process => ({
        id: uuidv4(),
        batchId,
        processCode: process.code,
        processName: process.name,
        department: process.department,
        sequence: process.sequence,
        status: WORK_ORDER_STATUS.PENDING,
        createdAt: Date.now(),
        updatedAt: Date.now()
      }));
      
      const stmt = db.prepare(`
        INSERT INTO work_orders (
          id, batch_id, process_code, process_name, department,
          sequence, status, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      
      const insertPromises = workOrders.map(wo => new Promise((res, rej) => {
        stmt.run(
          wo.id, wo.batchId, wo.processCode, wo.processName, wo.department,
          wo.sequence, wo.status, wo.createdAt, wo.updatedAt,
          function(err) {
            if (err) return rej(err);
            res(wo);
          }
        );
      }));
      
      Promise.all(insertPromises)
        .then(inserted => resolve(inserted))
        .catch(err => reject(err));
    });
  }

  static findById(id) {
    return new Promise((resolve, reject) => {
      db.get('SELECT * FROM work_orders WHERE id = ?', [id], (err, row) => {
        if (err) return reject(err);
        resolve(row ? this._mapRow(row) : null);
      });
    });
  }

  static findByBatchId(batchId) {
    return new Promise((resolve, reject) => {
      db.all('SELECT * FROM work_orders WHERE batch_id = ? ORDER BY sequence', [batchId], (err, rows) => {
        if (err) return reject(err);
        resolve(rows.map(row => this._mapRow(row)));
      });
    });
  }

  static updateStatus(id, status, operator = null, notes = null) {
    return new Promise((resolve, reject) => {
      const now = Date.now();
      const params = [status, now, id];
      let sql = 'UPDATE work_orders SET status = ?, updated_at = ?';
      
      if (operator) {
        sql += ', operator = ?';
        params.splice(2, 0, operator);
      }
      if (notes) {
        sql += ', notes = ?';
        params.splice(3, 0, notes);
      }
      if (status === WORK_ORDER_STATUS.COMPLETED) {
        sql += ', completed_at = ?';
        params.splice(3, 0, now);
      }
      
      sql += ' WHERE id = ?';
      
      const stmt = db.prepare(sql);
      stmt.run(...params, function(err) {
        if (err) return reject(err);
        resolve({ changes: this.changes });
      });
    });
  }

  static checkAllCompleted(batchId) {
    return new Promise((resolve, reject) => {
      db.get(
        `SELECT COUNT(*) as total, 
         SUM(CASE WHEN status = ? THEN 1 ELSE 0 END) as completed 
         FROM work_orders WHERE batch_id = ?`,
        [WORK_ORDER_STATUS.COMPLETED, batchId],
        (err, row) => {
          if (err) return reject(err);
          resolve({
            total: row.total,
            completed: row.completed,
            allCompleted: row.total > 0 && row.total === row.completed
          });
        }
      );
    });
  }

  static resetForRework(batchId) {
    return new Promise((resolve, reject) => {
      const now = Date.now();
      const stmt = db.prepare(`
        UPDATE work_orders 
        SET status = ?, updated_at = ?, completed_at = NULL 
        WHERE batch_id = ?
      `);
      stmt.run(WORK_ORDER_STATUS.PENDING, now, batchId, function(err) {
        if (err) return reject(err);
        resolve({ changes: this.changes });
      });
    });
  }

  static _mapRow(row) {
    return {
      id: row.id,
      batchId: row.batch_id,
      processCode: row.process_code,
      processName: row.process_name,
      department: row.department,
      departmentLabel: row.department ? DEPARTMENT_LABELS[row.department] : row.department,
      sequence: row.sequence,
      status: row.status,
      statusLabel: WORK_ORDER_STATUS_LABELS[row.status],
      operator: row.operator,
      notes: row.notes,
      completedAt: row.completed_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }
}

module.exports = { WorkOrder, DEFAULT_PROCESSES };

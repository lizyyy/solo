const db = require('../models/database');
const LogService = require('./LogService');

class DepartmentService {
  static async create(data, operatorId, operatorName) {
    return new Promise((resolve, reject) => {
      const { name, code, budget_limit } = data;
      
      if (!name || !code) {
        return reject(new Error('部门名称和编码不能为空'));
      }

      const sql = `INSERT INTO departments (name, code, budget_limit) VALUES (?, ?, ?)`;
      db.run(sql, [name, code, budget_limit || 0], async function(err) {
        if (err) {
          if (err.message.includes('UNIQUE constraint')) {
            return reject(new Error('部门名称或编码已存在'));
          }
          return reject(err);
        }

        const deptId = this.lastID;
        await LogService.logOperation('department', deptId, 'create', operatorId, operatorName, null, data);
        
        resolve({ id: deptId, name, code, budget_limit: budget_limit || 0 });
      });
    });
  }

  static async update(id, data, operatorId, operatorName) {
    return new Promise((resolve, reject) => {
      db.get(`SELECT * FROM departments WHERE id = ?`, [id], async (err, oldDept) => {
        if (err) return reject(err);
        if (!oldDept) return reject(new Error('部门不存在'));

        const updates = [];
        const params = [];
        const fields = ['name', 'code', 'budget_limit'];

        fields.forEach(field => {
          if (data[field] !== undefined) {
            updates.push(`${field} = ?`);
            params.push(data[field]);
          }
        });

        if (updates.length === 0) {
          return resolve(oldDept);
        }

        updates.push('updated_at = CURRENT_TIMESTAMP');
        params.push(id);

        const sql = `UPDATE departments SET ${updates.join(', ')} WHERE id = ?`;
        db.run(sql, params, async function(err) {
          if (err) {
            if (err.message.includes('UNIQUE constraint')) {
              return reject(new Error('部门名称或编码已存在'));
            }
            return reject(err);
          }

          await LogService.logOperation('department', id, 'update', operatorId, operatorName, oldDept, data);

          for (const field of fields) {
            if (data[field] !== undefined && oldDept[field] !== data[field]) {
              await LogService.logModification('department', id, field, oldDept[field], data[field], operatorId, operatorName);
            }
          }

          db.get(`SELECT * FROM departments WHERE id = ?`, [id], (err, newDept) => {
            if (err) reject(err);
            else resolve(newDept);
          });
        });
      });
    });
  }

  static getAll() {
    return new Promise((resolve, reject) => {
      db.all(`SELECT * FROM departments ORDER BY created_at DESC`, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  static getById(id) {
    return new Promise((resolve, reject) => {
      db.get(`SELECT * FROM departments WHERE id = ?`, [id], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }
}

module.exports = DepartmentService;

const db = require('../models/database');
const LogService = require('./LogService');

class BudgetService {
  static async getOrCreateBudget(departmentId, period) {
    return new Promise((resolve, reject) => {
      db.get(`SELECT * FROM budget_records WHERE department_id = ? AND period = ?`, [departmentId, period], async (err, budget) => {
        if (err) return reject(err);
        
        if (budget) {
          return resolve(budget);
        }

        db.get(`SELECT budget_limit FROM departments WHERE id = ?`, [departmentId], (err, dept) => {
          if (err) return reject(err);
          if (!dept) return reject(new Error('部门不存在'));

          const totalBudget = dept.budget_limit;
          const sql = `INSERT INTO budget_records (department_id, period, total_budget, used_budget, remaining_budget) VALUES (?, ?, ?, 0, ?)`;
          db.run(sql, [departmentId, period, totalBudget, totalBudget], function(err) {
            if (err) return reject(err);
            resolve({
              id: this.lastID,
              department_id: departmentId,
              period,
              total_budget: totalBudget,
              used_budget: 0,
              remaining_budget: totalBudget
            });
          });
        });
      });
    });
  }

  static getBudgetByDepartmentAndPeriod(departmentId, period) {
    return new Promise((resolve, reject) => {
      db.get(`SELECT * FROM budget_records WHERE department_id = ? AND period = ?`, [departmentId, period], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  static async consumeBudget(departmentId, period, amount, operatorId, operatorName) {
    const budget = await this.getOrCreateBudget(departmentId, period);
    
    if (budget.remaining_budget < amount) {
      throw new Error('预算不足');
    }

    return new Promise((resolve, reject) => {
      const newUsed = budget.used_budget + amount;
      const newRemaining = budget.remaining_budget - amount;
      
      const sql = `UPDATE budget_records SET used_budget = ?, remaining_budget = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`;
      db.run(sql, [newUsed, newRemaining, budget.id], async function(err) {
        if (err) return reject(err);

        await LogService.logOperation('budget', budget.id, 'consume', operatorId, operatorName, budget, {
          ...budget,
          used_budget: newUsed,
          remaining_budget: newRemaining
        });

        resolve({ success: true, newUsed, newRemaining });
      });
    });
  }

  static async refundBudget(departmentId, period, amount, operatorId, operatorName) {
    const budget = await this.getOrCreateBudget(departmentId, period);

    return new Promise((resolve, reject) => {
      const newUsed = Math.max(0, budget.used_budget - amount);
      const newRemaining = budget.remaining_budget + amount;
      
      const sql = `UPDATE budget_records SET used_budget = ?, remaining_budget = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`;
      db.run(sql, [newUsed, newRemaining, budget.id], async function(err) {
        if (err) return reject(err);

        await LogService.logOperation('budget', budget.id, 'refund', operatorId, operatorName, budget, {
          ...budget,
          used_budget: newUsed,
          remaining_budget: newRemaining
        });

        resolve({ success: true, newUsed, newRemaining });
      });
    });
  }

  static getAll() {
    return new Promise((resolve, reject) => {
      db.all(`SELECT b.*, d.name as department_name FROM budget_records b LEFT JOIN departments d ON b.department_id = d.id ORDER BY b.created_at DESC`, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }
}

module.exports = BudgetService;

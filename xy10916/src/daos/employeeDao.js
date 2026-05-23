const db = require('../config/database');
const { v4: uuidv4 } = require('uuid');

class EmployeeDao {
  create(employee) {
    return new Promise((resolve, reject) => {
      const id = uuidv4();
      const { employee_no, name, department, position, status } = employee;
      db.run(
        `INSERT INTO employees (id, employee_no, name, department, position, status) 
         VALUES (?, ?, ?, ?, ?, ?)`,
        [id, employee_no, name, department, position, status || 'active'],
        function(err) {
          if (err) reject(err);
          else resolve({ id, ...employee });
        }
      );
    });
  }

  findById(id) {
    return new Promise((resolve, reject) => {
      db.get('SELECT * FROM employees WHERE id = ?', [id], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  findAll(filters = {}) {
    return new Promise((resolve, reject) => {
      let query = 'SELECT * FROM employees WHERE 1=1';
      const params = [];
      
      if (filters.department) {
        query += ' AND department = ?';
        params.push(filters.department);
      }
      if (filters.status) {
        query += ' AND status = ?';
        params.push(filters.status);
      }
      
      db.all(query, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  update(id, updates) {
    return new Promise((resolve, reject) => {
      const fields = Object.keys(updates).map(key => `${key} = ?`).join(', ');
      const values = [...Object.values(updates), id];
      db.run(
        `UPDATE employees SET ${fields}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        values,
        function(err) {
          if (err) reject(err);
          else resolve(this.changes);
        }
      );
    });
  }
}

module.exports = new EmployeeDao();

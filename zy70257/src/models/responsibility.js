const db = require('../config/database');
const { DEPARTMENT_LABELS } = require('../utils/enums');
const { v4: uuidv4 } = require('uuid');

class Responsibility {
  static create(responsibility) {
    return new Promise((resolve, reject) => {
      const id = uuidv4();
      const { returnId, primaryDepartment, secondaryDepartments = [], operator, processCode, processName, description, severity = 'medium' } = responsibility;
      const now = Date.now();
      
      const stmt = db.prepare(`
        INSERT INTO responsibilities (
          id, return_id, primary_department, secondary_departments,
          operator, process_code, process_name, description, severity, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      
      stmt.run(
        id, returnId, primaryDepartment, JSON.stringify(secondaryDepartments),
        operator, processCode, processName, description, severity, now, now,
        function(err) {
          if (err) return reject(err);
          resolve({
            id,
            returnId,
            primaryDepartment,
            primaryDepartmentLabel: DEPARTMENT_LABELS[primaryDepartment],
            secondaryDepartments,
            secondaryDepartmentLabels: secondaryDepartments.map(d => DEPARTMENT_LABELS[d] || d),
            operator,
            processCode,
            processName,
            description,
            severity,
            createdAt: now,
            updatedAt: now
          });
        }
      );
    });
  }

  static findById(id) {
    return new Promise((resolve, reject) => {
      db.get('SELECT * FROM responsibilities WHERE id = ?', [id], (err, row) => {
        if (err) return reject(err);
        resolve(row ? this._mapRow(row) : null);
      });
    });
  }

  static findByReturnId(returnId) {
    return new Promise((resolve, reject) => {
      db.all('SELECT * FROM responsibilities WHERE return_id = ? ORDER BY created_at DESC', [returnId], (err, rows) => {
        if (err) return reject(err);
        resolve(rows.map(row => this._mapRow(row)));
      });
    });
  }

  static findAll(params = {}) {
    return new Promise((resolve, reject) => {
      let sql = 'SELECT * FROM responsibilities WHERE 1=1';
      const queryParams = [];
      
      if (params.primaryDepartment) {
        sql += ' AND primary_department = ?';
        queryParams.push(params.primaryDepartment);
      }
      if (params.severity) {
        sql += ' AND severity = ?';
        queryParams.push(params.severity);
      }
      
      sql += ' ORDER BY created_at DESC';
      
      db.all(sql, queryParams, (err, rows) => {
        if (err) return reject(err);
        resolve(rows.map(row => this._mapRow(row)));
      });
    });
  }

  static getStatistics() {
    return new Promise((resolve, reject) => {
      db.all(`
        SELECT 
          primary_department as department,
          COUNT(*) as count,
          severity,
          SUM(CASE WHEN severity = 'high' THEN 1 ELSE 0 END) as high_count,
          SUM(CASE WHEN severity = 'medium' THEN 1 ELSE 0 END) as medium_count,
          SUM(CASE WHEN severity = 'low' THEN 1 ELSE 0 END) as low_count
        FROM responsibilities
        GROUP BY primary_department, severity
        ORDER BY count DESC
      `, [], (err, rows) => {
        if (err) return reject(err);
        resolve(rows.map(row => ({
          department: row.department,
          departmentLabel: DEPARTMENT_LABELS[row.department] || row.department,
          count: row.count,
          severity: row.severity,
          highCount: row.high_count,
          mediumCount: row.medium_count,
          lowCount: row.low_count
        })));
      });
    });
  }

  static _mapRow(row) {
    let secondaryDepartments = [];
    try {
      secondaryDepartments = JSON.parse(row.secondary_departments) || [];
    } catch (e) {
      secondaryDepartments = [];
    }
    
    return {
      id: row.id,
      returnId: row.return_id,
      primaryDepartment: row.primary_department,
      primaryDepartmentLabel: DEPARTMENT_LABELS[row.primary_department],
      secondaryDepartments,
      secondaryDepartmentLabels: secondaryDepartments.map(d => DEPARTMENT_LABELS[d] || d),
      operator: row.operator,
      processCode: row.process_code,
      processName: row.process_name,
      description: row.description,
      severity: row.severity,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }
}

module.exports = Responsibility;

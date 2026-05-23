const db = require('../config/database');
const { v4: uuidv4 } = require('uuid');

class CertificateDao {
  createCertificateType(certType) {
    return new Promise((resolve, reject) => {
      const id = uuidv4();
      const { code, name, valid_years, description } = certType;
      db.run(
        `INSERT INTO certificate_types (id, code, name, valid_years, description) 
         VALUES (?, ?, ?, ?, ?)`,
        [id, code, name, valid_years, description],
        function(err) {
          if (err) reject(err);
          else resolve({ id, ...certType });
        }
      );
    });
  }

  findAllCertificateTypes() {
    return new Promise((resolve, reject) => {
      db.all('SELECT * FROM certificate_types', [], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  createEmployeeCertificate(cert, idempotencyKey) {
    return new Promise((resolve, reject) => {
      const id = uuidv4();
      const { employee_id, certificate_type_id, issue_date, expiry_date, status } = cert;
      db.run(
        `INSERT INTO employee_certificates (id, employee_id, certificate_type_id, issue_date, expiry_date, status, idempotency_key) 
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [id, employee_id, certificate_type_id, issue_date, expiry_date, status || 'valid', idempotencyKey],
        function(err) {
          if (err) reject(err);
          else resolve({ id, ...cert });
        }
      );
    });
  }

  findByIdempotencyKey(key) {
    return new Promise((resolve, reject) => {
      db.get('SELECT * FROM employee_certificates WHERE idempotency_key = ?', [key], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  findEmployeeCertificates(employeeId) {
    return new Promise((resolve, reject) => {
      db.all(`
        SELECT ec.*, ct.name as certificate_name, ct.code as certificate_code
        FROM employee_certificates ec
        JOIN certificate_types ct ON ec.certificate_type_id = ct.id
        WHERE ec.employee_id = ?
        ORDER BY ec.expiry_date DESC
      `, [employeeId], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  findExpiringCertificates(daysAhead = 30) {
    return new Promise((resolve, reject) => {
      db.all(`
        SELECT ec.*, e.name as employee_name, e.employee_no, ct.name as certificate_name
        FROM employee_certificates ec
        JOIN employees e ON ec.employee_id = e.id
        JOIN certificate_types ct ON ec.certificate_type_id = ct.id
        WHERE ec.status = 'valid'
        AND julianday(ec.expiry_date) - julianday('now') <= ?
        AND julianday(ec.expiry_date) - julianday('now') >= 0
        ORDER BY ec.expiry_date ASC
      `, [daysAhead], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  updateEmployeeCertificate(id, updates) {
    return new Promise((resolve, reject) => {
      const fields = Object.keys(updates).map(key => `${key} = ?`).join(', ');
      const values = [...Object.values(updates), id];
      db.run(
        `UPDATE employee_certificates SET ${fields}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        values,
        function(err) {
          if (err) reject(err);
          else resolve(this.changes);
        }
      );
    });
  }
}

module.exports = new CertificateDao();

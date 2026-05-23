const db = require('../config/database');
const { v4: uuidv4 } = require('uuid');

class RenewalDao {
  createPositionRequirement(req) {
    return new Promise((resolve, reject) => {
      const id = uuidv4();
      const { position, certificate_type_id, is_required } = req;
      db.run(
        `INSERT INTO position_requirements (id, position, certificate_type_id, is_required) 
         VALUES (?, ?, ?, ?)`,
        [id, position, certificate_type_id, is_required !== false],
        function(err) {
          if (err) reject(err);
          else resolve({ id, ...req });
        }
      );
    });
  }

  findPositionRequirements(position) {
    return new Promise((resolve, reject) => {
      db.all(`
        SELECT pr.*, ct.name as certificate_name, ct.code as certificate_code
        FROM position_requirements pr
        JOIN certificate_types ct ON pr.certificate_type_id = ct.id
        WHERE pr.position = ?
      `, [position], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  createRenewalChecklist(checklist) {
    return new Promise((resolve, reject) => {
      const id = uuidv4();
      const { employee_id, certificate_type_id, employee_certificate_id, checklist_date, status, days_until_expiry, is_qualified, qualification_details } = checklist;
      db.run(
        `INSERT INTO renewal_checklists (id, employee_id, certificate_type_id, employee_certificate_id, checklist_date, status, days_until_expiry, is_qualified, qualification_details) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, employee_id, certificate_type_id, employee_certificate_id, checklist_date, status || 'pending', days_until_expiry, is_qualified, qualification_details],
        function(err) {
          if (err) reject(err);
          else resolve({ id, ...checklist });
        }
      );
    });
  }

  findRenewalChecklists(filters = {}) {
    return new Promise((resolve, reject) => {
      let query = `
        SELECT rc.*, e.name as employee_name, e.employee_no, 
               ct.name as certificate_name, ct.code as certificate_code
        FROM renewal_checklists rc
        JOIN employees e ON rc.employee_id = e.id
        JOIN certificate_types ct ON rc.certificate_type_id = ct.id
        WHERE 1=1
      `;
      const params = [];
      
      if (filters.status) {
        query += ' AND rc.status = ?';
        params.push(filters.status);
      }
      if (filters.checklist_date) {
        query += ' AND rc.checklist_date = ?';
        params.push(filters.checklist_date);
      }
      
      query += ' ORDER BY rc.checklist_date DESC, rc.days_until_expiry ASC';
      
      db.all(query, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  updateRenewalChecklist(id, updates) {
    return new Promise((resolve, reject) => {
      const fields = Object.keys(updates).map(key => `${key} = ?`).join(', ');
      const values = [...Object.values(updates), id];
      db.run(
        `UPDATE renewal_checklists SET ${fields}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        values,
        function(err) {
          if (err) reject(err);
          else resolve(this.changes);
        }
      );
    });
  }

  createProcessingException(exception) {
    return new Promise((resolve, reject) => {
      const id = uuidv4();
      const { operation_type, raw_input, error_message, processing_result, status } = exception;
      db.run(
        `INSERT INTO processing_exceptions (id, operation_type, raw_input, error_message, processing_result, status) 
         VALUES (?, ?, ?, ?, ?, ?)`,
        [id, operation_type, raw_input, error_message, processing_result, status || 'pending'],
        function(err) {
          if (err) reject(err);
          else resolve({ id, ...exception });
        }
      );
    });
  }

  findProcessingExceptions(status = null) {
    return new Promise((resolve, reject) => {
      let query = 'SELECT * FROM processing_exceptions';
      const params = [];
      
      if (status) {
        query += ' WHERE status = ?';
        params.push(status);
      }
      
      query += ' ORDER BY created_at DESC';
      
      db.all(query, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  createManualCorrection(correction) {
    return new Promise((resolve, reject) => {
      const id = uuidv4();
      const { target_type, target_id, field_name, old_value, new_value, reason, operator } = correction;
      db.run(
        `INSERT INTO manual_corrections (id, target_type, target_id, field_name, old_value, new_value, reason, operator) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, target_type, target_id, field_name, old_value, new_value, reason, operator],
        function(err) {
          if (err) reject(err);
          else resolve({ id, ...correction });
        }
      );
    });
  }

  findManualCorrections(targetType = null, targetId = null) {
    return new Promise((resolve, reject) => {
      let query = 'SELECT * FROM manual_corrections WHERE 1=1';
      const params = [];
      
      if (targetType) {
        query += ' AND target_type = ?';
        params.push(targetType);
      }
      if (targetId) {
        query += ' AND target_id = ?';
        params.push(targetId);
      }
      
      query += ' ORDER BY created_at DESC';
      
      db.all(query, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }
}

module.exports = new RenewalDao();

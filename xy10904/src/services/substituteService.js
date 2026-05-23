const db = require('../config/database');
const { v4: uuidv4 } = require('uuid');
const { logException } = require('./exceptionService');

const createSubstitute = async (data) => {
  return new Promise((resolve, reject) => {
    const { appointment_id, original_coach_id, substitute_coach_id, reason, operator } = data;
    const id = uuidv4();
    
    db.serialize(() => {
      db.run('BEGIN TRANSACTION');
      
      const getAppointmentSql = 'SELECT * FROM appointments WHERE id = ?';
      db.get(getAppointmentSql, [appointment_id], async (err, appointment) => {
        if (err) {
          db.run('ROLLBACK');
          await logException('create_substitute', data, err.message, 'DB_ERROR', 'TRANSACTION_ROLLBACK', appointment_id, 'appointment', operator);
          return reject({ error: err.message, errorCode: 'DB_ERROR' });
        }

        if (!appointment) {
          db.run('ROLLBACK');
          await logException('create_substitute', data, '预约记录不存在', 'APPOINTMENT_NOT_FOUND', 'REJECTED', appointment_id, 'appointment', operator);
          return reject({ error: '预约记录不存在', errorCode: 'APPOINTMENT_NOT_FOUND' });
        }

        if (appointment.status !== 'scheduled') {
          db.run('ROLLBACK');
          await logException('create_substitute', data, '预约状态不正确: ' + appointment.status, 'INVALID_STATUS', 'REJECTED', appointment_id, 'appointment', operator);
          return reject({ error: '预约状态不正确', errorCode: 'INVALID_STATUS' });
        }

        const insertSql = `
          INSERT INTO substitute_records (
            id, appointment_id, original_coach_id, substitute_coach_id, reason, status
          ) VALUES (?, ?, ?, ?, ?, ?)
        `;
        
        db.run(insertSql, [id, appointment_id, original_coach_id, substitute_coach_id, reason, 'pending'], (err) => {
          if (err) {
            db.run('ROLLBACK');
            logException('create_substitute', data, err.message, 'DB_ERROR', 'TRANSACTION_ROLLBACK', id, 'substitute', operator);
            return reject({ error: err.message, errorCode: 'DB_ERROR' });
          }

          db.run('COMMIT', (err) => {
            if (err) {
              db.run('ROLLBACK');
              logException('create_substitute', data, err.message, 'DB_ERROR', 'TRANSACTION_ROLLBACK', id, 'substitute', operator);
              return reject({ error: err.message, errorCode: 'DB_ERROR' });
            }
            resolve({ id, ...data, status: 'pending' });
          });
        });
      });
    });
  });
};

const confirmSubstitute = async (substituteId, confirmedBy, operator) => {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run('BEGIN TRANSACTION');
      
      const getSubstituteSql = 'SELECT * FROM substitute_records WHERE id = ?';
      db.get(getSubstituteSql, [substituteId], async (err, substitute) => {
        if (err) {
          db.run('ROLLBACK');
          await logException('confirm_substitute', { substituteId, confirmedBy }, err.message, 'DB_ERROR', 'TRANSACTION_ROLLBACK', substituteId, 'substitute', operator);
          return reject({ error: err.message, errorCode: 'DB_ERROR' });
        }

        if (!substitute) {
          db.run('ROLLBACK');
          await logException('confirm_substitute', { substituteId, confirmedBy }, '代课记录不存在', 'SUBSTITUTE_NOT_FOUND', 'REJECTED', substituteId, 'substitute', operator);
          return reject({ error: '代课记录不存在', errorCode: 'SUBSTITUTE_NOT_FOUND' });
        }

        if (substitute.status !== 'pending') {
          db.run('ROLLBACK');
          await logException('confirm_substitute', { substituteId, confirmedBy }, '代课状态不正确: ' + substitute.status, 'INVALID_STATUS', 'REJECTED', substituteId, 'substitute', operator);
          return reject({ error: '代课状态不正确', errorCode: 'INVALID_STATUS' });
        }

        const updateSubstituteSql = `
          UPDATE substitute_records 
          SET status = 'confirmed', confirmed_by = ?, confirmed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `;
        
        db.run(updateSubstituteSql, [confirmedBy, substituteId], (err) => {
          if (err) {
            db.run('ROLLBACK');
            logException('confirm_substitute', { substituteId, confirmedBy }, err.message, 'DB_ERROR', 'TRANSACTION_ROLLBACK', substituteId, 'substitute', operator);
            return reject({ error: err.message, errorCode: 'DB_ERROR' });
          }

          const updateAppointmentSql = 'UPDATE appointments SET coach_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?';
          db.run(updateAppointmentSql, [substitute.substitute_coach_id, substitute.appointment_id], (err) => {
            if (err) {
              db.run('ROLLBACK');
              logException('confirm_substitute', { substituteId, confirmedBy }, err.message, 'DB_ERROR', 'TRANSACTION_ROLLBACK', substitute.appointment_id, 'appointment', operator);
              return reject({ error: err.message, errorCode: 'DB_ERROR' });
            }

            db.run('COMMIT', (err) => {
              if (err) {
                db.run('ROLLBACK');
                logException('confirm_substitute', { substituteId, confirmedBy }, err.message, 'DB_ERROR', 'TRANSACTION_ROLLBACK', substituteId, 'substitute', operator);
                return reject({ error: err.message, errorCode: 'DB_ERROR' });
              }
              resolve({ substituteId, status: 'confirmed', confirmedBy });
            });
          });
        });
      });
    });
  });
};

const rejectSubstitute = async (substituteId, rejectReason, operator) => {
  return new Promise((resolve, reject) => {
    const updateSql = `
      UPDATE substitute_records 
      SET status = 'rejected', reject_reason = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `;
    
    db.run(updateSql, [rejectReason, substituteId], async (err) => {
      if (err) {
        await logException('reject_substitute', { substituteId, rejectReason }, err.message, 'DB_ERROR', 'FAILED', substituteId, 'substitute', operator);
        return reject({ error: err.message, errorCode: 'DB_ERROR' });
      }
      resolve({ substituteId, status: 'rejected', rejectReason });
    });
  });
};

const getSubstitute = async (id) => {
  return new Promise((resolve, reject) => {
    const sql = `
      SELECT 
        sr.*,
        oc.name as original_coach_name,
        sc.name as substitute_coach_name,
        a.appointment_date,
        a.appointment_time,
        m.name as member_name
      FROM substitute_records sr
      LEFT JOIN coaches oc ON sr.original_coach_id = oc.id
      LEFT JOIN coaches sc ON sr.substitute_coach_id = sc.id
      LEFT JOIN appointments a ON sr.appointment_id = a.id
      LEFT JOIN members m ON a.member_id = m.id
      WHERE sr.id = ?
    `;
    db.get(sql, [id], (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
};

module.exports = {
  createSubstitute,
  confirmSubstitute,
  rejectSubstitute,
  getSubstitute
};

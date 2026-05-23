const db = require('../config/database');
const { v4: uuidv4 } = require('uuid');
const moment = require('moment');
const { logException } = require('./exceptionService');
const { CANCEL_WINDOW_HOURS } = require('./courseConsumptionService');

const applyLeave = async (data) => {
  return new Promise((resolve, reject) => {
    const { appointment_id, member_id, reason, operator } = data;
    const id = uuidv4();
    
    db.serialize(() => {
      db.run('BEGIN TRANSACTION');
      
      const getAppointmentSql = 'SELECT * FROM appointments WHERE id = ?';
      db.get(getAppointmentSql, [appointment_id], async (err, appointment) => {
        if (err) {
          db.run('ROLLBACK');
          await logException('apply_leave', data, err.message, 'DB_ERROR', 'TRANSACTION_ROLLBACK', appointment_id, 'appointment', operator);
          return reject({ error: err.message, errorCode: 'DB_ERROR' });
        }

        if (!appointment) {
          db.run('ROLLBACK');
          await logException('apply_leave', data, '预约记录不存在', 'APPOINTMENT_NOT_FOUND', 'REJECTED', appointment_id, 'appointment', operator);
          return reject({ error: '预约记录不存在', errorCode: 'APPOINTMENT_NOT_FOUND' });
        }

        if (appointment.status !== 'scheduled') {
          db.run('ROLLBACK');
          await logException('apply_leave', data, '预约状态不正确: ' + appointment.status, 'INVALID_STATUS', 'REJECTED', appointment_id, 'appointment', operator);
          return reject({ error: '预约状态不正确', errorCode: 'INVALID_STATUS' });
        }

        const appointmentDateTime = moment(`${appointment.appointment_date} ${appointment.appointment_time}`);
        const hoursDiff = appointmentDateTime.diff(moment(), 'hours');
        
        if (hoursDiff < CANCEL_WINDOW_HOURS) {
          db.run('ROLLBACK');
          await logException('apply_leave', data, `距离开课不足${CANCEL_WINDOW_HOURS}小时，无法请假`, 'WITHIN_CANCEL_WINDOW', 'REJECTED', appointment_id, 'appointment', operator);
          return reject({ error: `距离开课不足${CANCEL_WINDOW_HOURS}小时，无法请假`, errorCode: 'WITHIN_CANCEL_WINDOW' });
        }

        const insertSql = `
          INSERT INTO leave_applications (
            id, appointment_id, member_id, reason, status
          ) VALUES (?, ?, ?, ?, ?)
        `;
        
        db.run(insertSql, [id, appointment_id, member_id, reason, 'pending'], (err) => {
          if (err) {
            db.run('ROLLBACK');
            logException('apply_leave', data, err.message, 'DB_ERROR', 'TRANSACTION_ROLLBACK', id, 'leave', operator);
            return reject({ error: err.message, errorCode: 'DB_ERROR' });
          }

          db.run('COMMIT', (err) => {
            if (err) {
              db.run('ROLLBACK');
              logException('apply_leave', data, err.message, 'DB_ERROR', 'TRANSACTION_ROLLBACK', id, 'leave', operator);
              return reject({ error: err.message, errorCode: 'DB_ERROR' });
            }
            resolve({ id, ...data, status: 'pending' });
          });
        });
      });
    });
  });
};

const approveLeave = async (leaveId, approvedBy, operator) => {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run('BEGIN TRANSACTION');
      
      const getLeaveSql = 'SELECT * FROM leave_applications WHERE id = ?';
      db.get(getLeaveSql, [leaveId], async (err, leave) => {
        if (err) {
          db.run('ROLLBACK');
          await logException('approve_leave', { leaveId, approvedBy }, err.message, 'DB_ERROR', 'TRANSACTION_ROLLBACK', leaveId, 'leave', operator);
          return reject({ error: err.message, errorCode: 'DB_ERROR' });
        }

        if (!leave) {
          db.run('ROLLBACK');
          await logException('approve_leave', { leaveId, approvedBy }, '请假记录不存在', 'LEAVE_NOT_FOUND', 'REJECTED', leaveId, 'leave', operator);
          return reject({ error: '请假记录不存在', errorCode: 'LEAVE_NOT_FOUND' });
        }

        if (leave.status !== 'pending') {
          db.run('ROLLBACK');
          await logException('approve_leave', { leaveId, approvedBy }, '请假状态不正确: ' + leave.status, 'INVALID_STATUS', 'REJECTED', leaveId, 'leave', operator);
          return reject({ error: '请假状态不正确', errorCode: 'INVALID_STATUS' });
        }

        const updateLeaveSql = `
          UPDATE leave_applications 
          SET status = 'approved', approved_by = ?, approved_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `;
        
        db.run(updateLeaveSql, [approvedBy, leaveId], (err) => {
          if (err) {
            db.run('ROLLBACK');
            logException('approve_leave', { leaveId, approvedBy }, err.message, 'DB_ERROR', 'TRANSACTION_ROLLBACK', leaveId, 'leave', operator);
            return reject({ error: err.message, errorCode: 'DB_ERROR' });
          }

          const updateAppointmentSql = `
            UPDATE appointments 
            SET status = 'cancelled', cancel_reason = '请假', cancelled_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
          `;
          
          db.run(updateAppointmentSql, [leave.appointment_id], (err) => {
            if (err) {
              db.run('ROLLBACK');
              logException('approve_leave', { leaveId, approvedBy }, err.message, 'DB_ERROR', 'TRANSACTION_ROLLBACK', leave.appointment_id, 'appointment', operator);
              return reject({ error: err.message, errorCode: 'DB_ERROR' });
            }

            db.run('COMMIT', (err) => {
              if (err) {
                db.run('ROLLBACK');
                logException('approve_leave', { leaveId, approvedBy }, err.message, 'DB_ERROR', 'TRANSACTION_ROLLBACK', leaveId, 'leave', operator);
                return reject({ error: err.message, errorCode: 'DB_ERROR' });
              }
              resolve({ leaveId, status: 'approved', approvedBy });
            });
          });
        });
      });
    });
  });
};

const rejectLeave = async (leaveId, rejectReason, operator) => {
  return new Promise((resolve, reject) => {
    const updateSql = `
      UPDATE leave_applications 
      SET status = 'rejected', reject_reason = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `;
    
    db.run(updateSql, [rejectReason, leaveId], async (err) => {
      if (err) {
        await logException('reject_leave', { leaveId, rejectReason }, err.message, 'DB_ERROR', 'FAILED', leaveId, 'leave', operator);
        return reject({ error: err.message, errorCode: 'DB_ERROR' });
      }
      resolve({ leaveId, status: 'rejected', rejectReason });
    });
  });
};

const getLeave = async (id) => {
  return new Promise((resolve, reject) => {
    const sql = `
      SELECT 
        la.*,
        m.name as member_name,
        a.appointment_date,
        a.appointment_time
      FROM leave_applications la
      LEFT JOIN members m ON la.member_id = m.id
      LEFT JOIN appointments a ON la.appointment_id = a.id
      WHERE la.id = ?
    `;
    db.get(sql, [id], (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
};

module.exports = {
  applyLeave,
  approveLeave,
  rejectLeave,
  getLeave
};

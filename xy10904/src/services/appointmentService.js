const db = require('../config/database');
const { v4: uuidv4 } = require('uuid');
const { logException } = require('./exceptionService');

const createAppointment = async (data) => {
  return new Promise((resolve, reject) => {
    const { membership_card_id, member_id, coach_id, appointment_date, appointment_time, remark, operator } = data;
    const id = uuidv4();
    
    db.serialize(() => {
      db.run('BEGIN TRANSACTION');
      
      const getCardSql = 'SELECT * FROM membership_cards WHERE id = ?';
      db.get(getCardSql, [membership_card_id], async (err, card) => {
        if (err) {
          db.run('ROLLBACK');
          await logException('create_appointment', data, err.message, 'DB_ERROR', 'TRANSACTION_ROLLBACK', membership_card_id, 'membership_card', operator);
          return reject({ error: err.message, errorCode: 'DB_ERROR' });
        }

        if (!card) {
          db.run('ROLLBACK');
          await logException('create_appointment', data, '会员卡不存在', 'CARD_NOT_FOUND', 'REJECTED', membership_card_id, 'membership_card', operator);
          return reject({ error: '会员卡不存在', errorCode: 'CARD_NOT_FOUND' });
        }

        if (card.status !== 'active') {
          db.run('ROLLBACK');
          await logException('create_appointment', data, '会员卡状态不正确: ' + card.status, 'INVALID_STATUS', 'REJECTED', membership_card_id, 'membership_card', operator);
          return reject({ error: '会员卡状态不正确', errorCode: 'INVALID_STATUS' });
        }

        if (card.remaining_lessons <= 0) {
          db.run('ROLLBACK');
          await logException('create_appointment', data, '剩余课时不足', 'INSUFFICIENT_LESSONS', 'REJECTED', membership_card_id, 'membership_card', operator);
          return reject({ error: '剩余课时不足', errorCode: 'INSUFFICIENT_LESSONS' });
        }

        const checkConflictSql = `
          SELECT * FROM appointments 
          WHERE coach_id = ? AND appointment_date = ? AND appointment_time = ? AND status = 'scheduled'
        `;
        
        db.get(checkConflictSql, [coach_id, appointment_date, appointment_time], async (err, conflict) => {
          if (err) {
            db.run('ROLLBACK');
            await logException('create_appointment', data, err.message, 'DB_ERROR', 'TRANSACTION_ROLLBACK', null, null, operator);
            return reject({ error: err.message, errorCode: 'DB_ERROR' });
          }

          if (conflict) {
            db.run('ROLLBACK');
            await logException('create_appointment', data, '该时段教练已有预约', 'TIME_CONFLICT', 'REJECTED', conflict.id, 'appointment', operator);
            return reject({ error: '该时段教练已有预约', errorCode: 'TIME_CONFLICT' });
          }

          const insertSql = `
            INSERT INTO appointments (
              id, membership_card_id, member_id, coach_id, appointment_date, appointment_time, status, remark
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `;
          
          db.run(insertSql, [id, membership_card_id, member_id, coach_id, appointment_date, appointment_time, 'scheduled', remark], (err) => {
            if (err) {
              db.run('ROLLBACK');
              logException('create_appointment', data, err.message, 'DB_ERROR', 'TRANSACTION_ROLLBACK', id, 'appointment', operator);
              return reject({ error: err.message, errorCode: 'DB_ERROR' });
            }

            db.run('COMMIT', (err) => {
              if (err) {
                db.run('ROLLBACK');
                logException('create_appointment', data, err.message, 'DB_ERROR', 'TRANSACTION_ROLLBACK', id, 'appointment', operator);
                return reject({ error: err.message, errorCode: 'DB_ERROR' });
              }
              resolve({ id, ...data, status: 'scheduled' });
            });
          });
        });
      });
    });
  });
};

const getAppointment = async (id) => {
  return new Promise((resolve, reject) => {
    const sql = `
      SELECT 
        a.*,
        m.name as member_name,
        m.phone as member_phone,
        c.name as coach_name,
        mc.remaining_lessons,
        cp.name as package_name
      FROM appointments a
      LEFT JOIN members m ON a.member_id = m.id
      LEFT JOIN coaches c ON a.coach_id = c.id
      LEFT JOIN membership_cards mc ON a.membership_card_id = mc.id
      LEFT JOIN course_packages cp ON mc.course_package_id = cp.id
      WHERE a.id = ?
    `;
    db.get(sql, [id], (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
};

const getAppointmentsByMember = async (memberId, filters = {}) => {
  return new Promise((resolve, reject) => {
    let sql = `
      SELECT 
        a.*,
        m.name as member_name,
        c.name as coach_name
      FROM appointments a
      LEFT JOIN members m ON a.member_id = m.id
      LEFT JOIN coaches c ON a.coach_id = c.id
      WHERE a.member_id = ?
    `;
    const params = [memberId];
    
    if (filters.status) {
      sql += ' AND a.status = ?';
      params.push(filters.status);
    }
    if (filters.start_date) {
      sql += ' AND a.appointment_date >= ?';
      params.push(filters.start_date);
    }
    if (filters.end_date) {
      sql += ' AND a.appointment_date <= ?';
      params.push(filters.end_date);
    }
    
    sql += ' ORDER BY a.appointment_date DESC, a.appointment_time DESC';
    
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
};

const cancelAppointment = async (appointmentId, cancelReason, operator) => {
  return new Promise((resolve, reject) => {
    const updateSql = `
      UPDATE appointments 
      SET status = 'cancelled', cancel_reason = ?, cancelled_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `;
    
    db.run(updateSql, [cancelReason, appointmentId], async (err) => {
      if (err) {
        await logException('cancel_appointment', { appointmentId, cancelReason }, err.message, 'DB_ERROR', 'FAILED', appointmentId, 'appointment', operator);
        return reject({ error: err.message, errorCode: 'DB_ERROR' });
      }
      resolve({ appointmentId, status: 'cancelled', cancelReason });
    });
  });
};

module.exports = {
  createAppointment,
  getAppointment,
  getAppointmentsByMember,
  cancelAppointment
};

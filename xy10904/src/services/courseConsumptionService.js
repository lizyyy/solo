const db = require('../config/database');
const { v4: uuidv4 } = require('uuid');
const moment = require('moment');
const { logException } = require('./exceptionService');

const CANCEL_WINDOW_HOURS = 24;

const consumeCourse = async (appointmentId, operator, remark = '') => {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run('BEGIN TRANSACTION');
      
      const getAppointmentSql = 'SELECT * FROM appointments WHERE id = ?';
      db.get(getAppointmentSql, [appointmentId], async (err, appointment) => {
        if (err) {
          db.run('ROLLBACK');
          await logException('consume_course', { appointmentId, operator }, err.message, 'DB_ERROR', 'TRANSACTION_ROLLBACK', appointmentId, 'appointment', operator);
          return reject({ error: err.message, errorCode: 'DB_ERROR' });
        }

        if (!appointment) {
          db.run('ROLLBACK');
          await logException('consume_course', { appointmentId, operator }, '预约记录不存在', 'APPOINTMENT_NOT_FOUND', 'REJECTED', appointmentId, 'appointment', operator);
          return reject({ error: '预约记录不存在', errorCode: 'APPOINTMENT_NOT_FOUND' });
        }

        if (appointment.status !== 'scheduled') {
          db.run('ROLLBACK');
          await logException('consume_course', { appointmentId, operator, currentStatus: appointment.status }, '预约状态不正确，当前状态: ' + appointment.status, 'INVALID_STATUS', 'REJECTED', appointmentId, 'appointment', operator);
          return reject({ error: '预约状态不正确，当前状态: ' + appointment.status, errorCode: 'INVALID_STATUS' });
        }

        const checkDuplicateSql = 'SELECT * FROM course_consumptions WHERE appointment_id = ? AND status = "completed"';
        db.get(checkDuplicateSql, [appointmentId], async (err, existingConsumption) => {
          if (err) {
            db.run('ROLLBACK');
            await logException('consume_course', { appointmentId, operator }, err.message, 'DB_ERROR', 'TRANSACTION_ROLLBACK', appointmentId, 'appointment', operator);
            return reject({ error: err.message, errorCode: 'DB_ERROR' });
          }

          if (existingConsumption) {
            db.run('ROLLBACK');
            await logException('consume_course', { appointmentId, operator }, '该预约已消课，消课记录ID: ' + existingConsumption.id, 'DUPLICATE_CONSUMPTION', 'REJECTED', existingConsumption.id, 'course_consumption', operator);
            return reject({ error: '该预约已消课，请勿重复操作', errorCode: 'DUPLICATE_CONSUMPTION', existingConsumptionId: existingConsumption.id });
          }

          const getCardSql = 'SELECT * FROM membership_cards WHERE id = ?';
          db.get(getCardSql, [appointment.membership_card_id], async (err, card) => {
            if (err) {
              db.run('ROLLBACK');
              await logException('consume_course', { appointmentId, operator }, err.message, 'DB_ERROR', 'TRANSACTION_ROLLBACK', appointment.membership_card_id, 'membership_card', operator);
              return reject({ error: err.message, errorCode: 'DB_ERROR' });
            }

            if (!card) {
              db.run('ROLLBACK');
              await logException('consume_course', { appointmentId, operator }, '会员卡不存在', 'CARD_NOT_FOUND', 'REJECTED', appointment.membership_card_id, 'membership_card', operator);
              return reject({ error: '会员卡不存在', errorCode: 'CARD_NOT_FOUND' });
            }

            if (card.status === 'frozen') {
              db.run('ROLLBACK');
              await logException('consume_course', { appointmentId, operator }, '会员卡处于冻结状态', 'CARD_FROZEN', 'REJECTED', appointment.membership_card_id, 'membership_card', operator);
              return reject({ error: '会员卡处于冻结状态，无法消课', errorCode: 'CARD_FROZEN' });
            }

            if (card.remaining_lessons <= 0) {
              db.run('ROLLBACK');
              await logException('consume_course', { appointmentId, operator }, '剩余课时不足，当前剩余: ' + card.remaining_lessons, 'INSUFFICIENT_LESSONS', 'REJECTED', appointment.membership_card_id, 'membership_card', operator);
              return reject({ error: '剩余课时不足', errorCode: 'INSUFFICIENT_LESSONS' });
            }

            const consumptionId = uuidv4();
            const beforeRemaining = card.remaining_lessons;
            const afterRemaining = card.remaining_lessons - 1;
            const consumptionDate = moment().format('YYYY-MM-DD HH:mm:ss');

            const insertConsumptionSql = `
              INSERT INTO course_consumptions (
                id, appointment_id, membership_card_id, member_id, coach_id,
                consumption_date, lessons_consumed, before_remaining, after_remaining,
                status, operator, remark
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `;
            db.run(insertConsumptionSql, [
              consumptionId, appointmentId, appointment.membership_card_id,
              appointment.member_id, appointment.coach_id, consumptionDate,
              1, beforeRemaining, afterRemaining, 'completed', operator, remark
            ], (err) => {
              if (err) {
                db.run('ROLLBACK');
                logException('consume_course', { appointmentId, operator }, err.message, 'DB_ERROR', 'TRANSACTION_ROLLBACK', consumptionId, 'course_consumption', operator);
                return reject({ error: err.message, errorCode: 'DB_ERROR' });
              }

              const updateCardSql = 'UPDATE membership_cards SET remaining_lessons = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?';
              db.run(updateCardSql, [afterRemaining, appointment.membership_card_id], (err) => {
                if (err) {
                  db.run('ROLLBACK');
                  logException('consume_course', { appointmentId, operator }, err.message, 'DB_ERROR', 'TRANSACTION_ROLLBACK', appointment.membership_card_id, 'membership_card', operator);
                  return reject({ error: err.message, errorCode: 'DB_ERROR' });
                }

                const updateAppointmentSql = 'UPDATE appointments SET status = "completed", updated_at = CURRENT_TIMESTAMP WHERE id = ?';
                db.run(updateAppointmentSql, [appointmentId], (err) => {
                  if (err) {
                    db.run('ROLLBACK');
                    logException('consume_course', { appointmentId, operator }, err.message, 'DB_ERROR', 'TRANSACTION_ROLLBACK', appointmentId, 'appointment', operator);
                    return reject({ error: err.message, errorCode: 'DB_ERROR' });
                  }

                  db.run('COMMIT', (err) => {
                    if (err) {
                      db.run('ROLLBACK');
                      logException('consume_course', { appointmentId, operator }, err.message, 'DB_ERROR', 'TRANSACTION_ROLLBACK', null, null, operator);
                      return reject({ error: err.message, errorCode: 'DB_ERROR' });
                    }

                    resolve({
                      consumptionId,
                      appointmentId,
                      membershipCardId: appointment.membership_card_id,
                      beforeRemaining,
                      afterRemaining,
                      operator
                    });
                  });
                });
              });
            });
          });
        });
      });
    });
  });
};

const getConsumptionDetail = async (consumptionId) => {
  return new Promise((resolve, reject) => {
    const sql = `
      SELECT 
        cc.*,
        m.name as member_name,
        c.name as coach_name,
        a.appointment_date,
        a.appointment_time
      FROM course_consumptions cc
      LEFT JOIN members m ON cc.member_id = m.id
      LEFT JOIN coaches c ON cc.coach_id = c.id
      LEFT JOIN appointments a ON cc.appointment_id = a.id
      WHERE cc.id = ?
    `;
    db.get(sql, [consumptionId], (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
};

const getConsumptionsByCard = async (cardId) => {
  return new Promise((resolve, reject) => {
    const sql = `
      SELECT 
        cc.*,
        m.name as member_name,
        c.name as coach_name,
        a.appointment_date,
        a.appointment_time
      FROM course_consumptions cc
      LEFT JOIN members m ON cc.member_id = m.id
      LEFT JOIN coaches c ON cc.coach_id = c.id
      LEFT JOIN appointments a ON cc.appointment_id = a.id
      WHERE cc.membership_card_id = ?
      ORDER BY cc.created_at DESC
    `;
    db.all(sql, [cardId], (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
};

module.exports = {
  consumeCourse,
  getConsumptionDetail,
  getConsumptionsByCard,
  CANCEL_WINDOW_HOURS
};

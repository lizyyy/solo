const db = require('../config/database');
const { v4: uuidv4 } = require('uuid');
const moment = require('moment');
const { logException } = require('./exceptionService');

const createMembershipCard = async (data) => {
  return new Promise((resolve, reject) => {
    const { member_id, course_package_id, coach_id, total_lessons, start_date, end_date, remark } = data;
    const id = uuidv4();
    
    const sql = `
      INSERT INTO membership_cards (
        id, member_id, course_package_id, coach_id, remaining_lessons,
        total_lessons, start_date, end_date, remark
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    db.run(sql, [id, member_id, course_package_id, coach_id, total_lessons, total_lessons, start_date, end_date, remark], function(err) {
      if (err) {
        logException('create_membership_card', data, err.message, 'DB_ERROR', 'FAILED', null, 'membership_card', data.operator);
        reject(err);
      } else {
        resolve({ id, ...data, remaining_lessons: total_lessons });
      }
    });
  });
};

const getMembershipCard = async (id) => {
  return new Promise((resolve, reject) => {
    const sql = `
      SELECT 
        mc.*,
        m.name as member_name,
        m.phone as member_phone,
        c.name as coach_name,
        cp.name as package_name
      FROM membership_cards mc
      LEFT JOIN members m ON mc.member_id = m.id
      LEFT JOIN coaches c ON mc.coach_id = c.id
      LEFT JOIN course_packages cp ON mc.course_package_id = cp.id
      WHERE mc.id = ?
    `;
    db.get(sql, [id], (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
};

const getMembershipCardsByMember = async (memberId) => {
  return new Promise((resolve, reject) => {
    const sql = `
      SELECT 
        mc.*,
        m.name as member_name,
        c.name as coach_name,
        cp.name as package_name
      FROM membership_cards mc
      LEFT JOIN members m ON mc.member_id = m.id
      LEFT JOIN coaches c ON mc.coach_id = c.id
      LEFT JOIN course_packages cp ON mc.course_package_id = cp.id
      WHERE mc.member_id = ?
      ORDER BY mc.created_at DESC
    `;
    db.all(sql, [memberId], (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
};

const freezeCard = async (cardId, freezeStartDate, freezeEndDate, operator, remark = '') => {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run('BEGIN TRANSACTION');
      
      const getCardSql = 'SELECT * FROM membership_cards WHERE id = ?';
      db.get(getCardSql, [cardId], async (err, card) => {
        if (err) {
          db.run('ROLLBACK');
          await logException('freeze_card', { cardId, freezeStartDate, freezeEndDate }, err.message, 'DB_ERROR', 'TRANSACTION_ROLLBACK', cardId, 'membership_card', operator);
          return reject({ error: err.message, errorCode: 'DB_ERROR' });
        }

        if (!card) {
          db.run('ROLLBACK');
          await logException('freeze_card', { cardId, freezeStartDate, freezeEndDate }, '会员卡不存在', 'CARD_NOT_FOUND', 'REJECTED', cardId, 'membership_card', operator);
          return reject({ error: '会员卡不存在', errorCode: 'CARD_NOT_FOUND' });
        }

        if (card.status === 'expired') {
          db.run('ROLLBACK');
          await logException('freeze_card', { cardId, freezeStartDate, freezeEndDate }, '会员卡已过期', 'CARD_EXPIRED', 'REJECTED', cardId, 'membership_card', operator);
          return reject({ error: '会员卡已过期，无法冻结', errorCode: 'CARD_EXPIRED' });
        }

        const freezeDays = moment(freezeEndDate).diff(moment(freezeStartDate), 'days') + 1;
        
        const updateSql = `
          UPDATE membership_cards 
          SET status = 'frozen', freeze_start_date = ?, freeze_end_date = ?, freeze_days = ?, remark = ?, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `;
        
        db.run(updateSql, [freezeStartDate, freezeEndDate, freezeDays, remark, cardId], (err) => {
          if (err) {
            db.run('ROLLBACK');
            logException('freeze_card', { cardId, freezeStartDate, freezeEndDate }, err.message, 'DB_ERROR', 'TRANSACTION_ROLLBACK', cardId, 'membership_card', operator);
            return reject({ error: err.message, errorCode: 'DB_ERROR' });
          }

          db.run('COMMIT', (err) => {
            if (err) {
              db.run('ROLLBACK');
              logException('freeze_card', { cardId, freezeStartDate, freezeEndDate }, err.message, 'DB_ERROR', 'TRANSACTION_ROLLBACK', cardId, 'membership_card', operator);
              return reject({ error: err.message, errorCode: 'DB_ERROR' });
            }
            resolve({ cardId, freezeStartDate, freezeEndDate, freezeDays, status: 'frozen' });
          });
        });
      });
    });
  });
};

const unfreezeCard = async (cardId, operator) => {
  return new Promise((resolve, reject) => {
    const updateSql = `
      UPDATE membership_cards 
      SET status = 'active', freeze_start_date = NULL, freeze_end_date = NULL, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `;
    
    db.run(updateSql, [cardId], async (err) => {
      if (err) {
        await logException('unfreeze_card', { cardId }, err.message, 'DB_ERROR', 'FAILED', cardId, 'membership_card', operator);
        return reject({ error: err.message, errorCode: 'DB_ERROR' });
      }
      resolve({ cardId, status: 'active' });
    });
  });
};

const manualCorrection = async (cardId, correctionType, beforeValue, afterValue, reason, operator) => {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run('BEGIN TRANSACTION');
      
      const correctionId = uuidv4();
      
      const insertCorrectionSql = `
        INSERT INTO manual_corrections (
          id, membership_card_id, member_id, correction_type, before_value, after_value, reason, operator
        ) VALUES (?, ?, (SELECT member_id FROM membership_cards WHERE id = ?), ?, ?, ?, ?, ?)
      `;
      
      db.run(insertCorrectionSql, [correctionId, cardId, cardId, correctionType, beforeValue, afterValue, reason, operator], (err) => {
        if (err) {
          db.run('ROLLBACK');
          logException('manual_correction', { cardId, correctionType, beforeValue, afterValue, reason }, err.message, 'DB_ERROR', 'TRANSACTION_ROLLBACK', cardId, 'membership_card', operator);
          return reject({ error: err.message, errorCode: 'DB_ERROR' });
        }

        const updateCardSql = 'UPDATE membership_cards SET remaining_lessons = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?';
        db.run(updateCardSql, [afterValue, cardId], (err) => {
          if (err) {
            db.run('ROLLBACK');
            logException('manual_correction', { cardId, correctionType, beforeValue, afterValue, reason }, err.message, 'DB_ERROR', 'TRANSACTION_ROLLBACK', cardId, 'membership_card', operator);
            return reject({ error: err.message, errorCode: 'DB_ERROR' });
          }

          db.run('COMMIT', (err) => {
            if (err) {
              db.run('ROLLBACK');
              logException('manual_correction', { cardId, correctionType, beforeValue, afterValue, reason }, err.message, 'DB_ERROR', 'TRANSACTION_ROLLBACK', cardId, 'membership_card', operator);
              return reject({ error: err.message, errorCode: 'DB_ERROR' });
            }
            resolve({ correctionId, cardId, correctionType, beforeValue, afterValue, operator });
          });
        });
      });
    });
  });
};

const getCardCorrections = async (cardId) => {
  return new Promise((resolve, reject) => {
    const sql = 'SELECT * FROM manual_corrections WHERE membership_card_id = ? ORDER BY created_at DESC';
    db.all(sql, [cardId], (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
};

module.exports = {
  createMembershipCard,
  getMembershipCard,
  getMembershipCardsByMember,
  freezeCard,
  unfreezeCard,
  manualCorrection,
  getCardCorrections
};

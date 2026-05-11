const { v4: uuidv4 } = require('uuid');
const db = require('../database');
const utils = require('../utils');
const memberService = require('./memberService');

async function addTransaction(memberId, type, points, period, reason = null, linkedTransactionId = null, createdBy = 'system') {
  const member = await memberService.getMember(memberId);
  if (!member) {
    throw new Error('会员不存在');
  }

  if (type === 'manual_adjustment' && !reason) {
    throw new Error('人工积分调整必须提供原因');
  }

  return new Promise((resolve, reject) => {
    const id = uuidv4();
    db.run(
      `INSERT INTO transactions (id, member_id, type, points, period, reason, linked_transaction_id, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, memberId, type, points, period, reason, linkedTransactionId, createdBy],
      function(err) {
        if (err) reject(err);
        else resolve({ id, member_id: memberId, type, points, period, reason, linked_transaction_id: linkedTransactionId, created_by: createdBy });
      }
    );
  });
}

function getTransaction(transactionId) {
  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM transactions WHERE id = ?', [transactionId], (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

async function refundTransaction(transactionId, reason = null, createdBy = 'system') {
  const originalTransaction = await getTransaction(transactionId);
  if (!originalTransaction) {
    throw new Error('原交易不存在');
  }

  if (originalTransaction.type !== 'consumption') {
    throw new Error('只能对消费交易进行退款');
  }

  if (originalTransaction.status !== 'valid') {
    throw new Error('原交易状态不允许退款');
  }

  const refundPoints = -originalTransaction.points;
  const currentPeriod = utils.getPeriod();
  
  const settlement = await utils.getMemberSettlement(originalTransaction.member_id, originalTransaction.period);
  
  if (settlement && settlement.is_confirmed) {
    throw new Error('该交易所属周期已确认等级，不允许退款');
  }

  await addTransaction(
    originalTransaction.member_id,
    'refund',
    refundPoints,
    currentPeriod,
    reason || '退款',
    transactionId,
    createdBy
  );

  return new Promise((resolve, reject) => {
    db.run(
      `UPDATE transactions 
       SET status = 'refunded'
       WHERE id = ?`,
      [transactionId],
      function(err) {
        if (err) reject(err);
        else resolve({ success: true, refund_period: currentPeriod });
      }
    );
  });
}

function getMemberTransactions(memberId) {
  return new Promise((resolve, reject) => {
    db.all(
      'SELECT * FROM transactions WHERE member_id = ? ORDER BY created_at DESC',
      [memberId],
      (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      }
    );
  });
}

function getAnomalousTransactions() {
  return new Promise((resolve, reject) => {
    db.all(
      `SELECT * FROM transactions 
       WHERE (type = 'refund' 
              OR (type = 'manual_adjustment' AND points < 0)
         OR linked_transaction_id IS NOT NULL
       ORDER BY created_at DESC`,
      (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      }
    );
  });
}

module.exports = {
  addTransaction,
  getTransaction,
  refundTransaction,
  getMemberTransactions,
  getAnomalousTransactions
};

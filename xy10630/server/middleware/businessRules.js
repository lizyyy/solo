const db = require('../models/database');

const checkCardStatus = (req, res, next) => {
  const cardId = req.body.card_id || req.params.cardId;
  if (!cardId) return next();

  db.get('SELECT status FROM cards WHERE card_id = ?', [cardId], (err, card) => {
    if (err) return res.status(500).json({ success: false, message: '数据库错误' });
    if (!card) return res.status(404).json({ success: false, message: '餐卡不存在' });
    
    if (card.status === 'frozen' || card.status === 'lost') {
      return res.status(403).json({ 
        success: false, 
        message: `餐卡已${card.status === 'frozen' ? '冻结' : '挂失'}，无法操作` 
      });
    }
    next();
  });
};

const checkIdempotency = (tableName, keyField = 'idempotency_key') => {
  return (req, res, next) => {
    const idempotencyKey = req.body.idempotency_key || req.headers['x-idempotency-key'];
    if (!idempotencyKey) return next();

    db.get(`SELECT * FROM ${tableName} WHERE ${keyField} = ?`, [idempotencyKey], (err, record) => {
      if (err) return res.status(500).json({ success: false, message: '数据库错误' });
      if (record) {
        return res.status(200).json({ 
          success: true, 
          message: '重复请求，已幂等返回',
          idempotent: true,
          data: record 
        });
      }
      req.idempotencyKey = idempotencyKey;
      next();
    });
  };
};

const detectDuplicateTransaction = (req, res, next) => {
  const { card_id, amount, tx_time, device_id } = req.body;
  if (!card_id || !amount || !tx_time || !device_id) return next();

  const timeWindow = 5 * 60 * 1000;
  const txTime = new Date(tx_time).getTime();
  const startTime = new Date(txTime - timeWindow).toISOString();
  const endTime = new Date(txTime + timeWindow).toISOString();

  db.all(`SELECT * FROM offline_transactions 
    WHERE card_id = ? AND amount = ? AND device_id = ? 
    AND tx_time BETWEEN ? AND ? AND status != 'invalid'`,
    [card_id, amount, device_id, startTime, endTime],
    (err, transactions) => {
      if (err) return next();
      if (transactions.length > 0) {
        req.duplicateDetected = true;
        req.duplicateTransactions = transactions;
      }
      next();
    }
  );
};

const requireReview = (req, res, next) => {
  const { amount } = req.body;
  if (amount && amount > 500) {
    req.requiresReview = true;
  }
  next();
};

module.exports = {
  checkCardStatus,
  checkIdempotency,
  detectDuplicateTransaction,
  requireReview
};

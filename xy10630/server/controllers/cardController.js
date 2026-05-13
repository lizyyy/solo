const db = require('../models/database');
const { v4: uuidv4 } = require('uuid');

const getCards = (req, res) => {
  const { status, student_id, page = 1, pageSize = 20 } = req.query;
  let query = 'SELECT * FROM cards WHERE 1=1';
  const params = [];

  if (status) {
    query += ' AND status = ?';
    params.push(status);
  }
  if (student_id) {
    query += ' AND student_id LIKE ?';
    params.push(`%${student_id}%`);
  }

  const offset = (page - 1) * pageSize;
  query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  params.push(parseInt(pageSize), offset);

  db.all(query, params, (err, cards) => {
    if (err) return res.status(500).json({ success: false, message: err.message });
    db.get('SELECT COUNT(*) as total FROM cards', (err, result) => {
      res.json({ success: true, data: cards, total: result.total });
    });
  });
};

const getCardById = (req, res) => {
  db.get('SELECT * FROM cards WHERE card_id = ?', [req.params.id], (err, card) => {
    if (err) return res.status(500).json({ success: false, message: err.message });
    if (!card) return res.status(404).json({ success: false, message: '餐卡不存在' });
    res.json({ success: true, data: card });
  });
};

const createCard = (req, res) => {
  const { card_id, student_id, student_name, balance = 0 } = req.body;
  const id = card_id || uuidv4();
  
  db.run(`INSERT INTO cards (card_id, student_id, student_name, balance) 
    VALUES (?, ?, ?, ?)`,
    [id, student_id, student_name, balance],
    function(err) {
      if (err) return res.status(500).json({ success: false, message: err.message });
      res.status(201).json({ success: true, data: { card_id: id, student_id, student_name, balance } });
    }
  );
};

const freezeCard = (req, res) => {
  const { card_id, reason, operator } = req.body;
  
  db.get('SELECT status FROM cards WHERE card_id = ?', [card_id], (err, card) => {
    if (err) return res.status(500).json({ success: false, message: err.message });
    if (!card) return res.status(404).json({ success: false, message: '餐卡不存在' });
    
    const beforeStatus = card.status;
    const afterStatus = 'frozen';

    db.run('UPDATE cards SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE card_id = ?',
      [afterStatus, card_id],
      function(err) {
        if (err) return res.status(500).json({ success: false, message: err.message });
        
        const logId = uuidv4();
        db.run(`INSERT INTO freeze_logs 
          (log_id, card_id, operation_type, reason, operator, before_status, after_status)
          VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [logId, card_id, 'freeze', reason, operator, beforeStatus, afterStatus],
          (err) => {
            if (err) console.error('冻结日志写入失败:', err);
            res.json({ success: true, message: '冻结成功', data: { card_id, status: afterStatus } });
          }
        );
      }
    );
  });
};

const unfreezeCard = (req, res) => {
  const { card_id, reason, operator } = req.body;
  
  db.get('SELECT status FROM cards WHERE card_id = ?', [card_id], (err, card) => {
    if (err) return res.status(500).json({ success: false, message: err.message });
    if (!card) return res.status(404).json({ success: false, message: '餐卡不存在' });
    
    const beforeStatus = card.status;
    const afterStatus = 'normal';

    db.run('UPDATE cards SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE card_id = ?',
      [afterStatus, card_id],
      function(err) {
        if (err) return res.status(500).json({ success: false, message: err.message });
        
        const logId = uuidv4();
        db.run(`INSERT INTO freeze_logs 
          (log_id, card_id, operation_type, reason, operator, before_status, after_status)
          VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [logId, card_id, 'unfreeze', reason, operator, beforeStatus, afterStatus],
          (err) => {
            if (err) console.error('解冻日志写入失败:', err);
            res.json({ success: true, message: '解冻成功', data: { card_id, status: afterStatus } });
          }
        );
      }
    );
  });
};

const reportLost = (req, res) => {
  const { card_id, reason, operator } = req.body;
  
  db.get('SELECT status FROM cards WHERE card_id = ?', [card_id], (err, card) => {
    if (err) return res.status(500).json({ success: false, message: err.message });
    if (!card) return res.status(404).json({ success: false, message: '餐卡不存在' });
    
    const beforeStatus = card.status;
    const afterStatus = 'lost';

    db.run('UPDATE cards SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE card_id = ?',
      [afterStatus, card_id],
      function(err) {
        if (err) return res.status(500).json({ success: false, message: err.message });
        
        const logId = uuidv4();
        db.run(`INSERT INTO freeze_logs 
          (log_id, card_id, operation_type, reason, operator, before_status, after_status)
          VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [logId, card_id, 'lost', reason, operator, beforeStatus, afterStatus],
          (err) => {
            if (err) console.error('挂失日志写入失败:', err);
            res.json({ success: true, message: '挂失成功', data: { card_id, status: afterStatus } });
          }
        );
      }
    );
  });
};

module.exports = {
  getCards,
  getCardById,
  createCard,
  freezeCard,
  unfreezeCard,
  reportLost
};

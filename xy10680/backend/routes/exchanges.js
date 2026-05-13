const express = require('express');
const router = express.Router();
const db = require('../database');
const { checkIdempotency } = require('../middleware/idempotency');
const { addTimelineEvent } = require('../utils/timeline');
const { v4: uuidv4 } = require('uuid');

router.get('/', (req, res) => {
  const { status } = req.query;
  let query = `
    SELECT er.*, e.name as employee_name, e.employee_id
    FROM exchange_requests er
    JOIN employees e ON er.employee_id = e.id
  `;
  const params = [];
  
  if (status) {
    query += ' WHERE er.status = ?';
    params.push(status);
  }
  
  query += ' ORDER BY er.created_at DESC';
  
  db.all(query, params, (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

router.post('/', checkIdempotency('exchange'), (req, res) => {
  const { employee_id, old_size, new_size, reason } = req.body;
  const request_id = `EXC-${Date.now()}`;
  
  db.get('SELECT quantity FROM inventory WHERE size = ?', [new_size], (err, row) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    
    if (!row || row.quantity < 1) {
      db.run(
        'INSERT INTO exchange_requests (request_id, employee_id, old_size, new_size, reason, status, failure_reason) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [request_id, employee_id, old_size, new_size, reason, 'failed', `库存不足: 尺码 ${new_size} 无库存`],
        async function(err) {
          await addTimelineEvent('exchange', req.body, 'failed', `换码申请被拦截: 库存不足`);
          res.status(400).json({ error: `库存不足: 尺码 ${new_size} 无库存`, request_id });
        }
      );
      return;
    }
    
    db.run(
      'INSERT INTO exchange_requests (request_id, employee_id, old_size, new_size, reason, status) VALUES (?, ?, ?, ?, ?, ?)',
      [request_id, employee_id, old_size, new_size, reason, 'pending'],
      async function(err) {
        if (err) {
          await addTimelineEvent('exchange', req.body, 'failed', `换码申请创建失败: ${err.message}`);
          res.status(500).json({ error: err.message });
          return;
        }
        
        await addTimelineEvent('exchange', { request_id, ...req.body }, 'success', `换码申请创建成功: ${request_id}`);
        res.json({ request_id, employee_id, old_size, new_size, reason, status: 'pending' });
      }
    );
  });
});

router.put('/:request_id/approve', (req, res) => {
  const { request_id } = req.params;
  
  db.serialize(() => {
    db.get('SELECT * FROM exchange_requests WHERE request_id = ?', [request_id], (err, request) => {
      if (err || !request) {
        res.status(404).json({ error: '申请不存在' });
        return;
      }
      
      if (request.status !== 'pending') {
        addTimelineEvent('exchange_approve', { request_id }, 'blocked', `申请状态异常: ${request.status}`);
        res.status(400).json({ error: `申请状态异常: ${request.status}` });
        return;
      }
      
      db.run('BEGIN TRANSACTION');
      
      db.run(
        'UPDATE inventory SET quantity = quantity + 1, updated_at = CURRENT_TIMESTAMP WHERE size = ?',
        [request.old_size],
        (err) => {
          if (err) {
            db.run('ROLLBACK');
            res.status(500).json({ error: err.message });
            return;
          }
        }
      );
      
      db.run(
        'UPDATE inventory SET quantity = quantity - 1, updated_at = CURRENT_TIMESTAMP WHERE size = ?',
        [request.new_size],
        (err) => {
          if (err) {
            db.run('ROLLBACK');
            res.status(500).json({ error: err.message });
            return;
          }
        }
      );
      
      db.run(
        'UPDATE exchange_requests SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE request_id = ?',
        ['approved', request_id],
        async function(err) {
          if (err) {
            db.run('ROLLBACK');
            await addTimelineEvent('exchange_approve', { request_id }, 'failed', `审批失败: ${err.message}`);
            res.status(500).json({ error: err.message });
            return;
          }
          
          db.run(
            'UPDATE employees SET size = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            [request.new_size, request.employee_id],
            async function(err) {
              if (err) {
                db.run('ROLLBACK');
                res.status(500).json({ error: err.message });
                return;
              }
              
              db.run('COMMIT');
              await addTimelineEvent('exchange_approve', { request_id }, 'success', `换码申请审批通过: ${request_id}`);
              res.json({ approved: true, request_id });
            }
          );
        }
      );
    });
  });
});

router.put('/:request_id/reject', (req, res) => {
  const { request_id } = req.params;
  const { reason } = req.body;
  
  db.run(
    'UPDATE exchange_requests SET status = ?, failure_reason = ?, updated_at = CURRENT_TIMESTAMP WHERE request_id = ?',
    ['rejected', reason, request_id],
    async function(err) {
      if (err) {
        await addTimelineEvent('exchange_reject', { request_id }, 'failed', `拒绝失败: ${err.message}`);
        res.status(500).json({ error: err.message });
        return;
      }
      
      await addTimelineEvent('exchange_reject', { request_id }, 'success', `换码申请已拒绝: ${request_id}`);
      res.json({ rejected: true, request_id });
    }
  );
});

module.exports = router;
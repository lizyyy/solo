const express = require('express');
const router = express.Router();
const db = require('../database');
const { checkIdempotency } = require('../middleware/idempotency');
const { addTimelineEvent } = require('../utils/timeline');
const { v4: uuidv4 } = require('uuid');

router.get('/', (req, res) => {
  const { status, is_exception } = req.query;
  let query = `
    SELECT r.*, e.name as employee_name, e.employee_id
    FROM recoveries r
    JOIN employees e ON r.employee_id = e.id
  `;
  const params = [];
  const conditions = [];
  
  if (status) {
    conditions.push('r.status = ?');
    params.push(status);
  }
  if (is_exception !== undefined) {
    conditions.push('r.is_exception = ?');
    params.push(is_exception ? 1 : 0);
  }
  
  if (conditions.length > 0) {
    query += ' WHERE ' + conditions.join(' AND ');
  }
  
  query += ' ORDER BY r.created_at DESC';
  
  db.all(query, params, (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

router.post('/', checkIdempotency('recovery'), (req, res) => {
  const { employee_id, size, quantity, recovery_date, is_exception, exception_reason } = req.body;
  const recovery_id = `REC-${Date.now()}`;
  
  db.get('SELECT status FROM employees WHERE id = ?', [employee_id], (err, employee) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    
    if (!employee) {
      res.status(404).json({ error: '员工不存在' });
      return;
    }
    
    if (employee.status !== 'inactive' && is_exception) {
      db.run(
        'INSERT INTO recoveries (recovery_id, employee_id, size, quantity, recovery_date, status, is_exception, exception_reason) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [recovery_id, employee_id, size, quantity || 1, recovery_date, 'pending', 1, exception_reason || '主动回收但员工在职'],
        async function(err) {
          await addTimelineEvent('recovery', req.body, 'manual', `离职回收异常: 需要人工复核 - ${recovery_id}`);
          res.json({ recovery_id, status: 'pending', is_exception: true, message: '异常回收，待人工复核' });
        }
      );
      return;
    }
    
    db.run(
      'INSERT INTO recoveries (recovery_id, employee_id, size, quantity, recovery_date, status) VALUES (?, ?, ?, ?, ?, ?)',
      [recovery_id, employee_id, size, quantity || 1, recovery_date, 'pending'],
      async function(err) {
        if (err) {
          await addTimelineEvent('recovery', req.body, 'failed', `回收创建失败: ${err.message}`);
          res.status(500).json({ error: err.message });
          return;
        }
        
        await addTimelineEvent('recovery', { recovery_id, ...req.body }, 'success', `回收记录创建成功: ${recovery_id}`);
        res.json({ recovery_id, employee_id, size, quantity, status: 'pending' });
      }
    );
  });
});

router.put('/:recovery_id/confirm', (req, res) => {
  const { recovery_id } = req.params;
  
  db.serialize(() => {
    db.get('SELECT * FROM recoveries WHERE recovery_id = ?', [recovery_id], (err, recovery) => {
      if (err || !recovery) {
        res.status(404).json({ error: '回收记录不存在' });
        return;
      }
      
      if (recovery.status !== 'pending') {
        addTimelineEvent('recovery_confirm', { recovery_id }, 'blocked', `回收状态异常: ${recovery.status}`);
        res.status(400).json({ error: `回收状态异常: ${recovery.status}` });
        return;
      }
      
      db.run('BEGIN TRANSACTION');
      
      db.run(
        'UPDATE inventory SET quantity = quantity + ?, updated_at = CURRENT_TIMESTAMP WHERE size = ?',
        [recovery.quantity, recovery.size],
        (err) => {
          if (err) {
            db.run('ROLLBACK');
            res.status(500).json({ error: err.message });
            return;
          }
        }
      );
      
      db.run(
        'UPDATE recoveries SET status = ? WHERE recovery_id = ?',
        ['completed', recovery_id],
        async function(err) {
          if (err) {
            db.run('ROLLBACK');
            await addTimelineEvent('recovery_confirm', { recovery_id }, 'failed', `回收确认失败: ${err.message}`);
            res.status(500).json({ error: err.message });
            return;
          }
          
          db.run('COMMIT');
          await addTimelineEvent('recovery_confirm', { recovery_id }, 'success', `回收确认完成: ${recovery_id}`);
          res.json({ confirmed: true, recovery_id });
        }
      );
    });
  });
});

router.put('/:recovery_id/review', (req, res) => {
  const { recovery_id } = req.params;
  const { reviewed_by, review_notes, approve } = req.body;
  
  db.run(
    'UPDATE recoveries SET status = ?, reviewed_by = ?, exception_reason = COALESCE(exception_reason, ?) WHERE recovery_id = ?',
    [approve ? 'completed' : 'rejected', reviewed_by, review_notes, recovery_id],
    async function(err) {
      if (err) {
        await addTimelineEvent('recovery_review', { recovery_id }, 'failed', `人工复核失败: ${err.message}`);
        res.status(500).json({ error: err.message });
        return;
      }
      
      await addTimelineEvent('recovery_review', { recovery_id, approve }, 'manual', 
        `异常回收人工复核${approve ? '通过' : '拒绝'}: ${recovery_id}`);
      res.json({ reviewed: true, recovery_id, status: approve ? 'completed' : 'rejected' });
    }
  );
});

module.exports = router;
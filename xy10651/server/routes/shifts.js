const express = require('express');
const router = express.Router();
const db = require('../database/db');
const { logAudit } = require('../middleware/audit');
const { preventDuplicateCallback } = require('../utils/validation');

router.get('/', (req, res) => {
  db.all(`
    SELECT sc.*, f.name as from_staff_name, t.name as to_staff_name, a.name as approver_name
    FROM shift_changes sc
    LEFT JOIN staff f ON sc.from_staff_id = f.id
    LEFT JOIN staff t ON sc.to_staff_id = t.id
    LEFT JOIN staff a ON sc.approved_by = a.id
    ORDER BY sc.change_time DESC
  `, (err, rows) => {
    if (err) res.status(500).json({ error: err.message });
    else res.json(rows);
  });
});

router.post('/', (req, res) => {
  const { cleaning_id, from_staff_id, to_staff_id, reason } = req.body;
  
  db.run(
    `INSERT INTO shift_changes (cleaning_id, from_staff_id, to_staff_id, reason) VALUES (?, ?, ?, ?)`,
    [cleaning_id, from_staff_id, to_staff_id, reason],
    async function(err) {
      if (err) return res.status(500).json({ error: err.message });
      
      await logAudit('shift_changes', this.lastID, 'create', null, req.body, 1);
      res.json({ id: this.lastID, message: '换班申请已创建' });
    }
  );
});

router.post('/:id/approve', (req, res) => {
  const { approved_by } = req.body;
  
  db.get('SELECT * FROM shift_changes WHERE id = ?', [req.params.id], async (err, shift) => {
    if (err) return res.status(500).json({ error: err.message });
    
    db.run(
      `UPDATE shift_changes SET status = 'approved', approved_by = ? WHERE id = ?`,
      [approved_by, req.params.id],
      async function(updateErr) {
        if (updateErr) return res.status(500).json({ error: updateErr.message });
        
        if (shift.cleaning_id) {
          db.run(
            `UPDATE cleaning_schedules SET assigned_staff_id = ? WHERE id = ?`,
            [shift.to_staff_id, shift.cleaning_id],
            (cleanErr) => {
              if (cleanErr) console.error('更新清洁任务人员失败:', cleanErr);
            }
          );
        }
        
        await logAudit('shift_changes', req.params.id, 'approve', 
          { status: shift.status }, 
          { status: 'approved', approved_by }, 
          1
        );
        
        res.json({ message: '换班已批准' });
      }
    );
  });
});

router.post('/:id/reject', (req, res) => {
  const { approved_by, reason } = req.body;
  
  db.get('SELECT * FROM shift_changes WHERE id = ?', [req.params.id], async (err, shift) => {
    if (err) return res.status(500).json({ error: err.message });
    
    db.run(
      `UPDATE shift_changes SET status = 'rejected', approved_by = ? WHERE id = ?`,
      [approved_by, req.params.id],
      async function(updateErr) {
        if (updateErr) return res.status(500).json({ error: updateErr.message });
        
        await logAudit('shift_changes', req.params.id, 'reject', 
          { status: shift.status }, 
          { status: 'rejected', approved_by, reject_reason: reason }, 
          1
        );
        
        res.json({ message: '换班已拒绝' });
      }
    );
  });
});

router.post('/:id/callback', async (req, res) => {
  const currentTime = Date.now();
  
  const result = await preventDuplicateCallback(req.params.id, currentTime);
  
  if (!result.allowed) {
    return res.status(429).json({ 
      error: '回调过于频繁，请稍后再试', 
      callback_count: result.count 
    });
  }
  
  db.get('SELECT * FROM shift_changes WHERE id = ?', [req.params.id], async (err, shift) => {
    if (err) return res.status(500).json({ error: err.message });
    
    db.run(
      `UPDATE shift_changes SET callback_count = callback_count + 1, last_callback_time = CURRENT_TIMESTAMP WHERE id = ?`,
      [req.params.id],
      async function(updateErr) {
        if (updateErr) return res.status(500).json({ error: updateErr.message });
        
        await logAudit('shift_changes', req.params.id, 'callback', 
          { callback_count: shift.callback_count }, 
          { callback_count: shift.callback_count + 1, last_callback_time: new Date().toISOString() }, 
          1
        );
        
        res.json({ 
          message: '回调成功', 
          callback_count: shift.callback_count + 1,
          deduplicated: result.count > 0
        });
      }
    );
  });
});

module.exports = router;

const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { generateId, addTimeLine, addAuditLog } = require('../utils/helpers');
const rulesEngine = require('../services/rulesEngine');

router.get('/', (req, res) => {
  const sql = `SELECT s.*, c.name as substitute_name, s2.date, s2.shift_type 
                FROM substitute_records s
                LEFT JOIN caregivers c ON s.substitute_caregiver_id = c.id
                LEFT JOIN schedules s2 ON s.original_schedule_id = s2.id
                ORDER BY s.created_at DESC`;
  db.all(sql, (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
    } else {
      res.json(rows);
    }
  });
});

router.post('/', async (req, res) => {
  const { original_schedule_id, substitute_caregiver_id, leave_id, remarks } = req.body;
  const id = generateId();

  const validation = await rulesEngine.validateSubstitute(original_schedule_id, substitute_caregiver_id);
  
  if (!validation.valid) {
    return res.status(400).json({ error: '替代验证失败', errors: validation.errors, warnings: validation.warnings });
  }

  const sql = `INSERT INTO substitute_records (id, original_schedule_id, substitute_caregiver_id, leave_id, status, remarks)
                VALUES (?, ?, ?, ?, ?, ?)`;
  db.run(sql, [id, original_schedule_id, substitute_caregiver_id, leave_id, 'pending', remarks], async function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
    } else {
      await addTimeLine('substitute', id, 'create', `创建替代记录`);
      await addAuditLog('substitute_records', id, 'insert', null, { original_schedule_id, substitute_caregiver_id });
      res.json({ id, original_schedule_id, substitute_caregiver_id });
    }
  });
});

router.put('/:id/approve', (req, res) => {
  const { approved_by } = req.body;
  
  db.get('SELECT * FROM substitute_records WHERE id = ?', [req.params.id], async (err, oldRow) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    if (!oldRow) {
      res.status(404).json({ error: '替代记录不存在' });
      return;
    }

    db.serialize(() => {
      db.run('BEGIN TRANSACTION');
      
      db.run(`UPDATE substitute_records SET status = 'approved', approved_by = ?, approved_at = CURRENT_TIMESTAMP WHERE id = ?`, 
        [approved_by, req.params.id]);
      
      db.run(`UPDATE schedules SET caregiver_id = ? WHERE id = ?`,
        [oldRow.substitute_caregiver_id, oldRow.original_schedule_id]);
      
      db.run('COMMIT', async (err) => {
        if (err) {
          db.run('ROLLBACK');
          res.status(500).json({ error: err.message });
        } else {
          await addTimeLine('substitute', req.params.id, 'approve', `替代已批准并更新排班`);
          await addAuditLog('substitute_records', req.params.id, 'update', oldRow, { status: 'approved', approved_by });
          res.json({ success: true });
        }
      });
    });
  });
});

module.exports = router;
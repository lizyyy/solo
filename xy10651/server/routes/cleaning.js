const express = require('express');
const router = express.Router();
const db = require('../database/db');
const { logAudit } = require('../middleware/audit');
const { validateSkillMatch } = require('../utils/validation');

router.get('/', (req, res) => {
  db.all(`
    SELECT cs.*, s.movie_name, h.name as hall_name, st.name as staff_name
    FROM cleaning_schedules cs
    LEFT JOIN screenings s ON cs.screening_id = s.id
    LEFT JOIN halls h ON cs.hall_id = h.id
    LEFT JOIN staff st ON cs.assigned_staff_id = st.id
    ORDER BY cs.scheduled_time DESC
  `, (err, rows) => {
    if (err) res.status(500).json({ error: err.message });
    else res.json(rows);
  });
});

router.get('/:id', (req, res) => {
  db.get(`
    SELECT cs.*, s.movie_name, h.name as hall_name, st.name as staff_name
    FROM cleaning_schedules cs
    LEFT JOIN screenings s ON cs.screening_id = s.id
    LEFT JOIN halls h ON cs.hall_id = h.id
    LEFT JOIN staff st ON cs.assigned_staff_id = st.id
    WHERE cs.id = ?
  `, [req.params.id], (err, row) => {
    if (err) res.status(500).json({ error: err.message });
    else res.json(row);
  });
});

router.post('/:id/assign', (req, res) => {
  const { staff_id } = req.body;
  
  db.get('SELECT * FROM cleaning_schedules WHERE id = ?', [req.params.id], async (err, cleaning) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!cleaning) return res.status(404).json({ error: '清洁任务不存在' });

    db.get('SELECT * FROM staff WHERE id = ?', [staff_id], async (staffErr, staff) => {
      if (staffErr) return res.status(500).json({ error: staffErr.message });
      if (!staff) return res.status(404).json({ error: '员工不存在' });

      const requiredSkills = '清洁,巡检';
      if (!validateSkillMatch(staff.skills, requiredSkills)) {
        return res.status(400).json({ error: '员工技能不匹配，无法分配' });
      }

      const oldValues = { assigned_staff_id: cleaning.assigned_staff_id };
      const newValues = { assigned_staff_id: staff_id };

      db.run(
        `UPDATE cleaning_schedules SET assigned_staff_id = ?, old_values = ?, new_values = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [staff_id, JSON.stringify(oldValues), JSON.stringify(newValues), req.params.id],
        async function(updateErr) {
          if (updateErr) return res.status(500).json({ error: updateErr.message });
          
          await logAudit('cleaning_schedules', req.params.id, 'assign', oldValues, newValues, 1);
          res.json({ message: '人员分配成功' });
        }
      );
    });
  });
});

router.post('/:id/start', (req, res) => {
  db.get('SELECT * FROM cleaning_schedules WHERE id = ?', [req.params.id], async (err, cleaning) => {
    if (err) return res.status(500).json({ error: err.message });
    
    db.run(
      `UPDATE cleaning_schedules SET status = 'in_progress', actual_start_time = CURRENT_TIMESTAMP WHERE id = ?`,
      [req.params.id],
      async function(updateErr) {
        if (updateErr) return res.status(500).json({ error: updateErr.message });
        
        await logAudit('cleaning_schedules', req.params.id, 'start', { status: cleaning.status }, { status: 'in_progress' }, 1);
        res.json({ message: '清洁开始' });
      }
    );
  });
});

router.post('/:id/complete', (req, res) => {
  const { quality_score, notes } = req.body;
  
  db.get('SELECT * FROM cleaning_schedules WHERE id = ?', [req.params.id], async (err, cleaning) => {
    if (err) return res.status(500).json({ error: err.message });
    
    db.run(
      `UPDATE cleaning_schedules SET status = 'completed', actual_end_time = CURRENT_TIMESTAMP, quality_score = ?, notes = ? WHERE id = ?`,
      [quality_score, notes, req.params.id],
      async function(updateErr) {
        if (updateErr) return res.status(500).json({ error: updateErr.message });
        
        await logAudit('cleaning_schedules', req.params.id, 'complete', 
          { status: cleaning.status }, 
          { status: 'completed', quality_score, notes }, 
          1
        );
        
        const inspectionItems = JSON.stringify([
          { name: '座椅清洁', status: 'pending' },
          { name: '地面卫生', status: 'pending' },
          { name: '卫生间检查', status: 'pending' },
          { name: '设备检查', status: 'pending' }
        ]);
        
        db.run(
          `INSERT INTO equipment_inspections (hall_id, cleaning_id, items, status) VALUES (?, ?, ?, 'pending')`,
          [cleaning.hall_id, req.params.id, inspectionItems],
          function(inspectErr) {
            if (inspectErr) console.error('创建设备巡检失败:', inspectErr);
          }
        );
        
        res.json({ message: '清洁完成，设备巡检已创建' });
      }
    );
  });
});

router.post('/:id/review', (req, res) => {
  const { approved, reviewer_notes } = req.body;
  
  db.get('SELECT * FROM cleaning_schedules WHERE id = ?', [req.params.id], async (err, cleaning) => {
    if (err) return res.status(500).json({ error: err.message });
    
    const newStatus = approved ? 'reviewed' : 'rejected';
    
    db.run(
      `UPDATE cleaning_schedules SET status = ? WHERE id = ?`,
      [newStatus, req.params.id],
      async function(updateErr) {
        if (updateErr) return res.status(500).json({ error: updateErr.message });
        
        await logAudit('cleaning_schedules', req.params.id, 'review', 
          { status: cleaning.status }, 
          { status: newStatus, reviewer_notes }, 
          1
        );
        
        res.json({ message: approved ? '复核通过' : '已驳回，需要重新清洁' });
      }
    );
  });
});

module.exports = router;

const express = require('express');
const router = express.Router();
const db = require('../database/db');
const { logAudit } = require('../middleware/audit');

router.get('/', (req, res) => {
  db.all(`
    SELECT s.*, h.name as hall_name 
    FROM screenings s 
    JOIN halls h ON s.hall_id = h.id 
    ORDER BY s.start_time DESC
  `, (err, rows) => {
    if (err) res.status(500).json({ error: err.message });
    else res.json(rows);
  });
});

router.get('/:id', (req, res) => {
  db.get(`
    SELECT s.*, h.name as hall_name 
    FROM screenings s 
    JOIN halls h ON s.hall_id = h.id 
    WHERE s.id = ?
  `, [req.params.id], (err, row) => {
    if (err) res.status(500).json({ error: err.message });
    else res.json(row);
  });
});

router.post('/', (req, res) => {
  const { hall_id, movie_name, start_time, end_time } = req.body;
  db.run(
    `INSERT INTO screenings (hall_id, movie_name, start_time, end_time) VALUES (?, ?, ?, ?)`,
    [hall_id, movie_name, start_time, end_time],
    async function(err) {
      if (err) res.status(500).json({ error: err.message });
      else {
        await logAudit('screenings', this.lastID, 'create', null, req.body, 1);
        res.json({ id: this.lastID, message: '排片创建成功' });
      }
    }
  );
});

router.put('/:id', (req, res) => {
  db.get('SELECT * FROM screenings WHERE id = ?', [req.params.id], async (err, oldRow) => {
    if (err) return res.status(500).json({ error: err.message });
    
    const { hall_id, movie_name, start_time, end_time, status } = req.body;
    db.run(
      `UPDATE screenings SET hall_id = ?, movie_name = ?, start_time = ?, end_time = ?, status = ? WHERE id = ?`,
      [hall_id, movie_name, start_time, end_time, status, req.params.id],
      async function(err) {
        if (err) res.status(500).json({ error: err.message });
        else {
          await logAudit('screenings', req.params.id, 'update', oldRow, req.body, 1);
          res.json({ message: '排片更新成功' });
        }
      }
    );
  });
});

router.post('/:id/start', (req, res) => {
  db.get('SELECT * FROM screenings WHERE id = ?', [req.params.id], async (err, oldRow) => {
    if (err) return res.status(500).json({ error: err.message });
    
    db.run(
      `UPDATE screenings SET status = 'playing' WHERE id = ?`,
      [req.params.id],
      async function(err) {
        if (err) res.status(500).json({ error: err.message });
        else {
          await logAudit('screenings', req.params.id, 'status_change', oldRow, { status: 'playing' }, 1);
          res.json({ message: '放映开始' });
        }
      }
    );
  });
});

router.post('/:id/end', (req, res) => {
  db.get('SELECT * FROM screenings WHERE id = ?', [req.params.id], async (err, oldRow) => {
    if (err) return res.status(500).json({ error: err.message });
    
    db.run(
      `UPDATE screenings SET status = 'ended' WHERE id = ?`,
      [req.params.id],
      async function(err) {
        if (err) res.status(500).json({ error: err.message });
        else {
          await logAudit('screenings', req.params.id, 'status_change', oldRow, { status: 'ended' }, 1);
          
          const scheduledTime = new Date(oldRow.end_time);
          scheduledTime.setMinutes(scheduledTime.getMinutes() + 5);
          
          db.run(
            `INSERT INTO cleaning_schedules (screening_id, hall_id, scheduled_time, status) VALUES (?, ?, ?, 'pending')`,
            [req.params.id, oldRow.hall_id, scheduledTime.toISOString()],
            function(cleanErr) {
              if (cleanErr) console.error('创建清洁任务失败:', cleanErr);
            }
          );
          
          res.json({ message: '放映结束，清洁任务已创建' });
        }
      }
    );
  });
});

module.exports = router;

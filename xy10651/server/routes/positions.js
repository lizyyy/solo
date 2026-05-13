const express = require('express');
const router = express.Router();
const db = require('../database/db');
const { logAudit } = require('../middleware/audit');

router.get('/', (req, res) => {
  db.all('SELECT * FROM positions ORDER BY name', (err, rows) => {
    if (err) res.status(500).json({ error: err.message });
    else res.json(rows);
  });
});

router.post('/', (req, res) => {
  const { name, description, required_skills } = req.body;
  db.run(
    `INSERT INTO positions (name, description, required_skills) VALUES (?, ?, ?)`,
    [name, description, required_skills],
    async function(err) {
      if (err) res.status(500).json({ error: err.message });
      else {
        await logAudit('positions', this.lastID, 'create', null, req.body, 1);
        res.json({ id: this.lastID, message: '岗位创建成功' });
      }
    }
  );
});

router.get('/uncovered', (req, res) => {
  db.all(`
    SELECT up.*, h.name as hall_name, s.movie_name, p.name as position_name, st.name as resolver_name
    FROM uncovered_positions up
    LEFT JOIN halls h ON up.hall_id = h.id
    LEFT JOIN screenings s ON up.screening_id = s.id
    LEFT JOIN positions p ON up.position_id = p.id
    LEFT JOIN staff st ON up.resolved_by = st.id
    ORDER BY up.detected_time DESC
  `, (err, rows) => {
    if (err) res.status(500).json({ error: err.message });
    else res.json(rows);
  });
});

router.post('/uncovered/:id/resolve', (req, res) => {
  const { resolved_by, notes } = req.body;
  
  db.get('SELECT * FROM uncovered_positions WHERE id = ?', [req.params.id], async (err, position) => {
    if (err) return res.status(500).json({ error: err.message });
    
    db.run(
      `UPDATE uncovered_positions SET resolved = 1, resolved_by = ?, resolved_at = CURRENT_TIMESTAMP, notes = COALESCE(?, notes) WHERE id = ?`,
      [resolved_by, notes, req.params.id],
      async function(updateErr) {
        if (updateErr) return res.status(500).json({ error: updateErr.message });
        
        await logAudit('uncovered_positions', req.params.id, 'resolve', 
          { resolved: position.resolved }, 
          { resolved: 1, resolved_by, resolved_at: new Date().toISOString() }, 
          1
        );
        
        res.json({ message: '岗位已覆盖' });
      }
    );
  });
});

module.exports = router;

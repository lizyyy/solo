const express = require('express');
const router = express.Router();

function getAsync(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

function allAsync(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

router.get('/', async (req, res) => {
  try {
    const { status } = req.query;
    let whereClause = '';
    let params = [];
    
    if (status) {
      whereClause = 'WHERE a.status = ?';
      params.push(status);
    }
    
    const anomalies = await allAsync(req.db, `
      SELECT a.*, 
        s.name as student_name,
        ls.title as session_title,
        c.name as class_name
      FROM permission_anomalies a
      LEFT JOIN students s ON a.student_id = s.id
      LEFT JOIN live_sessions ls ON a.session_id = ls.id
      LEFT JOIN classes c ON a.class_id = c.id
      ${whereClause}
      ORDER BY a.detected_at DESC
    `, params);
    res.json(anomalies);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/detect', async (req, res) => {
  try {
    const anomalies = await req.permissionService.detectAnomalies();
    res.json({ detected: anomalies.length, anomalies });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/:id/resolve', async (req, res) => {
  try {
    const { resolver, notes } = req.body;
    await req.permissionService.resolveAnomaly(req.params.id, resolver, notes);
    
    const resolved = await getAsync(req.db, 'SELECT * FROM permission_anomalies WHERE id = ?', [req.params.id]);
    res.json(resolved);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;

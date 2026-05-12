const express = require('express');
const router = express.Router();

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
    const { student_id, session_id, limit = 100 } = req.query;
    let whereClause = 'WHERE 1=1';
    let params = [];
    
    if (student_id) {
      whereClause += ' AND l.student_id = ?';
      params.push(student_id);
    }
    if (session_id) {
      whereClause += ' AND l.session_id = ?';
      params.push(session_id);
    }
    
    const logs = await allAsync(req.db, `
      SELECT l.*, 
        s.name as student_name,
        ls.title as session_title
      FROM access_logs l
      LEFT JOIN students s ON l.student_id = s.id
      LEFT JOIN live_sessions ls ON l.session_id = ls.id
      ${whereClause}
      ORDER BY l.access_time DESC
      LIMIT ?
    `, [...params, parseInt(limit)]);
    res.json(logs);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;

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
    const { entity_type, entity_id, student_id, limit = 200 } = req.query;
    let whereClause = 'WHERE 1=1';
    let params = [];
    
    if (student_id) {
      whereClause += ` AND (
        entity_id = ? 
        OR entity_id IN (SELECT id FROM class_enrollments WHERE student_id = ?)
      )`;
      params.push(student_id, student_id);
    } else if (entity_type) {
      whereClause += ' AND event_type = ?';
      params.push(entity_type);
    } else if (entity_id) {
      whereClause += ' AND entity_id = ?';
      params.push(entity_id);
    }
    
    const events = await allAsync(req.db, `
      SELECT e.*
      FROM business_events e
      ${whereClause}
      ORDER BY e.created_at DESC
      LIMIT ?
    `, [...params, parseInt(limit)]);
    res.json(events);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;

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
    const { student_id, session_id, class_id } = req.query;
    let whereClause = 'WHERE 1=1';
    let params = [];
    
    if (student_id) {
      whereClause += ' AND p.student_id = ?';
      params.push(student_id);
    }
    if (session_id) {
      whereClause += ' AND p.session_id = ?';
      params.push(session_id);
    }
    if (class_id) {
      whereClause += ' AND p.class_id = ?';
      params.push(class_id);
    }
    
    const permissions = await allAsync(req.db, `
      SELECT p.*, 
        s.name as student_name,
        ls.title as session_title,
        c.name as class_name
      FROM replay_permissions p
      JOIN students s ON p.student_id = s.id
      JOIN live_sessions ls ON p.session_id = ls.id
      JOIN classes c ON p.class_id = c.id
      ${whereClause}
      ORDER BY p.granted_at DESC
    `, params);
    res.json(permissions);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/:id/revoke', async (req, res) => {
  try {
    const { reason, operator } = req.body;
    const result = await req.permissionService.revokePermission(req.params.id, reason, operator);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/check-access', async (req, res) => {
  try {
    const { student_id, account_identifier, session_id } = req.body;
    const result = await req.permissionService.checkAccess(student_id, account_identifier, session_id);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;

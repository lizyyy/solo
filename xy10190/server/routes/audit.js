const express = require('express');
const db = require('../database');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

router.get('/', requireRole('hr_admin', 'director'), async (req, res, next) => {
  try {
    const { entity_type, entity_id, action, user_id, limit = 100, offset = 0 } = req.query;
    
    let sql = `SELECT al.*, u.name as user_name 
               FROM audit_logs al 
               LEFT JOIN users u ON al.user_id = u.id 
               WHERE 1=1`;
    const params = [];

    if (entity_type) {
      sql += ` AND al.entity_type = ?`;
      params.push(entity_type);
    }
    if (entity_id) {
      sql += ` AND al.entity_id = ?`;
      params.push(entity_id);
    }
    if (action) {
      sql += ` AND al.action = ?`;
      params.push(action);
    }
    if (user_id) {
      sql += ` AND al.user_id = ?`;
      params.push(user_id);
    }

    sql += ` ORDER BY al.created_at DESC LIMIT ? OFFSET ?`;
    params.push(parseInt(limit), parseInt(offset));

    const logs = await db.all(sql, params);

    let countSql = `SELECT COUNT(*) as total FROM audit_logs WHERE 1=1`;
    const countParams = params.slice(0, -2);
    const countResult = await db.get(countSql, countParams);

    res.json({ 
      success: true, 
      logs,
      pagination: {
        total: countResult.total,
        limit: parseInt(limit),
        offset: parseInt(offset)
      }
    });
  } catch (err) {
    next(err);
  }
});

router.get('/offer/:offerId', async (req, res, next) => {
  try {
    const logs = await db.all(
      `SELECT al.*, u.name as user_name 
       FROM audit_logs al 
       LEFT JOIN users u ON al.user_id = u.id 
       WHERE al.entity_type = 'offer' AND al.entity_id = ? 
       ORDER BY al.created_at DESC`,
      [req.params.offerId]
    );
    res.json({ success: true, logs });
  } catch (err) {
    next(err);
  }
});

router.get('/candidate/:candidateId', async (req, res, next) => {
  try {
    const logs = await db.all(
      `SELECT al.*, u.name as user_name 
       FROM audit_logs al 
       LEFT JOIN users u ON al.user_id = u.id 
       WHERE al.entity_type = 'candidate' AND al.entity_id = ? 
       ORDER BY al.created_at DESC`,
      [req.params.candidateId]
    );
    res.json({ success: true, logs });
  } catch (err) {
    next(err);
  }
});

module.exports = router;

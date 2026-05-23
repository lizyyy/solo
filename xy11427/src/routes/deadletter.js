const express = require('express');
const router = express.Router();
const { getDatabase } = require('../config/database');
const { recoverFromDeadLetter } = require('../services/compensationQueue');

router.get('/', async (req, res) => {
  try {
    const db = getDatabase();
    const { status, page = 1, page_size = 20 } = req.query;
    
    let whereClause = 'WHERE 1=1';
    const params = [];
    
    if (status) {
      whereClause += ' AND status = ?';
      params.push(status);
    }
    
    const offset = (page - 1) * page_size;
    
    const records = db.prepare(`
      SELECT * FROM dead_letter_queue
      ${whereClause}
      ORDER BY moved_at DESC
      LIMIT ? OFFSET ?
    `).all(...params, page_size, offset);
    
    const total = db.prepare(`
      SELECT COUNT(*) as count FROM dead_letter_queue ${whereClause}
    `).get(...params).count;
    
    res.json({
      success: true,
      data: {
        records,
        pagination: {
          page: parseInt(page),
          page_size: parseInt(page_size),
          total,
          total_pages: Math.ceil(total / page_size)
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.post('/:dlqId/recover', async (req, res) => {
  try {
    const { operator } = req.body;
    const result = recoverFromDeadLetter(req.params.dlqId, operator || 'system');
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;

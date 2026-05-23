const express = require('express');
const router = express.Router();
const { getDatabase } = require('../config/database');
const { handleDirtyRecord } = require('../services/factService');

router.get('/', async (req, res) => {
  try {
    const db = getDatabase();
    const { status, dirty_type, page = 1, page_size = 20 } = req.query;
    
    let whereClause = 'WHERE 1=1';
    const params = [];
    
    if (status) {
      whereClause += ' AND status = ?';
      params.push(status);
    }
    if (dirty_type) {
      whereClause += ' AND dirty_type = ?';
      params.push(dirty_type);
    }
    
    const offset = (page - 1) * page_size;
    
    const records = db.prepare(`
      SELECT * FROM dirty_records
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `).all(...params, page_size, offset);
    
    const total = db.prepare(`
      SELECT COUNT(*) as count FROM dirty_records ${whereClause}
    `).get(...params).count;
    
    res.json({
      success: true,
      data: {
        records: records.map(r => ({
          ...r,
          original_data: JSON.parse(r.original_data)
        })),
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

router.get('/stats', async (req, res) => {
  try {
    const db = getDatabase();
    
    const byType = db.prepare(`
      SELECT 
        dirty_type,
        COUNT(*) as total,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN status = 'fixed' THEN 1 ELSE 0 END) as fixed,
        SUM(CASE WHEN status = 'ignored' THEN 1 ELSE 0 END) as ignored
      FROM dirty_records
      GROUP BY dirty_type
    `).all();
    
    const bySeverity = db.prepare(`
      SELECT 
        severity,
        COUNT(*) as count
      FROM dirty_records
      WHERE status = 'pending'
      GROUP BY severity
    `).all();
    
    res.json({
      success: true,
      data: {
        by_type: byType,
        by_severity: bySeverity
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.post('/:dirtyRecordId/handle', async (req, res) => {
  try {
    const { action, handler, notes } = req.body;
    
    if (!['fix', 'ignore', 'handle'].includes(action)) {
      return res.status(400).json({
        success: false,
        error: '无效的操作类型'
      });
    }
    
    const result = handleDirtyRecord(req.params.dirtyRecordId, action, handler, notes);
    
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

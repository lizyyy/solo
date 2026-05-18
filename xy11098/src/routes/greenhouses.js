const express = require('express');
const router = express.Router();
const { getDb } = require('../database/db');
const db = getDb();
const { AppError, errorCodes, asyncHandler } = require('../middleware/errorHandler');

router.get('/', asyncHandler(async (req, res) => {
  db.all('SELECT * FROM greenhouses ORDER BY created_at DESC', (err, rows) => {
    if (err) throw err;
    res.json({
      success: true,
      data: rows,
      count: rows.length
    });
  });
}));

router.get('/:id', asyncHandler(async (req, res) => {
  db.get('SELECT * FROM greenhouses WHERE id = ?', [req.params.id], (err, row) => {
    if (err) throw err;
    if (!row) {
      throw new AppError('温室不存在', 404, errorCodes.GREENHOUSE_NOT_FOUND);
    }
    res.json({
      success: true,
      data: row
    });
  });
}));

router.post('/', asyncHandler(async (req, res) => {
  const { id, name, location, area, flower_types } = req.body;
  
  if (!name || !location || !area || !flower_types) {
    throw new AppError('缺少必填字段', 400, 'MISSING_REQUIRED_FIELDS');
  }
  
  const greenhouseId = id || `GH-${Date.now()}`;
  
  db.run(`
    INSERT INTO greenhouses (id, name, location, area, flower_types)
    VALUES (?, ?, ?, ?, ?)
  `, [greenhouseId, name, location, area, flower_types], function(err) {
    if (err) throw err;
    
    db.get('SELECT * FROM greenhouses WHERE id = ?', [greenhouseId], (err, row) => {
      if (err) throw err;
      res.status(201).json({
        success: true,
        data: row,
        message: '温室创建成功'
      });
    });
  });
}));

module.exports = router;
const express = require('express');
const db = require('../database');
const batchService = require('../services/batchService');

const router = express.Router();

router.get('/operations', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const pageSize = parseInt(req.query.pageSize) || 20;
    const operationType = req.query.operation_type || null;
    
    let sql = 'SELECT * FROM operation_logs WHERE 1=1';
    const params = [];
    
    if (operationType) {
      sql += ' AND operation_type = ?';
      params.push(operationType);
    }
    
    sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(pageSize, (page - 1) * pageSize);
    
    const logs = await db.all(sql, params);
    
    const countResult = await db.get('SELECT COUNT(*) as total FROM operation_logs');
    
    res.json({
      success: true,
      data: {
        logs,
        pagination: {
          page,
          pageSize,
          total: countResult.total
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

router.get('/batches', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 20;
    
    const batches = await batchService.getBatchHistory(limit);
    
    res.json({
      success: true,
      data: batches
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/batches/:batchNo', async (req, res) => {
  try {
    const batch = await batchService.getBatchOperation(req.params.batchNo);
    
    if (!batch) {
      return res.status(404).json({
        success: false,
        error: '批量操作不存在'
      });
    }
    
    res.json({
      success: true,
      data: batch
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;

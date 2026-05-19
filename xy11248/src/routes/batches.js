const express = require('express');
const router = express.Router();
const batchService = require('../services/batchService');
const logService = require('../services/logService');
const db = require('../database');

router.get('/', async (req, res) => {
  try {
    let sql = 'SELECT * FROM batch_operations WHERE 1=1';
    const params = [];

    if (req.query.operation_type) {
      sql += ' AND operation_type = ?';
      params.push(req.query.operation_type);
    }

    if (req.query.status) {
      sql += ' AND status = ?';
      params.push(req.query.status);
    }

    sql += ' ORDER BY created_at DESC';

    const batches = await db.all(sql, params);
    res.json(batches);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const result = await batchService.getBatchResult(req.params.id);
    if (!result.batch) {
      return res.status(404).json({ error: '批量操作不存在' });
    }
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:id/logs', async (req, res) => {
  try {
    const logs = await logService.getLogsByBatch(req.params.id);
    res.json(logs);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;

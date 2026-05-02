const express = require('express');
const router = express.Router();
const AuditLog = require('../models/auditLog');

router.get('/', async (req, res) => {
  try {
    const logs = await AuditLog.getAll();
    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const log = await AuditLog.findById(parseInt(req.params.id));
    if (!log) {
      return res.status(404).json({ error: '审计日志不存在' });
    }
    res.json(log);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/operator/:operator', async (req, res) => {
  try {
    const logs = await AuditLog.getByOperator(req.params.operator);
    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/table/:tableName', async (req, res) => {
  try {
    const logs = await AuditLog.getByTableName(req.params.tableName);
    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/operation/:operationType', async (req, res) => {
  try {
    const logs = await AuditLog.getByOperationType(req.params.operationType);
    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/search', async (req, res) => {
  try {
    const { startTime, endTime, operator, tableName, operationType } = req.body;
    
    let logs = await AuditLog.getAll();
    
    if (operator) {
      logs = logs.filter(log => log.operator === operator);
    }
    if (tableName) {
      logs = logs.filter(log => log.table_name === tableName);
    }
    if (operationType) {
      logs = logs.filter(log => log.operation_type === operationType);
    }
    if (startTime) {
      const startDate = new Date(startTime);
      logs = logs.filter(log => new Date(log.operation_time) >= startDate);
    }
    if (endTime) {
      const endDate = new Date(endTime);
      logs = logs.filter(log => new Date(log.operation_time) <= endDate);
    }
    
    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

const express = require('express');
const router = express.Router();
const { idempotencyMiddleware } = require('../utils/idempotency');
const engineersService = require('../services/engineersService');
const { getAuditLogs } = require('../utils/audit');

function getOperator(req) {
  return req.headers['x-operator'] || 'system';
}

router.post('/', idempotencyMiddleware, (req, res) => {
  try {
    const { engineer_code, name, department, phone } = req.body;
    
    if (!engineer_code || !name) {
      return res.status(400).json({
        success: false,
        error: '工程师编码和姓名不能为空'
      });
    }
    
    const engineer = engineersService.createEngineer({
      engineer_code,
      name,
      department,
      phone
    }, getOperator(req));
    
    res.status(201).json({
      success: true,
      data: engineer
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/', (req, res) => {
  try {
    const { status, department } = req.query;
    const engineers = engineersService.listEngineers({ status, department });
    
    res.json({
      success: true,
      data: engineers
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/code/:code', (req, res) => {
  try {
    const engineer = engineersService.getEngineerByCode(req.params.code);
    if (!engineer) {
      return res.status(404).json({
        success: false,
        error: '工程师不存在'
      });
    }
    res.json({ success: true, data: engineer });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/:id', (req, res) => {
  try {
    const engineer = engineersService.getEngineerById(req.params.id);
    if (!engineer) {
      return res.status(404).json({
        success: false,
        error: '工程师不存在'
      });
    }
    res.json({ success: true, data: engineer });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.put('/:id', (req, res) => {
  try {
    const engineer = engineersService.updateEngineer(
      req.params.id,
      req.body,
      getOperator(req),
      req.body.reason
    );
    res.json({ success: true, data: engineer });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get('/:id/unreturned', (req, res) => {
  try {
    const loans = engineersService.getEngineerUnreturnedLoans(req.params.id);
    res.json({ success: true, data: loans });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/:id/audit', (req, res) => {
  try {
    const logs = getAuditLogs('engineer', req.params.id);
    res.json({ success: true, data: logs });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;

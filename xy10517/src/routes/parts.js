const express = require('express');
const router = express.Router();
const { idempotencyMiddleware } = require('../utils/idempotency');
const partsService = require('../services/partsService');
const { getAuditLogs } = require('../utils/audit');
const { getPartFlow } = require('../services/loanService');

function getOperator(req) {
  return req.headers['x-operator'] || 'system';
}

router.post('/', idempotencyMiddleware, (req, res) => {
  try {
    const { part_code, part_name, category, unit, price, description, initial_quantity, location, min_stock } = req.body;
    
    if (!part_code || !part_name) {
      return res.status(400).json({
        success: false,
        error: '备件编码和名称不能为空'
      });
    }
    
    const part = partsService.createPart({
      part_code,
      part_name,
      category,
      unit,
      price,
      description,
      initial_quantity,
      location,
      min_stock
    }, getOperator(req));
    
    res.status(201).json({
      success: true,
      data: part
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
    const { category, part_name } = req.query;
    const parts = partsService.listParts({ category, part_name });
    
    res.json({
      success: true,
      data: parts
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
    const part = partsService.getPartByCode(req.params.code);
    if (!part) {
      return res.status(404).json({
        success: false,
        error: '备件不存在'
      });
    }
    res.json({ success: true, data: part });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/:id', (req, res) => {
  try {
    const part = partsService.getPartById(req.params.id);
    if (!part) {
      return res.status(404).json({
        success: false,
        error: '备件不存在'
      });
    }
    res.json({ success: true, data: part });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.put('/:id', (req, res) => {
  try {
    const part = partsService.updatePart(
      req.params.id,
      req.body,
      getOperator(req),
      req.body.reason
    );
    res.json({ success: true, data: part });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.post('/:id/stock', (req, res) => {
  try {
    const { quantity_change, reason } = req.body;
    if (quantity_change === undefined) {
      return res.status(400).json({ success: false, error: '请提供数量变化' });
    }
    
    const result = partsService.updatePartStock(
      req.params.id,
      parseInt(quantity_change),
      getOperator(req),
      reason
    );
    
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get('/:id/flow', (req, res) => {
  try {
    const flow = getPartFlow(req.params.id);
    res.json({ success: true, data: flow });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/:id/audit', (req, res) => {
  try {
    const logs = getAuditLogs('part', req.params.id);
    res.json({ success: true, data: logs });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;

const express = require('express');
const router = express.Router();
const { addVisitor, getVisitor, listVisitors, VISITOR_STATUSES } = require('../models/visitor');

router.get('/', (req, res) => {
  try {
    const { status, batchId } = req.query;
    const filters = {};
    if (status) filters.status = status;
    if (batchId) filters.batchId = batchId;
    
    const visitors = listVisitors(filters);
    res.json({
      success: true,
      data: visitors.map(v => v.toJSON())
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/:id', (req, res) => {
  try {
    const visitor = getVisitor(req.params.id);
    if (!visitor) {
      return res.status(404).json({
        success: false,
        error: '访客不存在'
      });
    }
    res.json({
      success: true,
      data: visitor.toJSON()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.post('/', (req, res) => {
  try {
    const visitor = addVisitor(req.body);
    res.status(201).json({
      success: true,
      data: visitor.toJSON()
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

router.put('/:id/status', (req, res) => {
  try {
    const visitor = getVisitor(req.params.id);
    if (!visitor) {
      return res.status(404).json({
        success: false,
        error: '访客不存在'
      });
    }
    const { status, reason } = req.body;
    if (!Object.values(VISITOR_STATUSES).includes(status)) {
      return res.status(400).json({
        success: false,
        error: '无效的状态值'
      });
    }
    visitor.updateStatus(status, reason);
    res.json({
      success: true,
      data: visitor.toJSON()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;

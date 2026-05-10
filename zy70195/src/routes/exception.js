const express = require('express');
const router = express.Router();
const exceptionService = require('../services/exception-service');

router.get('/', async (req, res) => {
  try {
    const params = {
      type: req.query.type,
      severity: req.query.severity,
      status: req.query.status,
      supplier_id: req.query.supplier_id,
      limit: req.query.limit,
      offset: req.query.offset
    };
    const exceptions = await exceptionService.getExceptionList(params);
    res.json({ success: true, data: exceptions });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/pending', async (req, res) => {
  try {
    const exceptions = await exceptionService.getExceptionList({ status: 'pending' });
    res.json({ success: true, data: exceptions });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/summary', async (req, res) => {
  try {
    const summary = await exceptionService.getExceptionSummary();
    res.json({ success: true, data: summary });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const exception = await exceptionService.getExceptionById(req.params.id);
    if (!exception) {
      return res.status(404).json({ success: false, error: '异常记录不存在' });
    }
    res.json({ success: true, data: exception });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/:id/handle', async (req, res) => {
  try {
    const result = await exceptionService.handleException(
      req.params.id,
      req.body.handled_by || '处理人',
      req.body.handling_notes
    );
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

module.exports = router;

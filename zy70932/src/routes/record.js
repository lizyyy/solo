const express = require('express');
const router = express.Router();
const {
  markProcessed,
  returnForModification,
  logException,
  addRectification,
  getRecordDetail
} = require('../services/processingService');

router.post('/:id/process', (req, res) => {
  try {
    const { handler, remark } = req.body;
    if (!handler) {
      return res.status(400).json({ error: '缺少必要参数: handler' });
    }
    const result = markProcessed(req.params.id, handler, remark);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:id/return', (req, res) => {
  try {
    const { handler, reason } = req.body;
    if (!handler) {
      return res.status(400).json({ error: '缺少必要参数: handler' });
    }
    const result = returnForModification(req.params.id, handler, reason);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:id/exception', (req, res) => {
  try {
    const { type, handler, reason } = req.body;
    if (!type) {
      return res.status(400).json({ error: '缺少必要参数: type (missing_photos/rework_verification/overdue_deduction)' });
    }
    if (!handler) {
      return res.status(400).json({ error: '缺少必要参数: handler' });
    }
    const result = logException(req.params.id, type, handler, reason);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:id/rectification', (req, res) => {
  try {
    const { handler, rectification_no, rectification_form_data } = req.body;
    if (!handler) {
      return res.status(400).json({ error: '缺少必要参数: handler' });
    }
    const result = addRectification(
      req.params.id,
      handler,
      rectification_no,
      rectification_form_data
    );
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', (req, res) => {
  try {
    const detail = getRecordDetail(req.params.id);
    if (!detail) {
      return res.status(404).json({ error: '记录不存在' });
    }
    res.json(detail);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
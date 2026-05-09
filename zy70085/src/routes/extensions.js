const express = require('express');
const { ExtensionService } = require('../services');

const router = express.Router({ mergeParams: true });

router.post('/', async (req, res) => {
  try {
    const extension = await ExtensionService.createExtension(
      req.params.applicationId,
      req.body,
      req.headers['x-operator'] || 'api'
    );
    res.status(201).json({ success: true, data: extension });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message, details: error.details });
  }
});

router.post('/:id/approve', async (req, res) => {
  try {
    const result = await ExtensionService.approveExtension(
      req.params.id,
      req.body.comment,
      req.headers['x-operator'] || 'api'
    );
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message, details: error.details });
  }
});

router.post('/:id/reject', async (req, res) => {
  try {
    const result = await ExtensionService.rejectExtension(
      req.params.id,
      req.body.reason,
      req.headers['x-operator'] || 'api'
    );
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message, details: error.details });
  }
});

router.post('/:id/cancel', async (req, res) => {
  try {
    const result = await ExtensionService.cancelExtension(
      req.params.id,
      req.headers['x-operator'] || 'api'
    );
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message, details: error.details });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const extension = await ExtensionService.getExtension(req.params.id);
    if (!extension) {
      return res.status(404).json({ success: false, error: '延期申请不存在' });
    }
    res.json({ success: true, data: extension });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/', async (req, res) => {
  try {
    const extensions = await ExtensionService.listExtensions(req.params.applicationId);
    res.json({ success: true, data: extensions });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;

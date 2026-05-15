const express = require('express');
const router = express.Router();
const ContentModel = require('../models/ContentModel');
const AppealService = require('../services/AppealService');

router.post('/', async (req, res) => {
  try {
    const result = await ContentModel.createContent(req.body);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const content = await ContentModel.getContentById(req.params.id);
    if (!content) {
      return res.status(404).json({ success: false, error: '内容不存在' });
    }
    const tags = await ContentModel.getAuditTags(req.params.id);
    const modelReasons = await ContentModel.getModelReasons(req.params.id);
    res.json({ success: true, data: { content, tags, modelReasons } });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.post('/:id/sync-audit', async (req, res) => {
  try {
    const result = await AppealService.syncAuditResult(req.params.id, req.body);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

module.exports = router;

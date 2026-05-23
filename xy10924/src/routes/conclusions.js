const express = require('express');
const router = express.Router();
const conclusionService = require('../services/conclusionService');

router.post('/', async (req, res) => {
  try {
    const conclusion = await conclusionService.createConclusion(req.body);
    res.status(201).json({ success: true, data: conclusion });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get('/', async (req, res) => {
  try {
    const conclusions = await conclusionService.getAllConclusions(req.query);
    res.json({ success: true, data: conclusions });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get('/schedule/:scheduleId', async (req, res) => {
  try {
    const conclusions = await conclusionService.getConclusionsBySchedule(req.params.scheduleId);
    res.json({ success: true, data: conclusions });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const conclusion = await conclusionService.getConclusion(req.params.id);
    if (!conclusion) {
      return res.status(404).json({ success: false, error: '转正结论不存在' });
    }
    res.json({ success: true, data: conclusion });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get('/:id/export', async (req, res) => {
  try {
    const exportData = await conclusionService.exportConclusionData(req.params.id);
    if (!exportData) {
      return res.status(404).json({ success: false, error: '转正结论不存在' });
    }
    await conclusionService.markAsExported(req.params.id, req.query.operator || 'system');
    res.json({ success: true, data: exportData });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.put('/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    const conclusion = await conclusionService.updateConclusionStatus(req.params.id, status, req.body);
    res.json({ success: true, data: conclusion });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.post('/:id/correct', async (req, res) => {
  try {
    const conclusion = await conclusionService.manualCorrect(
      req.params.id,
      req.body,
      req.body.operator || 'system'
    );
    res.json({ success: true, data: conclusion });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

module.exports = router;

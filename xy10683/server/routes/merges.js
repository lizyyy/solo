const express = require('express');
const router = express.Router();
const mergeService = require('../services/mergeService');

router.get('/', async (req, res) => {
  try {
    const data = await mergeService.getAllMerges(req.query.status);
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/check-compatibility', async (req, res) => {
  try {
    const result = await mergeService.checkMergeCompatibility(
      req.query.queue_id_1,
      req.query.queue_id_2
    );
    res.json({ success: true, ...result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const result = await mergeService.createMerge(req.body, req.body.operator || 'system');
    res.json({ success: true, id: result.id });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.put('/:id/approve', async (req, res) => {
  try {
    await mergeService.approveMerge(req.params.id, req.body.merged_table_id, req.body.operator || 'system');
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.put('/:id/reject', async (req, res) => {
  try {
    await mergeService.rejectMerge(req.params.id, req.body.operator || 'system');
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;

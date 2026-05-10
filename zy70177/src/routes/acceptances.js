const express = require('express');
const router = express.Router();
const acceptanceService = require('../services/acceptance-service');

router.post('/:id/confirm', async (req, res) => {
  try {
    const acceptance = await acceptanceService.confirmAcceptance(req.params.id, req.body);
    res.json({ success: true, data: acceptance });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.post('/:id/reject', async (req, res) => {
  try {
    const acceptance = await acceptanceService.rejectAcceptance(req.params.id, req.body);
    res.json({ success: true, data: acceptance });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const acceptance = await acceptanceService.getAcceptanceById(req.params.id);
    if (!acceptance) {
      return res.status(404).json({ success: false, error: '验收记录不存在' });
    }
    res.json({ success: true, data: acceptance });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;

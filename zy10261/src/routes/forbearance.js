const express = require('express');
const router = express.Router();
const ForbearanceService = require('../services/ForbearanceService');

router.post('/', async (req, res) => {
  try {
    const result = await ForbearanceService.createApplication(req.body);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

router.post('/:id/approve', async (req, res) => {
  try {
    const application = await ForbearanceService.approveApplication(req.params.id, req.body);
    res.json({ success: true, data: application });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

router.post('/:id/reject', async (req, res) => {
  try {
    const application = await ForbearanceService.rejectApplication(req.params.id, req.body);
    res.json({ success: true, data: application });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const application = await ForbearanceService.getApplicationDetail(req.params.id);
    res.json({ success: true, data: application });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

router.get('/contract/:contractId', async (req, res) => {
  try {
    const applications = await ForbearanceService.listApplications(req.params.contractId);
    res.json({ success: true, data: applications });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

module.exports = router;

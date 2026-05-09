const express = require('express');
const { ApplicationService } = require('../services');

const router = express.Router();

router.post('/drafts', async (req, res) => {
  try {
    const application = await ApplicationService.createDraft(req.body, req.headers['x-operator'] || 'api');
    res.status(201).json({
      success: true,
      data: application
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message,
      details: error.details
    });
  }
});

router.post('/:id/submit', async (req, res) => {
  try {
    const application = await ApplicationService.submitApplication(req.params.id, req.headers['x-operator'] || 'api');
    res.json({
      success: true,
      data: application
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message,
      details: error.details
    });
  }
});

router.post('/:id/approve', async (req, res) => {
  try {
    const application = await ApplicationService.approveApplication(
      req.params.id,
      req.body.comment,
      req.headers['x-operator'] || 'api'
    );
    res.json({
      success: true,
      data: application
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message,
      details: error.details
    });
  }
});

router.post('/:id/reject', async (req, res) => {
  try {
    const application = await ApplicationService.rejectApplication(
      req.params.id,
      req.body.reason,
      req.headers['x-operator'] || 'api'
    );
    res.json({
      success: true,
      data: application
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message,
      details: error.details
    });
  }
});

router.post('/:id/start', async (req, res) => {
  try {
    const application = await ApplicationService.startOccupation(
      req.params.id,
      req.headers['x-operator'] || 'api'
    );
    res.json({
      success: true,
      data: application
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message,
      details: error.details
    });
  }
});

router.post('/:id/cancel', async (req, res) => {
  try {
    const application = await ApplicationService.cancelApplication(
      req.params.id,
      req.headers['x-operator'] || 'api'
    );
    res.json({
      success: true,
      data: application
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message,
      details: error.details
    });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const application = await ApplicationService.getApplication(req.params.id);
    if (!application) {
      return res.status(404).json({ success: false, error: '申请不存在' });
    }
    res.json({ success: true, data: application });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/', async (req, res) => {
  try {
    const filters = {
      status: req.query.status,
      contractorId: req.query.contractorId,
      roadSectionId: req.query.roadSectionId
    };
    const applications = await ApplicationService.listApplications(filters);
    res.json({ success: true, data: applications });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;

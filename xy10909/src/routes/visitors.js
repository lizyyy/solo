const express = require('express');
const router = express.Router();
const visitorService = require('../services/visitorService');

router.post('/', async (req, res) => {
  try {
    const application = await visitorService.createApplication(req.body);
    res.json({
      success: true,
      data: application
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/', async (req, res) => {
  try {
    const filters = {
      status: req.query.status,
      host_personnel_id: req.query.host_personnel_id,
      visitor_name: req.query.visitor_name,
      scheduled_date: req.query.scheduled_date,
      limit: parseInt(req.query.limit) || 50,
      offset: parseInt(req.query.offset) || 0
    };
    const applications = await visitorService.getApplications(filters);
    res.json({
      success: true,
      data: applications
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const application = await visitorService.getApplicationById(req.params.id);
    if (!application) {
      return res.status(404).json({
        success: false,
        error: '访客申请不存在'
      });
    }
    res.json({
      success: true,
      data: application
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.put('/:id/status', async (req, res) => {
  try {
    const application = await visitorService.updateStatus(
      req.params.id,
      req.body.status,
      req.body.approved_by
    );
    res.json({
      success: true,
      data: application
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.post('/:id/checkin', async (req, res) => {
  try {
    const application = await visitorService.checkIn(req.params.id, req.body.actual_time);
    res.json({
      success: true,
      data: application
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.post('/:id/checkout', async (req, res) => {
  try {
    const application = await visitorService.checkOut(req.params.id, req.body.actual_time);
    res.json({
      success: true,
      data: application
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;

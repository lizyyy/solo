const express = require('express');
const router = express.Router();
const visitorService = require('../services/visitorService');

router.post('/', (req, res) => {
  try {
    const application = visitorService.createApplication(req.body);
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

router.get('/', (req, res) => {
  try {
    const filters = {
      status: req.query.status,
      host_personnel_id: req.query.host_personnel_id,
      visitor_name: req.query.visitor_name,
      scheduled_date: req.query.scheduled_date,
      limit: parseInt(req.query.limit) || 50,
      offset: parseInt(req.query.offset) || 0
    };
    const applications = visitorService.getApplications(filters);
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

router.get('/:id', (req, res) => {
  try {
    const application = visitorService.getApplicationById(req.params.id);
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

router.put('/:id/status', (req, res) => {
  try {
    const application = visitorService.updateStatus(
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

router.post('/:id/checkin', (req, res) => {
  try {
    const application = visitorService.checkIn(req.params.id, req.body.actual_time);
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

router.post('/:id/checkout', (req, res) => {
  try {
    const application = visitorService.checkOut(req.params.id, req.body.actual_time);
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

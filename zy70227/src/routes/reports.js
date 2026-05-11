const express = require('express');
const ReportService = require('../services/ReportService');
const { BusinessError } = require('../errors');

const router = express.Router();

router.get('/dashboard', async (req, res) => {
  try {
    const { startTime, endTime } = req.query;
    const dashboard = await ReportService.getOverallDashboard(startTime, endTime);
    res.json({ success: true, data: dashboard });
  } catch (error) {
    if (error instanceof BusinessError) {
      res.status(error.status).json(error.toJSON());
    } else {
      res.status(500).json({ success: false, error: { message: error.message } });
    }
  }
});

router.get('/conference/:conferenceId', async (req, res) => {
  try {
    const dashboard = await ReportService.getConferenceDashboard(req.params.conferenceId);
    if (!dashboard) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'CONFERENCE_NOT_FOUND',
          message: 'Conference not found',
          details: { conferenceId: req.params.conferenceId }
        }
      });
    }
    res.json({ success: true, data: dashboard });
  } catch (error) {
    if (error instanceof BusinessError) {
      res.status(error.status).json(error.toJSON());
    } else {
      res.status(500).json({ success: false, error: { message: error.message } });
    }
  }
});

router.get('/conflicts', async (req, res) => {
  try {
    const { startTime, endTime } = req.query;
    if (!startTime || !endTime) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'startTime and endTime are required',
          details: { fields: ['startTime', 'endTime'] }
        }
      });
    }
    const conflicts = await ReportService.checkConflictsInTimeRange(startTime, endTime);
    res.json({ success: true, data: conflicts });
  } catch (error) {
    if (error instanceof BusinessError) {
      res.status(error.status).json(error.toJSON());
    } else {
      res.status(500).json({ success: false, error: { message: error.message } });
    }
  }
});

module.exports = router;

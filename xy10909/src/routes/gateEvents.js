const express = require('express');
const router = express.Router();
const gateEventService = require('../services/gateEventService');

router.post('/', async (req, res) => {
  try {
    const result = gateEventService.createEvent(req.body);
    res.json({
      success: true,
      data: result
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
      person_type: req.query.person_type,
      access_result: req.query.access_result,
      start_time: req.query.start_time,
      end_time: req.query.end_time,
      limit: parseInt(req.query.limit) || 100,
      offset: parseInt(req.query.offset) || 0
    };
    const events = gateEventService.getEvents(filters);
    res.json({
      success: true,
      data: events
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
    const event = gateEventService.getEventById(req.params.id);
    if (!event) {
      return res.status(404).json({
        success: false,
        error: '事件不存在'
      });
    }
    res.json({
      success: true,
      data: event
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/:id/trace', (req, res) => {
  try {
    const trace = gateEventService.getEventTrace(req.params.id);
    if (!trace) {
      return res.status(404).json({
        success: false,
        error: '事件不存在'
      });
    }
    res.json({
      success: true,
      data: trace
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;

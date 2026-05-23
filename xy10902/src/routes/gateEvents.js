const express = require('express');
const router = express.Router();
const GateEventService = require('../services/GateEventService');
const GateEvent = require('../models/GateEvent');
const ExceptionLog = require('../models/ExceptionLog');

router.post('/', async (req, res) => {
  try {
    const { event_id, plate_number, event_type, event_time, gate_id, direction } = req.body;

    if (!event_id || !plate_number || !event_type || !event_time) {
      return res.status(400).json({
        success: false,
        error: '缺少必要参数'
      });
    }

    const result = await GateEventService.processEvent({
      event_id,
      plate_number,
      event_type,
      event_time,
      gate_id: gate_id || null,
      direction: direction || null
    });

    res.json(result);
  } catch (error) {
    await ExceptionLog.create({
      exception_type: 'gate_event_error',
      raw_input: req.body,
      error_message: error.message,
      api_path: req.path
    });

    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/plate/:plateNumber', async (req, res) => {
  try {
    const { plateNumber } = req.params;
    const { page = 1, pageSize = 20 } = req.query;

    const events = await GateEvent.listByPlate(plateNumber, parseInt(page), parseInt(pageSize));

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

module.exports = router;

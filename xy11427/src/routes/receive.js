const express = require('express');
const router = express.Router();
const { receiveAppointment, receiveGateRecord, receiveScreenshot } = require('../services/dataReceiver');

router.post('/appointment', async (req, res) => {
  try {
    const result = receiveAppointment(req.body);
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

router.post('/gate-record', async (req, res) => {
  try {
    const result = receiveGateRecord(req.body);
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

router.post('/screenshot', async (req, res) => {
  try {
    const result = receiveScreenshot(req.body);
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

module.exports = router;

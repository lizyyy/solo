const express = require('express');
const router = express.Router();
const HealthService = require('../services/healthService');

router.post('/declare', async (req, res) => {
  try {
    const { appointment_id, visitor_id, ...declarationData } = req.body;
    const result = await HealthService.submitDeclaration(appointment_id, visitor_id, declarationData);
    res.status(201).json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get('/appointment/:appointmentId', async (req, res) => {
  try {
    const result = await HealthService.getDeclarationByAppointment(req.params.appointmentId);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/validate/:appointmentId', async (req, res) => {
  try {
    const result = await HealthService.validateHealthDeclaration(req.params.appointmentId);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;

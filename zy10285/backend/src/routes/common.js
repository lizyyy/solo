const express = require('express');
const router = express.Router();
const commonService = require('../services/commonService');

router.get('/ice-specs', (req, res) => {
  try {
    const data = commonService.getIceSpecs();
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/delivery-slots', (req, res) => {
  try {
    const data = commonService.getDeliverySlots(req.query.date);
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/coolers', (req, res) => {
  try {
    const data = commonService.getCoolers(req.query.status);
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/coolers/:id/return', (req, res) => {
  try {
    commonService.returnCooler(req.params.id, req.body.notes);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/capacity-alerts', (req, res) => {
  try {
    const data = commonService.getCapacityAlerts();
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/export-orders', (req, res) => {
  try {
    const data = commonService.exportOrders(req.query);
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;

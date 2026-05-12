const express = require('express');
const router = express.Router();
const commonService = require('../services/commonService');

router.get('/ice-specs', (req, res) => {
  commonService.getIceSpecs((err, data) => {
    if (err) return res.status(500).json({ success: false, message: err.message });
    res.json({ success: true, data });
  });
});

router.get('/delivery-slots', (req, res) => {
  commonService.getDeliverySlots(req.query.date, (err, data) => {
    if (err) return res.status(500).json({ success: false, message: err.message });
    res.json({ success: true, data });
  });
});

router.get('/coolers', (req, res) => {
  commonService.getCoolers(req.query.status, (err, data) => {
    if (err) return res.status(500).json({ success: false, message: err.message });
    res.json({ success: true, data });
  });
});

router.post('/coolers/:id/return', (req, res) => {
  commonService.returnCooler(req.params.id, req.body.notes || '', (err) => {
    if (err) return res.status(500).json({ success: false, message: err.message });
    res.json({ success: true });
  });
});

router.get('/capacity-alerts', (req, res) => {
  commonService.getCapacityAlerts((err, data) => {
    if (err) return res.status(500).json({ success: false, message: err.message });
    res.json({ success: true, data });
  });
});

router.get('/export-orders', (req, res) => {
  commonService.exportOrders(req.query, (err, data) => {
    if (err) return res.status(500).json({ success: false, message: err.message });
    res.json({ success: true, data });
  });
});

module.exports = router;

const express = require('express');
const router = express.Router();
const HealthScoreService = require('../services/HealthScoreService');
router.post('/score/:interfaceId', async (req, res) => {
 try {
 const periodHours = parseInt(req.query.hours) || 1;
 const result = await HealthScoreService.generateScore(req.params.interfaceId, periodHours);
 res.json({ success: true, data: result });
 }
 catch (err) {
 res.status(400).json({ success: false, error: err.message });
 }
});
router.get('/score/:interfaceId', async (req, res) => {
 try {
 const result = await HealthScoreService.getLatestScore(req.params.interfaceId);
 res.json({ success: true, data: result });
 }
 catch (err) {
 res.status(400).json({ success: false, error: err.message });
 }
});
router.get('/vendor/:vendorId/aggregate', async (req, res) => {
 try {
 const result = await HealthScoreService.getVendorAggregatedScore(req.params.vendorId);
 res.json({ success: true, data: result });
 }
 catch (err) {
 res.status(400).json({ success: false, error: err.message });
 }
});
module.exports = router;

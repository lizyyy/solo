const express = require('express');
const router = express.Router();
const FailureService = require('../services/FailureService');
router.post('/', async (req, res) => {
 try {
 const result = await FailureService.recordFailure(req.body);
 res.json({ success: true, data: result });
 }
 catch (err) {
 res.status(400).json({ success: false, error: err.message });
 }
});
router.get('/interface/:interfaceId', async (req, res) => {
 try {
 const limit = parseInt(req.query.limit) || 50;
 const result = await FailureService.getFailureHistory(req.params.interfaceId, limit);
 res.json({ success: true, data: result });
 }
 catch (err) {
 res.status(400).json({ success: false, error: err.message });
 }
});
router.get('/interface/:interfaceId/aggregate', async (req, res) => {
 try {
 const endTime = Date.now();
 const hours = parseInt(req.query.hours) || 1;
 const startTime = endTime - hours * 60 * 60 * 1000;
 const result = await FailureService.aggregateFailures(req.params.interfaceId, startTime, endTime);
 res.json({ success: true, data: result });
 }
 catch (err) {
 res.status(400).json({ success: false, error: err.message });
 }
});
router.get('/interface/:interfaceId/timeouts', async (req, res) => {
 try {
 const limit = parseInt(req.query.limit) || 10;
 const result = await FailureService.getTimeoutSamples(req.params.interfaceId, limit);
 res.json({ success: true, data: result });
 }
 catch (err) {
 res.status(400).json({ success: false, error: err.message });
 }
});
router.post('/archive', async (req, res) => {
 try {
 const days = parseInt(req.query.days) || 7;
 const result = await FailureService.archiveOldSamples(days);
 res.json({ success: true, data: result });
 }
 catch (err) {
 res.status(400).json({ success: false, error: err.message });
 }
});
module.exports = router;

const express = require('express');
const router = express.Router();
const ExportService = require('../services/ExportService');
const VendorService = require('../services/VendorService');
router.get('/health-summary', async (req, res) => {
 try {
 const vendorId = req.query.vendor_id || null;
 const result = await ExportService.exportHealthSummary(vendorId);
 if (req.query.format === 'json') {
 res.setHeader('Content-Type', 'application/json');
 res.setHeader('Content-Disposition', 'attachment; filename="health-summary.json"');
 }
 res.json({ success: true, data: result });
 }
 catch (err) {
 res.status(400).json({ success: false, error: err.message });
 }
});
router.get('/vendor/:vendorId/detail', async (req, res) => {
 try {
 const result = await ExportService.exportVendorDetail(req.params.vendorId);
 res.json({ success: true, data: result });
 }
 catch (err) {
 res.status(400).json({ success: false, error: err.message });
 }
});
router.post('/manual-correction', async (req, res) => {
 try {
 const result = await VendorService.createManualCorrection(req.body);
 res.json({ success: true, data: result });
 }
 catch (err) {
 res.status(400).json({ success: false, error: err.message });
 }
});
router.get('/manual-correction', async (req, res) => {
 try {
 const interfaceId = req.query.interface_id || null;
 const result = await VendorService.getManualCorrections(interfaceId);
 res.json({ success: true, data: result });
 }
 catch (err) {
 res.status(400).json({ success: false, error: err.message });
 }
});
module.exports = router;

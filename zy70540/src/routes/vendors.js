const express = require('express');
const router = express.Router();
const VendorService = require('../services/VendorService');
router.post('/', async (req, res) => {
 try {
 const result = await VendorService.createVendor(req.body);
 res.json({ success: true, data: result });
 }
 catch (err) {
 res.status(400).json({ success: false, error: err.message });
 }
});
router.get('/', async (req, res) => {
 try {
 const result = await VendorService.listVendors();
 res.json({ success: true, data: result });
 }
 catch (err) {
 res.status(400).json({ success: false, error: err.message });
 }
});
router.get('/:id', async (req, res) => {
 try {
 const result = await VendorService.getVendor(req.params.id);
 res.json({ success: true, data: result });
 }
 catch (err) {
 res.status(400).json({ success: false, error: err.message });
 }
});
router.post('/:vendorId/interfaces', async (req, res) => {
 try {
 const data = { ...req.body, vendor_id: req.params.vendorId };
 const result = await VendorService.createInterface(data);
 res.json({ success: true, data: result });
 }
 catch (err) {
 res.status(400).json({ success: false, error: err.message });
 }
});
router.get('/:vendorId/interfaces', async (req, res) => {
 try {
 const result = await VendorService.listInterfaces(req.params.vendorId);
 res.json({ success: true, data: result });
 }
 catch (err) {
 res.status(400).json({ success: false, error: err.message });
 }
});
router.get('/interfaces/:interfaceId', async (req, res) => {
 try {
 const result = await VendorService.getInterface(req.params.interfaceId);
 res.json({ success: true, data: result });
 }
 catch (err) {
 res.status(400).json({ success: false, error: err.message });
 }
});
module.exports = router;

const express = require('express');
const router = express.Router();
const { DisposalService } = require('../services/DisposalService');
router.post('/', async (req, res) => {
 try {
 const result = await DisposalService.createAction(req.body);
 res.json({ success: true, data: result });
 }
 catch (err) {
 res.status(400).json({ success: false, error: err.message });
 }
});
router.post('/:actionId/status', async (req, res) => {
 try {
 const { status, result } = req.body;
 const actionResult = await DisposalService.advanceStatus(req.params.actionId, status, result);
 res.json({ success: true, data: actionResult });
 }
 catch (err) {
 res.status(400).json({ success: false, error: err.message });
 }
});
router.get('/interface/:interfaceId', async (req, res) => {
 try {
 const status = req.query.status || null;
 const result = await DisposalService.getActionsByInterface(req.params.interfaceId, status);
 res.json({ success: true, data: result });
 }
 catch (err) {
 res.status(400).json({ success: false, error: err.message });
 }
});
router.post('/suggestion', async (req, res) => {
 try {
 const healthScore = req.body;
 const suggestion = await DisposalService.generateSuggestion(healthScore);
 res.json({ success: true, data: suggestion });
 }
 catch (err) {
 res.status(400).json({ success: false, error: err.message });
 }
});
module.exports = router;

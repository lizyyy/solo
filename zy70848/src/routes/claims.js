const express = require('express');
const router = express.Router();
const claimService = require('../services/claimService');

router.get('/', async (req, res) => {
  try {
    const filters = {
      caseNo: req.query.caseNo,
      materialVersion: req.query.materialVersion,
      reviewOpinion: req.query.reviewOpinion,
      status: req.query.status,
      batchId: req.query.batchId
    };

    const records = await claimService.queryRecords(filters);
    res.json({ success: true, data: records, count: records.length });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/:recordId/logs', async (req, res) => {
  try {
    const { recordId } = req.params;
    const logs = await claimService.getRecordLogs(recordId);
    res.json({ success: true, data: logs });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/:recordId/approve', async (req, res) => {
  try {
    const { recordId } = req.params;
    const { handler, reviewOpinion } = req.body;
    const result = await claimService.approveRecord(recordId, handler, reviewOpinion);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/:recordId/return', async (req, res) => {
  try {
    const { recordId } = req.params;
    const { handler, reviewOpinion } = req.body;
    const result = await claimService.returnForRevision(recordId, handler, reviewOpinion);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/:recordId/request-materials', async (req, res) => {
  try {
    const { recordId } = req.params;
    const { handler, reviewOpinion } = req.body;
    const result = await claimService.requestMoreMaterials(recordId, handler, reviewOpinion);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/export/csv', async (req, res) => {
  try {
    const filters = {
      caseNo: req.query.caseNo,
      materialVersion: req.query.materialVersion,
      reviewOpinion: req.query.reviewOpinion,
      status: req.query.status,
      batchId: req.query.batchId
    };

    const records = await claimService.queryRecords(filters);
    const csv = await claimService.exportToCSV(records);

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="claims_export_${Date.now()}.csv"`);
    res.send('\uFEFF' + csv);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/statistics/summary', async (req, res) => {
  try {
    const stats = await claimService.getStatistics();
    res.json({ success: true, data: stats });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;

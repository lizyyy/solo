const express = require('express');
const VulnerabilityService = require('../services/vulnerabilityService');
const AuditService = require('../services/auditService');
const ExportService = require('../services/exportService');

const router = express.Router();

router.post('/', async (req, res) => {
  try {
    const result = await VulnerabilityService.createVulnerability(req.body);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get('/', async (req, res) => {
  try {
    const { status, severity, operator } = req.query;
    const result = await VulnerabilityService.getVulnerabilities({ status, severity }, operator);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const { operator } = req.query;
    const result = await VulnerabilityService.getVulnerability(req.params.id, operator);
    if (!result) {
      return res.status(404).json({ success: false, error: '漏洞不存在' });
    }
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.post('/:id/analyze', async (req, res) => {
  try {
    const { operator } = req.body;
    const result = await VulnerabilityService.analyzeImpact(req.params.id, operator);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.post('/:id/exempt', async (req, res) => {
  try {
    const { reason, operator } = req.body;
    const result = await VulnerabilityService.exempt(req.params.id, reason, operator);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.post('/:id/fix', async (req, res) => {
  try {
    const { fixBatch, operator } = req.body;
    const result = await VulnerabilityService.startFixing(req.params.id, fixBatch, operator);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.post('/:id/verify', async (req, res) => {
  try {
    const { verifier, result, comment } = req.body;
    const data = await VulnerabilityService.verify(req.params.id, verifier, result, comment);
    res.json({ success: true, data });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.post('/:id/close', async (req, res) => {
  try {
    const { operator } = req.body;
    const result = await VulnerabilityService.close(req.params.id, operator);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.post('/merge', async (req, res) => {
  try {
    const { targetId, sourceIds, operator } = req.body;
    const result = await VulnerabilityService.mergeVulnerabilities(targetId, sourceIds, operator);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get('/:id/audit-logs', async (req, res) => {
  try {
    const result = await AuditService.getLogsByVulnerability(req.params.id);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get('/:id/verifications', async (req, res) => {
  try {
    const result = await VulnerabilityService.getVerificationRecords(req.params.id);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.post('/export', async (req, res) => {
  try {
    const { format = 'csv', filters = {}, operator, includeDetails = false } = req.body;
    const result = await ExportService.exportVulnerabilities(format, filters, operator, includeDetails);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get('/exports/:filename', async (req, res) => {
  try {
    const filepath = ExportService.getExportFile(req.params.filename);
    if (!filepath) {
      return res.status(404).json({ success: false, error: '文件不存在' });
    }
    res.download(filepath);
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

module.exports = router;

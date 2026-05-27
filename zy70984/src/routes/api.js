const express = require('express');
const router = express.Router();
const BatchService = require('../services/batchService');
const PackageService = require('../services/packageService');
const { ImportService, ExportService } = require('../services/importExport');
const multer = require('multer');
const { maskPackageData } = require('../utils/privacy');

const upload = multer({ storage: multer.memoryStorage() });

router.post('/batches', (req, res) => {
  try {
    const batch = BatchService.create(req.body);
    res.json({ success: true, data: batch });
  } catch (e) {
    res.status(400).json({ success: false, error: e.message });
  }
});

router.get('/batches', (req, res) => {
  const batches = BatchService.list(req.query.status);
  res.json({ success: true, data: batches });
});

router.get('/batches/returns', (req, res) => {
  const batches = BatchService.getReturnBatches();
  res.json({ success: true, data: batches });
});

router.get('/batches/:no', (req, res) => {
  const batch = BatchService.getByNo(req.params.no);
  if (!batch) return res.status(404).json({ success: false, error: '批次不存在' });
  res.json({ success: true, data: batch });
});

router.post('/packages', (req, res) => {
  try {
    const pkg = PackageService.create(req.body);
    res.json({ success: true, data: pkg });
  } catch (e) {
    res.status(400).json({ success: false, error: e.message });
  }
});

router.get('/packages/search', (req, res) => {
  const result = PackageService.search(req.query);
  const rule = PackageService.getReturnRule();
  const enriched = result.list.map(p => PackageService.enrichWithDetails(p, rule));
  const masked = req.query.masked ? enriched.map(maskPackageData) : enriched;
  res.json({ success: true, data: masked, total: result.total });
});

router.get('/packages/code/:code', (req, res) => {
  const pkg = PackageService.getByPickUpCode(req.params.code);
  if (!pkg) return res.status(404).json({ success: false, error: '包裹不存在' });
  const rule = PackageService.getReturnRule();
  const enriched = PackageService.enrichWithDetails(pkg, rule);
  const masked = req.query.masked ? maskPackageData(enriched) : enriched;
  const sms = PackageService.getSmsRecords(pkg.id);
  const audit = PackageService.getAuditLogs(pkg.id);
  res.json({ success: true, data: { ...masked, sms_records: sms, audit_logs: audit } });
});

router.post('/packages/:id/process', (req, res) => {
  try {
    const { action, reason, operator } = req.body;
    const pkg = PackageService.markProcessed(req.params.id, operator, action, reason);
    res.json({ success: true, data: pkg });
  } catch (e) {
    res.status(400).json({ success: false, error: e.message });
  }
});

router.put('/packages/:id/return', (req, res) => {
  try {
    const { operator } = req.body;
    const pkg = PackageService.updateReturn(req.params.id, req.body, operator);
    res.json({ success: true, data: pkg });
  } catch (e) {
    res.status(400).json({ success: false, error: e.message });
  }
});

router.get('/packages/:id/audit', (req, res) => {
  const logs = PackageService.getAuditLogs(req.params.id);
  res.json({ success: true, data: logs });
});

router.post('/import/csv', upload.single('file'), (req, res) => {
  try {
    if (!req.file) throw new Error('请上传文件');
    const batchId = req.body.batch_id || null;
    const result = ImportService.importPackagesFromCsv(req.file.buffer, batchId, req.body.created_by);
    res.json({ success: true, data: result });
  } catch (e) {
    res.status(400).json({ success: false, error: e.message });
  }
});

router.post('/import/sms', (req, res) => {
  try {
    const result = ImportService.importSmsFromJson(req.body, req.query.created_by);
    res.json({ success: true, data: result });
  } catch (e) {
    res.status(400).json({ success: false, error: e.message });
  }
});

router.get('/export/csv', (req, res) => {
  const result = PackageService.search(req.query);
  const rule = PackageService.getReturnRule();
  const csv = ExportService.exportToCsv(result.list, rule);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="packages_${Date.now()}.csv"`);
  res.send(csv);
});

router.get('/rules/return', (req, res) => {
  const rule = PackageService.getReturnRule();
  res.json({ success: true, data: rule });
});

module.exports = router;

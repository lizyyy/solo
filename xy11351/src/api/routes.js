const express = require('express');
const router = express.Router();
const importService = require('../services/importService');
const qualityService = require('../services/qualityService');
const queryService = require('../services/queryService');
const exportService = require('../services/exportService');

router.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

router.post('/import/paper-batches', async (req, res) => {
  try {
    const { data, operator = 'system' } = req.body;
    const result = await importService.importPaperBatches(data, operator);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/import/print-batches', async (req, res) => {
  try {
    const { data, operator = 'system' } = req.body;
    const result = await importService.importPrintBatches(data, operator);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/import/lab-records', async (req, res) => {
  try {
    const { data, operator = 'system' } = req.body;
    const result = await importService.importLabRecords(data, operator);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/import/rework-records', async (req, res) => {
  try {
    const { data, operator = 'system' } = req.body;
    const result = await importService.importReworkRecords(data, operator);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/quality/determine/:id', async (req, res) => {
  try {
    const { checker = 'system' } = req.body;
    const result = await qualityService.determineQuality(req.params.id, checker);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/quality/review/:id', async (req, res) => {
  try {
    const { reviewer = 'system', reviewResult } = req.body;
    const result = await qualityService.reviewQuality(req.params.id, reviewer, reviewResult);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/quality/order/:id', async (req, res) => {
  try {
    const { generatedBy = 'system' } = req.body;
    const result = await qualityService.generateQualityOrder(req.params.id, generatedBy);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/quality/trends', async (req, res) => {
  try {
    const result = await qualityService.getQualityTrends(req.query);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/print-batches', async (req, res) => {
  try {
    const result = await queryService.queryPrintBatches(req.query);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/print-batches/:id', async (req, res) => {
  try {
    const result = await queryService.getPrintBatchDetail(req.params.id);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/paper-batches', async (req, res) => {
  try {
    const result = await queryService.queryPaperBatches(req.query);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/responsible-list', async (req, res) => {
  try {
    const result = await queryService.getResponsibleList();
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/export/excel', async (req, res) => {
  try {
    const buffer = await exportService.exportToExcel(req.query);
    const filename = `质检报告_${new Date().toISOString().slice(0, 10)}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/export/csv', async (req, res) => {
  try {
    const csv = await exportService.exportToCsv(req.query);
    const filename = `质检报告_${new Date().toISOString().slice(0, 10)}.csv`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send('\uFEFF' + csv);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;

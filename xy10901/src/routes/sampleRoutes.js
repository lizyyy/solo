const express = require('express');
const router = express.Router();
const { Parser } = require('json2csv');
const SampleService = require('../services/sampleService');
const QueryService = require('../services/queryService');
const { validate } = require('../middleware/validation');

router.post('/barcodes', validate('barcode'), async (req, res) => {
  try {
    const result = await SampleService.createBarcode(req.body);
    res.status(201).json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get('/barcodes', async (req, res) => {
  try {
    const result = await QueryService.getBarcodes(req.query);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/sampling', validate('sampling'), async (req, res) => {
  try {
    const result = await SampleService.createSamplingRecord(req.body);
    res.status(201).json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get('/sampling', async (req, res) => {
  try {
    const result = await QueryService.getSamplingRecords(req.query);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/transport', validate('transportBatch'), async (req, res) => {
  try {
    const result = await SampleService.createTransportBatch(req.body);
    res.status(201).json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get('/transport', async (req, res) => {
  try {
    const result = await QueryService.getTransportBatches(req.query);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/transport/:batchId/samples', async (req, res) => {
  try {
    const result = await QueryService.getBatchSamples(req.params.batchId);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/receive', validate('receiveSample'), async (req, res) => {
  try {
    const result = await SampleService.receiveSample(req.body);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.post('/reject', validate('rejectSample'), async (req, res) => {
  try {
    const result = await SampleService.rejectSample(req.body);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get('/transfers', async (req, res) => {
  try {
    const result = await QueryService.getTransferRecords(req.query);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/amendment', validate('amendment'), async (req, res) => {
  try {
    const result = await SampleService.requestAmendment(req.body);
    res.status(201).json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.post('/amendment/approve', validate('approveAmendment'), async (req, res) => {
  try {
    const result = await SampleService.approveAmendment(req.body);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get('/amendments', async (req, res) => {
  try {
    const result = await QueryService.getAmendmentRequests(req.query);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/rejection-reasons', async (req, res) => {
  try {
    const result = await QueryService.getRejectionReasons();
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/receiving-windows', async (req, res) => {
  try {
    const result = await QueryService.getReceivingWindows();
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/exceptions', async (req, res) => {
  try {
    const result = await QueryService.getExceptionLogs(req.query);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/report', async (req, res) => {
  try {
    const result = await SampleService.getTransferReport(req.query);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/report/export', async (req, res) => {
  try {
    const result = await SampleService.getTransferReport(req.query);
    
    const fields = [
      'barcode', 'status', 'received_time', 'receiver', 'is_amended',
      'sampling_time', 'sampler', 'clinic_name', 'patient_name',
      'batch_code', 'transporter', 'departure_time',
      'rejection_reason', 'rejection_note'
    ];
    
    const json2csvParser = new Parser({ fields });
    const csv = json2csvParser.parse(result);
    
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="transfer_report_${Date.now()}.csv"`);
    res.send('\uFEFF' + csv);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;

var express = require('express');
var router = express.Router();
var exportService = require('../services/exportService');

router.get('/samples', function(req, res) {
  var sampleNo = req.query.sampleNo;
  var status = req.query.status;
  var recheckResult = req.query.recheckResult;
  var batchId = req.query.batchId;
  var format = req.query.format;

  exportService.exportSamplesByQuery({
    sampleNo: sampleNo,
    status: status,
    recheckResult: recheckResult,
    batchId: batchId ? parseInt(batchId) : null
  }).then(function(result) {
    if (format === 'csv') {
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename=samples.csv');
      res.send(result.csv);
    } else {
      res.json({ success: true, count: result.count, data: result.data });
    }
  }).catch(function(e) {
    res.status(500).json({ success: false, error: e.message });
  });
});

router.get('/batch/:batchId', function(req, res) {
  exportService.exportBatchDetails(parseInt(req.params.batchId)).then(function(result) {
    res.json({ success: true, data: result });
  }).catch(function(e) {
    res.status(500).json({ success: false, error: e.message });
  });
});

router.get('/logs', function(req, res) {
  exportService.exportLogs().then(function(result) {
    res.json({ success: true, count: result.count, data: result.data });
  }).catch(function(e) {
    res.status(500).json({ success: false, error: e.message });
  });
});

module.exports = router;
